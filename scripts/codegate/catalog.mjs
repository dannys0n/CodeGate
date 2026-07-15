import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadLeetcodeBundle } from './importer/adapters/leetcode-bundle.mjs';
import { sourceTransformVersion } from '../../src/lib/codegate/source-transform.mjs';

export const supportedLanguages = ['java', 'python', 'cpp', 'csharp', 'rust', 'go', 'typescript'];

async function digestFiles(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.basename(file));
    hash.update('\0');
    hash.update(await fs.readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function valueSha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

class AssetBundle {
  constructor() {
    this.buffers = [];
    this.offset = 0;
    this.entries = new Map();
  }

  add(contents) {
    const sha256 = createHash('sha256').update(contents).digest('hex');
    const key = `${sha256}:${contents.length}`;
    const existing = this.entries.get(key);
    if (existing) return existing;
    const locator = { offset: this.offset, length: contents.length, sha256 };
    this.entries.set(key, locator);
    this.buffers.push(contents);
    this.offset += contents.length;
    return locator;
  }

  contents() {
    return Buffer.concat(this.buffers, this.offset);
  }
}

async function readSlice(file, offset, length) {
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    if (bytesRead !== length) throw new Error(`Truncated source record: ${file}`);
    return buffer;
  } finally {
    await handle.close();
  }
}

export async function buildCandidateCatalog(repositoryRoot = process.cwd(), configFile = 'codegate/import-leetcode.json') {
  const configPath = path.resolve(repositoryRoot, configFile);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const source = config.sources?.find((candidate) => candidate.adapter === 'leetcode-bundle');
  if (!source) throw new Error('candidate config has no leetcode-bundle source');
  const records = await loadLeetcodeBundle(source, { repositoryRoot, configDirectory: path.dirname(configPath) });
  const bundle = new AssetBundle();
  const problems = {};
  const quarantine = [];
  for (const record of records) {
    const problemRoot = path.join(repositoryRoot, 'problems', record.slug);
    const required = ['metadata.json', 'official-tests.json', 'Marker.java'];
    const completePack = await Promise.all(required.map((name) => fs.access(path.join(problemRoot, name)).then(() => true).catch(() => false))).then((values) => values.every(Boolean));
    if (record.adapterError) {
      quarantine.push({ problemId: record.slug, reason: record.adapterError });
      continue;
    }
    if (!completePack && !record.pack) {
      quarantine.push({ problemId: record.slug, reason: 'insufficient safe structured tests for a generated judge pack' });
      continue;
    }
    const recordPath = path.resolve(repositoryRoot, record.sourceRecord);
    const recordLocator = bundle.add(await fs.readFile(recordPath));
    const languages = {};
    for (const [language, assets] of Object.entries(record.languages ?? {})) {
      if (!supportedLanguages.includes(language) || !assets.solutionSource?.path) continue;
      const alias = assets.provenance;
      const absoluteSolution = path.resolve(repositoryRoot, assets.solutionSource.path);
      languages[language] = {
        solutionSource: alias,
        solution: bundle.add(await fs.readFile(absoluteSolution))
      };
    }
    if (!Object.keys(languages).length) continue;
    let judge;
    let judgeSha256;
    if (completePack) {
      judgeSha256 = await digestFiles(required.map((name) => path.join(problemRoot, name)));
    } else {
      const { starterCode: _starterCode, testCases: _testCases, ...metadata } = record.pack.metadata;
      const testContents = await readSlice(record.testLocator.file, record.testLocator.offset, record.testLocator.length);
      judge = {
        kind: 'generated-exact',
        metadata,
        testRecord: bundle.add(testContents)
      };
      judgeSha256 = valueSha256(judge);
    }
    problems[record.frontendId] = {
      slug: record.slug,
      record: recordLocator,
      judgeSha256,
      ...(judge ? { judge } : {}),
      languages
    };
  }
  const bundleContents = bundle.contents();
  return { manifest: {
    schemaVersion: 3,
    generatorVersion: sourceTransformVersion,
    generatedAt: new Date().toISOString(),
    sourceRevision: source.revision,
    assetBundle: {
      file: 'candidate-assets.bin',
      length: bundleContents.length,
      sha256: createHash('sha256').update(bundleContents).digest('hex')
    },
    problems,
    quarantine
  }, bundle: bundleContents };
}

export async function buildCandidateManifest(repositoryRoot = process.cwd(), configFile = 'codegate/import-leetcode.json') {
  return (await buildCandidateCatalog(repositoryRoot, configFile)).manifest;
}

export async function writeCandidateManifest(repositoryRoot = process.cwd()) {
  const { manifest, bundle } = await buildCandidateCatalog(repositoryRoot);
  const target = path.join(repositoryRoot, 'codegate', 'candidate-manifest.json');
  const bundleTarget = path.join(repositoryRoot, 'codegate', manifest.assetBundle.file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    const existing = JSON.parse(await fs.readFile(target, 'utf8'));
    const withoutTimestamp = ({ generatedAt: _generatedAt, ...value }) => value;
    if (JSON.stringify(withoutTimestamp(existing)) === JSON.stringify(withoutTimestamp(manifest))) {
      const stat = await fs.stat(bundleTarget);
      if (stat.size === bundle.length) return existing;
    }
  } catch {
    // Missing or malformed indexes are replaced below.
  }
  await fs.writeFile(bundleTarget, bundle);
  await fs.writeFile(target, `${JSON.stringify(manifest)}\n`);
  return manifest;
}

export async function ensureCandidateManifest(repositoryRoot = process.cwd(), configFile = 'codegate/import-leetcode.json') {
  try {
    const config = JSON.parse(await fs.readFile(path.resolve(repositoryRoot, configFile), 'utf8'));
    const source = config.sources?.find((candidate) => candidate.adapter === 'leetcode-bundle');
    const target = path.join(repositoryRoot, 'codegate', 'candidate-manifest.json');
    const manifest = JSON.parse(await fs.readFile(target, 'utf8'));
    if (manifest.schemaVersion !== 3 || manifest.generatorVersion !== sourceTransformVersion || manifest.sourceRevision !== source?.revision || !manifest.assetBundle?.file) throw new Error('stale catalog');
    const stat = await fs.stat(path.join(repositoryRoot, 'codegate', manifest.assetBundle.file));
    if (stat.size !== manifest.assetBundle.length) throw new Error('incomplete asset bundle');
    return manifest;
  } catch {
    return writeCandidateManifest(repositoryRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--write') || process.argv.includes('--ensure')) {
    const generated = process.argv.includes('--ensure') ? await ensureCandidateManifest() : await writeCandidateManifest();
    const problemCount = Object.keys(generated.problems).length;
    const languageCount = Object.values(generated.problems).reduce((total, problem) => total + Object.keys(problem.languages).length, 0);
    console.log(JSON.stringify({ problems: problemCount, problemLanguages: languageCount, quarantinedProblems: generated.quarantine.length }, null, 2));
    if (problemCount === 0) process.exitCode = 1;
  } else {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'codegate', 'candidate-manifest.json'), 'utf8'));
    const problemCount = Object.keys(manifest.problems ?? {}).length;
    const languageCount = Object.values(manifest.problems ?? {}).reduce((total, problem) => total + Object.keys(problem.languages ?? {}).length, 0);
    console.log(JSON.stringify({ problems: problemCount, problemLanguages: languageCount, quarantinedProblems: manifest.quarantine?.length ?? 0 }, null, 2));
    if (problemCount === 0) process.exitCode = 1;
  }
}
