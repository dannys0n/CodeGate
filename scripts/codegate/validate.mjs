import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverCandidates } from './catalog.mjs';

const root = process.cwd();
const node = process.execPath;
const cli = path.join(root, 'bin', 'cojudge');

function submit(problemId, sourcePath) {
  return spawnSync(node, [cli, 'submit', problemId, sourcePath], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
    env: { ...process.env, NO_COLOR: '1' }
  });
}

function resultText(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '').trim();
}

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

const judgeDigests = new Map();
async function judgeDigest(problemId) {
  if (!judgeDigests.has(problemId)) {
    const problemRoot = path.join(root, 'problems', problemId);
    judgeDigests.set(problemId, digestFiles([
      path.join(problemRoot, 'metadata.json'),
      path.join(problemRoot, 'official-tests.json'),
      path.join(problemRoot, 'Marker.java')
    ]));
  }
  return judgeDigests.get(problemId);
}

const discovered = await discoverCandidates(root);
const playable = [];
const quarantine = [...discovered.quarantine];
const grouped = new Map();
for (const candidate of discovered.candidates) {
  const key = `${candidate.problemId}:${candidate.language}`;
  grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
}
const validatedAt = new Date().toISOString();

for (const candidates of grouped.values()) {
  const first = candidates[0];
  const incorrect = submit(first.problemId, first.incorrectPath);
  if (incorrect.status === 0 || !resultText(incorrect).includes('FAILED')) {
    quarantine.push({ problemId: first.problemId, language: first.language, reason: 'deliberately incorrect solution was not reliably rejected', output: resultText(incorrect) });
    continue;
  }

  const completion = submit(first.problemId, first.referencePath);
  if (completion.status !== 0 || !resultText(completion).includes('ACCEPTED')) {
    quarantine.push({ problemId: first.problemId, language: first.language, reason: 'reference completion failed official tests', output: resultText(completion) });
    continue;
  }

  for (const candidate of candidates) {
    const partial = submit(candidate.problemId, candidate.sourcePath);
    const partialOutput = resultText(partial);
    if (partial.status === 0 || !partialOutput.includes('FAILED')) {
      quarantine.push({
        problemId: candidate.problemId,
        language: candidate.language,
        scaffold: candidate.scaffold,
        reason: partial.status === 0 ? 'scaffold is already a passing solution' : 'scaffold is not a runnable, failing ordinary source file',
        output: partialOutput
      });
      continue;
    }
    playable.push({
      problemId: candidate.problemId,
      title: candidate.title,
      leetcodeDifficulty: candidate.leetcodeDifficulty,
      language: candidate.language,
      scaffold: candidate.scaffold,
      sourcePath: candidate.sourcePath,
      sourceSha256: await digestFiles([path.resolve(root, candidate.sourcePath)]),
      judgeSha256: await judgeDigest(candidate.problemId),
      validatedAt,
      validationStatus: 'validated'
    });
  }
}

const revisions = [...new Set(discovered.candidates.map((candidate) => candidate.sourceRevision))].sort();
const manifest = { schemaVersion: 1, generatedAt: validatedAt, sourceRevision: revisions.join(','), variants: playable };
const report = {
  schemaVersion: 1,
  generatedAt: validatedAt,
  candidates: discovered.candidates.length,
  playable: playable.length,
  quarantined: quarantine.length,
  quarantine
};

await fs.mkdir(path.join(root, 'codegate'), { recursive: true });
await Promise.all([
  fs.writeFile(path.join(root, 'codegate', 'playable-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
  fs.writeFile(path.join(root, 'codegate', 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`)
]);

console.log(JSON.stringify({ candidates: report.candidates, playable: report.playable, quarantined: report.quarantined }, null, 2));
if (playable.length === 0 || quarantine.length > 0) process.exitCode = 1;
