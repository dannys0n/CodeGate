import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareChallenge } from './runtime-challenge';

let root: string | undefined;

afterEach(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    root = undefined;
});

function digest(contents: string): string {
    return createHash('sha256').update(contents).digest('hex');
}

function locator(contents: string, offset = 0) {
    return { offset, length: Buffer.byteLength(contents), sha256: digest(contents) };
}

function judgeDigest(files: Record<string, string>): string {
    const hash = createHash('sha256');
    for (const name of ['metadata.json', 'official-tests.json', 'Marker.java']) {
        hash.update(name).update('\0').update(files[name]).update('\0');
    }
    return hash.digest('hex');
}

async function fixture(): Promise<void> {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-runtime-'));
    const record = JSON.stringify({ title: 'Example', difficulty: 'Easy', hints: ['Use a lookup.'], code_snippets: { python3: 'class Solution:\n    def solve(self, value: int) -> List[int]:\n        ' } });
    const solution = 'class Solution:\n    def solve(self, value):\n        return [0]\n';
    const judgeFiles = {
        'metadata.json': JSON.stringify({ id: 'example', functionName: 'solve', params: [{ name: 'value', type: 'int' }], outputType: 'int_array' }),
        'official-tests.json': '[{"value":1}]',
        'Marker.java': 'class Marker { int[] solve(int value) { return null; } boolean isCorrect() { return false; } }'
    };
    const writes: Record<string, string> = {
        ...Object.fromEntries(Object.entries(judgeFiles).map(([name, contents]) => [`problems/example/${name}`, contents]))
    };
    for (const [name, contents] of Object.entries(writes)) {
        const target = path.join(root, name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, contents);
    }
    await fs.mkdir(path.join(root, 'codegate'));
    const bundle = record + solution;
    await fs.writeFile(path.join(root, 'codegate', 'candidate-assets.bin'), bundle);
    await fs.writeFile(path.join(root, 'codegate', 'candidate-manifest.json'), JSON.stringify({
        schemaVersion: 3,
        generatorVersion: 1,
        generatedAt: 'now',
        sourceRevision: 'fixture',
        assetBundle: { file: 'candidate-assets.bin', length: Buffer.byteLength(bundle), sha256: digest(bundle) },
        problems: {
            '1': {
                slug: 'example', record: locator(record), judgeSha256: judgeDigest(judgeFiles),
                languages: { python: { solutionSource: 'doocs', solution: locator(solution, Buffer.byteLength(record)) } }
            }
        },
        quarantine: []
    }));
}

describe('CodeGate runtime challenge preparation', () => {
    it('loads the selected candidate and generates difficulty source without judging it', async () => {
        await fixture();
        await expect(prepareChallenge('python', '25', [], { root })).resolves.toMatchObject({
            problemId: 'example',
            difficulty: '25',
            language: 'python'
        });
    });
});
