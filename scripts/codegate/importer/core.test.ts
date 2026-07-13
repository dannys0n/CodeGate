import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runImport } from './core.mjs';

let root: string | undefined;

async function write(relative: string, value: string) {
  const target = path.join(root!, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value);
}

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe('offline importer', () => {
  it('matches by identity, rejects conflicts, reports skips, and is byte-idempotent', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-import-'));
    const metadata = {
      id: 'example', title: '1. Example', difficulty: 'Easy', functionName: 'answer',
      params: [{ name: 'value', type: 'int' }], outputType: 'int', hints: [],
      starterCode: { python: 'class Solution:\n    def answer(self, value: int) -> int:\n        return 0\n' }
    };
    await write('problems/example/metadata.json', `${JSON.stringify(metadata)}\n`);
    await write('problems/example/statement.md', '# Example\n');
    await write('problems/example/official-tests.json', '[{"value":1}]\n');
    await write('problems/example/Marker.java', 'class Marker { int answer(int value) { return value; } boolean isCorrect(int value, int output) { return value == output; } }\n');
    await write('fixtures/reference.py', 'class Solution:\n    def answer(self, value: int) -> int:\n        return value\n');
    await write('fixtures/incorrect.py', 'class Solution:\n    def answer(self, value: int) -> int:\n        return 0\n');
    const records = [
      { frontendId: '1', slug: 'example', shape: 'function', languages: { python: { reference: 'reference.py', incorrect: 'incorrect.py' } } },
      { frontendId: '2', slug: 'not-in-repository', shape: 'function', languages: { python: {} } },
      { frontendId: '3', slug: 'conflict-a', shape: 'function', languages: { python: {} } },
      { frontendId: '3', slug: 'conflict-b', shape: 'function', languages: { python: {} } }
    ];
    await write('fixtures/records.json', `${JSON.stringify(records)}\n`);
    await write('fixtures/config.json', `${JSON.stringify({
      schemaVersion: 1, generatedAt: '2026-01-01T00:00:00.000Z', report: 'codegate/import-report.json',
      sources: [{ adapter: 'local-json', name: 'fixture', revision: 'abc123', path: 'records.json' }]
    })}\n`);

    const config = path.join(root, 'fixtures', 'config.json');
    const first = await runImport(config, root);
    const firstReport = await fs.readFile(path.join(root, 'codegate', 'import-report.json'), 'utf8');
    const firstConfig = await fs.readFile(path.join(root, 'problems', 'example', 'codegate.json'), 'utf8');
    const second = await runImport(config, root);

    expect(first).toEqual(second);
    expect(first.accepted).toHaveLength(1);
    expect(first.skipped).toHaveLength(1);
    expect(first.failed).toHaveLength(2);
    expect(await fs.readFile(path.join(root, 'codegate', 'import-report.json'), 'utf8')).toBe(firstReport);
    expect(await fs.readFile(path.join(root, 'problems', 'example', 'codegate.json'), 'utf8')).toBe(firstConfig);
    expect(await fs.readFile(path.join(root, 'problems', 'example', 'variants', 'python', '25.py'), 'utf8')).toContain('TODO: restore');
  });
});
