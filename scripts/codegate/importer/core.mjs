import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLocalJsonSource } from './adapters/local-json.mjs';
import { difficultyLevels, generateVariants } from './variants.mjs';

const adapters = new Map([['local-json', loadLocalJsonSource]]);
const supportedTypes = new Set([
  'int', 'string', 'boolean', 'int_array', 'int_array_2d', 'string_array',
  'string_list', 'string_list_2d', 'int_list', 'int_list_2d', 'char_array_2d'
]);
const extensions = { python: 'py', cpp: 'cpp' };

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, file);
}

async function atomicText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, value.endsWith('\n') ? value : `${value}\n`);
  await fs.rename(temporary, file);
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') throw new Error('record must be an object');
  if (!/^\d+$/.test(String(record.frontendId ?? ''))) throw new Error('frontendId must be numeric text');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug ?? '')) throw new Error('slug is not canonical');
  if (!record.languages || typeof record.languages !== 'object') throw new Error('languages are required');
  for (const language of Object.keys(record.languages)) {
    if (!(language in extensions)) throw new Error(`unsupported language: ${language}`);
  }
  return record;
}

async function repositoryProblems(repositoryRoot) {
  const root = path.join(repositoryRoot, 'problems');
  const entries = await fs.readdir(root, { withFileTypes: true });
  const problems = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      const metadata = await readJson(path.join(root, entry.name, 'metadata.json'));
      problems.push({ problemId: entry.name, root: path.join(root, entry.name), metadata });
    } catch {
      // Existing incomplete directories remain outside the importer.
    }
  }
  return problems;
}

function identityConflicts(records) {
  const conflicts = new Map();
  const byFrontend = new Map();
  const bySlug = new Map();
  for (const record of records) {
    byFrontend.set(record.frontendId, [...(byFrontend.get(record.frontendId) ?? []), record]);
    bySlug.set(record.slug, [...(bySlug.get(record.slug) ?? []), record]);
  }
  for (const group of byFrontend.values()) {
    if (new Set(group.map((record) => record.slug)).size > 1) {
      for (const record of group) conflicts.set(record, `frontend ID ${record.frontendId} maps to multiple slugs`);
    }
  }
  for (const group of bySlug.values()) {
    if (new Set(group.map((record) => record.frontendId)).size > 1) {
      for (const record of group) conflicts.set(record, `slug ${record.slug} maps to multiple frontend IDs`);
    }
  }
  return conflicts;
}

function matchProblem(record, problems) {
  const byFrontend = problems.filter((problem) => String(problem.metadata.frontendId ?? '') === record.frontendId);
  const bySlug = problems.filter((problem) => problem.problemId === record.slug || problem.metadata.id === record.slug);
  if (byFrontend.length > 1 || bySlug.length > 1) throw new Error('repository identity is ambiguous');
  if (byFrontend[0] && bySlug[0] && byFrontend[0].problemId !== bySlug[0].problemId) {
    throw new Error('frontend ID and canonical slug match different repository problems');
  }
  return byFrontend[0] ?? bySlug[0];
}

async function resolveAsset(record, candidate, label, repositoryRoot) {
  if (typeof candidate !== 'string' || !candidate || path.isAbsolute(candidate)) throw new Error(`${label} must be a relative local path`);
  const resolved = path.resolve(record.sourceDirectory, candidate);
  if (!inside(repositoryRoot, resolved)) throw new Error(`${label} escapes the repository`);
  const real = await fs.realpath(resolved);
  if (!inside(repositoryRoot, real)) throw new Error(`${label} resolves outside the repository`);
  return real;
}

async function inspectPack(problem, record) {
  if (record.shape !== 'function') throw new Error(`unsupported problem shape: ${record.shape ?? 'unknown'}`);
  const required = ['statement.md', 'metadata.json', 'official-tests.json', 'Marker.java'];
  await Promise.all(required.map((name) => fs.access(path.join(problem.root, name))));
  const tests = await readJson(path.join(problem.root, 'official-tests.json'));
  const marker = await fs.readFile(path.join(problem.root, 'Marker.java'), 'utf8');
  const metadata = problem.metadata;
  if (metadata.id !== problem.problemId || !Array.isArray(metadata.params) || !metadata.params.length) throw new Error('metadata identity or parameters are incomplete');
  if (metadata.classProblem) throw new Error('design/class-operation problems are quarantined');
  if (![...metadata.params.map((param) => param.type), metadata.outputType].every((type) => supportedTypes.has(type))) {
    throw new Error('problem uses a deferred parameter or output type');
  }
  if (!Array.isArray(tests) || !tests.length) throw new Error('official tests are empty');
  for (const [index, test] of tests.entries()) {
    for (const param of metadata.params) if (!(param.name in test)) throw new Error(`official test ${index + 1} is missing ${param.name}`);
  }
  if (JSON.stringify(tests).includes('@javascript:')) throw new Error('dynamic test expressions are outside the initial offline import scope');
  if (!marker.includes(metadata.functionName) || !marker.includes('isCorrect')) throw new Error('Marker.java does not agree with metadata or lacks a trusted validator');
  if (record.validatorKinds && !record.validatorKinds.includes('custom')) throw new Error('record does not permit the existing custom validator');
  return { metadata, tests };
}

async function importRecord(problem, record, repositoryRoot) {
  const { metadata } = await inspectPack(problem, record);
  const languages = {};
  for (const [language, assets] of Object.entries(record.languages)) {
    const referencePath = await resolveAsset(record, assets.reference, `${language} reference`, repositoryRoot);
    const incorrectPath = await resolveAsset(record, assets.incorrect, `${language} incorrect solution`, repositoryRoot);
    const [reference, incorrect] = await Promise.all([fs.readFile(referencePath, 'utf8'), fs.readFile(incorrectPath, 'utf8')]);
    for (const [label, source] of [['reference', reference], ['incorrect solution', incorrect]]) {
      if (source.length > 262_144) throw new Error(`${language} ${label} exceeds the import source limit`);
      if (/https?:\/\/|\b(requests|socket|curl|wget)\b|\bfetch\s*\(/i.test(source)) throw new Error(`${language} ${label} appears to require network access`);
      if (!source.includes('class Solution') || !source.includes(metadata.functionName)) throw new Error(`${language} ${label} does not agree with the problem signature`);
    }
    const extension = extensions[language];
    const outputReference = path.join(problem.root, 'reference', `${language}.${extension}`);
    const outputIncorrect = path.join(problem.root, 'reference', 'incorrect', `${language}.${extension}`);
    await Promise.all([atomicText(outputReference, reference), atomicText(outputIncorrect, incorrect)]);
    const variants = generateVariants({ metadata, language, reference, hints: record.difficultyHints ?? [] });
    const variantPaths = {};
    for (const level of difficultyLevels) {
      const output = path.join(problem.root, 'variants', language, `${level}.${extension}`);
      await atomicText(output, variants[level]);
      variantPaths[level] = path.relative(problem.root, output).replaceAll(path.sep, '/');
    }
    languages[language] = {
      reference: path.relative(problem.root, outputReference).replaceAll(path.sep, '/'),
      incorrect: path.relative(problem.root, outputIncorrect).replaceAll(path.sep, '/'),
      variants: variantPaths
    };
  }
  if (!Object.keys(languages).length) throw new Error('record has no supported language assets');
  const config = {
    schemaVersion: 1,
    problemId: problem.problemId,
    frontendId: record.frontendId,
    source: { ...record.source, record: record.sourceRecord },
    validation: { status: 'pending', judge: 'existing-cojudge', limits: 'existing-runner-limits' },
    languages
  };
  await atomicJson(path.join(problem.root, 'codegate.json'), config);
  return { frontendId: record.frontendId, slug: record.slug, problemId: problem.problemId, difficulty: metadata.difficulty, languages: Object.keys(languages), status: 'pending-validation' };
}

export async function runImport(configPath, repositoryRoot = process.cwd()) {
  repositoryRoot = path.resolve(repositoryRoot);
  const resolvedConfig = path.resolve(configPath);
  if (!inside(repositoryRoot, resolvedConfig)) throw new Error('import config must be inside the repository');
  const config = await readJson(resolvedConfig);
  if (config.schemaVersion !== 1 || !Array.isArray(config.sources) || !config.sources.length) throw new Error('invalid import config');
  if (typeof config.generatedAt !== 'string') throw new Error('generatedAt is required for deterministic reports');
  const context = { repositoryRoot, configDirectory: path.dirname(resolvedConfig) };
  const rawRecords = [];
  const sources = [];
  for (const source of config.sources) {
    if (typeof source.name !== 'string' || typeof source.revision !== 'string') throw new Error('every source needs a pinned name and revision');
    const adapter = adapters.get(source.adapter);
    if (!adapter) throw new Error(`unknown source adapter: ${source.adapter}`);
    rawRecords.push(...await adapter(source, context));
    sources.push({ adapter: source.adapter, name: source.name, revision: source.revision, path: source.path });
  }
  const normalized = [];
  const failed = [];
  for (const raw of rawRecords) {
    try { normalized.push(normalizeRecord(raw)); }
    catch (error) { failed.push({ frontendId: String(raw?.frontendId ?? ''), slug: raw?.slug ?? '', reason: error instanceof Error ? error.message : String(error) }); }
  }
  const conflicts = identityConflicts(normalized);
  const problems = await repositoryProblems(repositoryRoot);
  const accepted = [];
  const skipped = [];
  for (const record of normalized) {
    if (conflicts.has(record)) {
      failed.push({ frontendId: record.frontendId, slug: record.slug, reason: conflicts.get(record) });
      continue;
    }
    try {
      const problem = matchProblem(record, problems);
      if (!problem) {
        skipped.push({ frontendId: record.frontendId, slug: record.slug, reason: 'no matching complete CoJudge problem pack' });
        continue;
      }
      accepted.push(await importRecord(problem, record, repositoryRoot));
    } catch (error) {
      skipped.push({ frontendId: record.frontendId, slug: record.slug, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const report = {
    schemaVersion: 1,
    generatedAt: config.generatedAt,
    offline: true,
    sources,
    limits: 'Existing CoJudge Docker runner compilation, runtime, memory, and output limits',
    accepted,
    skipped,
    failed
  };
  const reportPath = path.resolve(repositoryRoot, config.report ?? 'codegate/import-report.json');
  if (!inside(repositoryRoot, reportPath)) throw new Error('import report path escapes the repository');
  await atomicJson(reportPath, report);
  return report;
}
