import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createServer } from 'vite';
import { normalizeSource } from '../../src/lib/codegate/source-transform.mjs';

const gzipAsync = promisify(gzip);
const root = process.cwd();
const outputArgument = process.argv.find((value) => value.startsWith('--output='));
const outputIndex = process.argv.indexOf('--output');
const requestedOutput = outputArgument?.slice('--output='.length)
  ?? (outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined)
  ?? 'android-export';
const outputRoot = path.resolve(root, requestedOutput);
const manifestPath = path.join(root, 'codegate', 'candidate-manifest.json');

function safeOutputPath(name) {
  const target = path.resolve(outputRoot, name);
  const relative = path.relative(outputRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Invalid output path: ${name}`);
  return target;
}

function readSlice(bundle, locator) {
  return bundle.subarray(locator.offset, locator.offset + locator.length);
}

function strings(value) {
  return Array.isArray(value) ? value.map(String).filter((item) => item.trim()) : [];
}

function examples(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry?.example_text ?? entry?.text ?? '')).filter((item) => item.trim());
}

async function functionName(problem) {
  const generated = problem.judge?.metadata?.functionName;
  if (typeof generated === 'string' && generated) return generated;
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'problems', problem.slug, 'metadata.json'), 'utf8'));
  if (typeof metadata.functionName !== 'string' || !metadata.functionName) throw new Error(`Missing function name for ${problem.slug}`);
  return metadata.functionName;
}

function fallbackPartition(source) {
  return {
    fixedPrefix: '',
    fixedSuffix: '',
    blocks: [{ id: 'block-1', code: source, displayCode: source.trim() }]
  };
}

const readme = `# CodeGate Android content pack

This directory is a complete, portable content export for the native Android Algorithm Assembly prototype.
It contains problem text and pre-generated C++/Python assembly lessons. It does not require the CodeGate
source repositories, Docker, CoJudge, Node.js, or a compiler at Android runtime.

## Copy into Android Studio

Copy this entire directory to:

\`app/src/main/assets/codegate/\`

Read \`index.json\` first. Each listed shard is UTF-8 JSON compressed with gzip. Android can open a shard with
\`context.assets.open("codegate/<file>")\` and \`java.util.zip.GZIPInputStream\`.

The correct answer is \`correctOrder\`. Shuffle the block IDs on-device. Display \`displayCode\`; retain
\`sourceCode\` only to reconstruct the exact reference solution after completion.

Regenerate from desktop CodeGate with:

\`npm run codegate:export:android\`
`;

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const bundle = await fs.readFile(path.join(root, 'codegate', manifest.assetBundle.file));
  const vite = await createServer({ root, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  let splitAssemblySource;
  try {
    ({ splitAssemblySource } = await vite.ssrLoadModule('/src/lib/codegate/algorithm-assembly-source.ts'));
  } finally {
    await vite.close();
  }

  await fs.mkdir(outputRoot, { recursive: true });
  const shardMap = new Map();
  let fallbackCount = 0;

  for (const [problemId, problem] of Object.entries(manifest.problems)) {
    const record = JSON.parse(readSlice(bundle, problem.record).toString('utf8'));
    const difficulty = ['Beginner', 'Easy', 'Medium', 'Hard'].includes(record.difficulty)
      ? record.difficulty
      : problem.leetcodeDifficulty;
    const name = await functionName(problem);
    for (const language of ['cpp', 'python']) {
      const languageEntry = problem.languages[language];
      if (!languageEntry) continue;
      const raw = readSlice(bundle, languageEntry.solution).toString('utf8');
      const source = normalizeSource(language, raw, name, 'solution');
      if (!source) throw new Error(`Unable to normalize ${problem.slug}/${language}`);
      let partition;
      let usedFallback = false;
      try {
        partition = splitAssemblySource(source, language);
      } catch {
        partition = fallbackPartition(source);
        fallbackCount += 1;
        usedFallback = true;
      }
      const key = `${language}-${String(difficulty).toLowerCase()}`;
      if (!shardMap.has(key)) shardMap.set(key, []);
      shardMap.get(key).push({
        id: `${problemId}-${language}`,
        problemId,
        slug: problem.slug,
        title: String(record.title ?? problem.catalogTitle ?? problem.slug),
        difficulty,
        language,
        statement: String(record.description ?? ''),
        examples: examples(record.examples),
        constraints: strings(record.constraints),
        hints: strings(record.hints),
        fixedPrefix: partition.fixedPrefix,
        fixedSuffix: partition.fixedSuffix,
        blocks: partition.blocks.map((block) => ({ id: block.id, displayCode: block.displayCode, sourceCode: block.code })),
        correctOrder: partition.blocks.map((block) => block.id),
        singleCardFallback: usedFallback
      });
    }
  }

  const shards = [];
  for (const [key, lessons] of [...shardMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lessons.sort((left, right) => Number(left.problemId) - Number(right.problemId));
    const file = `${key}.json.gz`;
    const payload = JSON.stringify({ schemaVersion: 1, lessons });
    const compressed = await gzipAsync(Buffer.from(payload), { level: 9 });
    await fs.writeFile(safeOutputPath(file), compressed);
    const [language, difficulty] = key.split('-');
    shards.push({ language, difficulty, file, count: lessons.length, compressedBytes: compressed.length });
  }

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRevision: manifest.sourceRevision,
    languages: ['cpp', 'python'],
    totalLessons: shards.reduce((sum, shard) => sum + shard.count, 0),
    singleCardFallbacks: fallbackCount,
    shards
  };
  await Promise.all([
    fs.writeFile(safeOutputPath('index.json'), `${JSON.stringify(index, null, 2)}\n`),
    fs.writeFile(safeOutputPath('README.md'), readme)
  ]);
  console.log(`Exported ${index.totalLessons} Android lessons to ${outputRoot}`);
  console.log(`Used a full-solution single card for ${fallbackCount} otherwise-unpartitionable lessons.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
