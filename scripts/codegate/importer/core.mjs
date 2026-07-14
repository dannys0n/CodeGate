import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLeetcodeBundle } from './adapters/leetcode-bundle.mjs';

const adapters = new Map([
  ['leetcode-bundle', loadLeetcodeBundle]
]);
const supportedTypes = new Set([
  'int', 'string', 'boolean', 'int_array', 'int_array_2d', 'string_array',
  'string_list', 'string_list_2d', 'int_list', 'int_list_2d', 'char_array_2d'
]);
const languages = new Set(['python', 'cpp', 'java', 'csharp', 'rust', 'go', 'typescript']);

function sourceAgrees(language, source, functionName) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const transformed = {
    csharp: functionName.charAt(0).toUpperCase() + functionName.slice(1),
    rust: functionName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
    go: functionName.charAt(0).toUpperCase() + functionName.slice(1)
  }[language] ?? functionName;
  const name = transformed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`\\b${name}\\b`).test(source)) return false;
  if (language === 'rust') return /\bimpl\s+Solution\b/.test(source);
  if (language === 'go') return new RegExp(`\\bfunc\\s+${name}\\s*\\(`).test(source);
  if (language === 'typescript') return new RegExp(`\\bexport\\s+function\\s+${escaped}\\s*\\(`).test(source);
  return /\bclass\s+Solution\b/.test(source);
}

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
  if (record.adapterError) throw new Error(record.adapterError);
  if (!/^\d+$/.test(String(record.frontendId ?? ''))) throw new Error('frontendId must be numeric text');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug ?? '')) throw new Error('slug is not canonical');
  if (!record.languages || typeof record.languages !== 'object') throw new Error('languages are required');
  for (const language of Object.keys(record.languages)) {
    if (!languages.has(language)) throw new Error(`unsupported language: ${language}`);
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
      const generated = await fs.access(path.join(root, entry.name, '.codegate-generated.json')).then(() => true).catch(() => false);
      problems.push({ problemId: entry.name, root: path.join(root, entry.name), metadata, generated });
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

async function sourceText(record, assets, key, label, repositoryRoot) {
  const inline = assets[`${key}Code`];
  if (typeof inline === 'string' && inline.trim()) return inline;
  const resolved = await resolveAsset(record, assets[key], label, repositoryRoot);
  return fs.readFile(resolved, 'utf8');
}

async function createPack(record, repositoryRoot) {
  if (!record.pack) return undefined;
  const problemRoot = path.join(repositoryRoot, 'problems', record.slug);
  const relative = path.relative(path.join(repositoryRoot, 'problems'), problemRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('generated problem path escapes problems directory');
  const metadata = { ...record.pack.metadata, id: record.slug, frontendId: record.frontendId };
  if (!Array.isArray(record.pack.tests) || !record.pack.tests.length) throw new Error('generated pack has no tests');
  if (JSON.stringify(record.pack.tests).includes('@javascript:')) throw new Error('generated packs cannot contain dynamic test expressions');
  if (typeof record.pack.marker !== 'string' || !record.pack.marker.includes('isCorrect')) throw new Error('generated pack has no validator');
  await Promise.all([
    atomicText(path.join(problemRoot, 'statement.md'), record.pack.statement),
    atomicJson(path.join(problemRoot, 'metadata.json'), metadata),
    atomicJson(path.join(problemRoot, 'official-tests.json'), record.pack.tests),
    atomicText(path.join(problemRoot, 'Marker.java'), record.pack.marker),
    atomicJson(path.join(problemRoot, '.codegate-generated.json'), {
      schemaVersion: 1,
      adapter: 'leetcode-bundle',
      frontendId: record.frontendId,
      sourceRecord: record.sourceRecord
    })
  ]);
  return { problemId: record.slug, root: problemRoot, metadata, generated: true };
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
  // Dynamic expressions are accepted only from complete problem packs already
  // checked into the repository. Generated adapters never emit them.
  if (!marker.includes(metadata.functionName) || !marker.includes('isCorrect')) throw new Error('Marker.java does not agree with metadata or lacks a trusted validator');
  if (record.validatorKinds && !record.validatorKinds.includes('custom')) throw new Error('record does not permit the existing custom validator');
  return { metadata, tests };
}

async function importRecord(problem, record, repositoryRoot) {
  const { metadata } = await inspectPack(problem, record);
  if (record.slimSources !== true) throw new Error('only slim source-index records are supported');
  const indexedLanguages = {};
  for (const [language, assets] of Object.entries(record.languages)) {
    const reference = await sourceText(record, assets, 'reference', `${language} reference`, repositoryRoot);
    if (reference.length > 262_144) throw new Error(`${language} reference exceeds the import source limit`);
    if (/https?:\/\/|\b(requests|socket|curl|wget)\b|\bfetch\s*\(/i.test(reference)) throw new Error(`${language} reference appears to require network access`);
    if (!sourceAgrees(language, reference, metadata.functionName)) throw new Error(`${language} reference does not agree with the problem signature`);
    await Promise.all([
      resolveAsset(record, assets.starterSource?.path, `${language} starter source`, repositoryRoot),
      resolveAsset(record, assets.solutionSource?.path, `${language} solution source`, repositoryRoot)
    ]);
    indexedLanguages[language] = {
      starter: assets.starterSource,
      solution: assets.solutionSource,
      ...(assets.provenance ? { solutionSource: assets.provenance } : {})
    };
  }
  if (!Object.keys(indexedLanguages).length) throw new Error('record has no supported language assets');
  return { frontendId: record.frontendId, slug: record.slug, problemId: problem.problemId, difficulty: metadata.difficulty, languages: Object.keys(indexedLanguages), status: 'indexed-source' };
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
    sources.push({
      adapter: source.adapter,
      name: source.name,
      revision: source.revision,
      ...(source.path ? { path: source.path } : {}),
      ...(source.paths ? { paths: source.paths } : {})
    });
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
      let problem = matchProblem(record, problems);
      if (problem?.generated && record.pack) problem = await createPack(record, repositoryRoot);
      if (!problem) problem = await createPack(record, repositoryRoot);
      if (!problem) {
        skipped.push({ frontendId: record.frontendId, slug: record.slug, reason: 'no matching complete CoJudge problem pack' });
        continue;
      }
      if (!problems.includes(problem)) problems.push(problem);
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
