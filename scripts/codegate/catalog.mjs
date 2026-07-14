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

async function fileSha256(file) {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

export async function buildCandidateManifest(repositoryRoot = process.cwd(), configFile = 'codegate/import-leetcode.json') {
  const configPath = path.resolve(repositoryRoot, configFile);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const source = config.sources?.find((candidate) => candidate.adapter === 'leetcode-bundle');
  if (!source) throw new Error('candidate config has no leetcode-bundle source');
  const records = await loadLeetcodeBundle(source, { repositoryRoot, configDirectory: path.dirname(configPath) });
  const roots = {
    neenza: `${source.paths.neenza.replaceAll('\\', '/')}/problems`,
    doocs: `${source.paths.doocs.replaceAll('\\', '/')}/solution`,
    kamyu: source.paths.kamyu.replaceAll('\\', '/')
  };
  const problems = {};
  const quarantine = [];
  for (const record of records) {
    const problemRoot = path.join(repositoryRoot, 'problems', record.slug);
    const required = ['metadata.json', 'official-tests.json', 'Marker.java'];
    const completePack = await Promise.all(required.map((name) => fs.access(path.join(problemRoot, name)).then(() => true).catch(() => false))).then((values) => values.every(Boolean));
    if (!completePack) continue;
    if (record.adapterError) {
      quarantine.push({ problemId: record.slug, reason: record.adapterError });
      continue;
    }
    const recordPath = path.resolve(repositoryRoot, record.sourceRecord);
    const languages = {};
    for (const [language, assets] of Object.entries(record.languages ?? {})) {
      if (!supportedLanguages.includes(language) || !assets.solutionSource?.path) continue;
      const alias = assets.provenance;
      const root = roots[alias];
      if (!root) continue;
      const absoluteSolution = path.resolve(repositoryRoot, assets.solutionSource.path);
      languages[language] = {
        solutionSource: alias,
        solution: path.relative(path.resolve(repositoryRoot, root), absoluteSolution).replaceAll(path.sep, '/'),
        solutionSha256: await fileSha256(absoluteSolution)
      };
    }
    if (!Object.keys(languages).length) continue;
    problems[record.frontendId] = {
      slug: record.slug,
      record: path.relative(path.resolve(repositoryRoot, roots.neenza), recordPath).replaceAll(path.sep, '/'),
      recordSha256: await fileSha256(recordPath),
      judgeSha256: await digestFiles(required.map((name) => path.join(problemRoot, name))),
      languages
    };
  }
  return {
    schemaVersion: 2,
    generatorVersion: sourceTransformVersion,
    generatedAt: new Date().toISOString(),
    sourceRevision: source.revision,
    sources: roots,
    problems,
    quarantine
  };
}

export async function writeCandidateManifest(repositoryRoot = process.cwd()) {
  const manifest = await buildCandidateManifest(repositoryRoot);
  const target = path.join(repositoryRoot, 'codegate', 'candidate-manifest.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    const existing = JSON.parse(await fs.readFile(target, 'utf8'));
    const withoutTimestamp = ({ generatedAt: _generatedAt, ...value }) => value;
    if (JSON.stringify(withoutTimestamp(existing)) === JSON.stringify(withoutTimestamp(manifest))) return existing;
  } catch {
    // Missing or malformed indexes are replaced below.
  }
  await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--write')) {
    const generated = await writeCandidateManifest();
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
