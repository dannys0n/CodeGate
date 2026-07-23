import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { availableProblemCatalog, prepareChallenge } from './runtime-challenge';

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
    const bridgeRecord = JSON.stringify({ title: 'Bridge Example', difficulty: 'Beginner', hints: [], code_snippets: { python3: 'class Solution:\n    def bridge(self, value: int) -> int:\n        return 0\n' } });
    const bridgeSolution = 'class Solution:\n    def bridge(self, value):\n        return value\n';
    const bridgeDataset = JSON.stringify({ exact_cases: [
        { input: { value: 1 }, output: 1 },
        { input: { value: 2 }, output: 2 },
        { input: { value: 3 }, output: 3 }
    ] });
    const bridgeJudge = {
        kind: 'generated-exact',
        metadata: {
            id: 'bridge-example', title: '-1. Bridge Example', difficulty: 'Beginner',
            functionName: 'bridge', params: [{ name: 'value', type: 'int' }], outputType: 'int', hints: []
        },
        testRecord: locator(bridgeDataset, Buffer.byteLength(record + solution + bridgeRecord + bridgeSolution))
    };
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
    const bundle = record + solution + bridgeRecord + bridgeSolution + bridgeDataset;
    await fs.writeFile(path.join(root, 'codegate', 'candidate-assets.bin'), bundle);
    await fs.writeFile(path.join(root, 'codegate', 'candidate-manifest.json'), JSON.stringify({
        schemaVersion: 4,
        generatorVersion: 1,
        generatedAt: 'now',
        sourceRevision: 'fixture',
        assetBundle: { file: 'candidate-assets.bin', length: Buffer.byteLength(bundle), sha256: digest(bundle) },
        problems: {
            '-1': {
                slug: 'bridge-example', leetcodeDifficulty: 'Easy',
                record: locator(bridgeRecord, Buffer.byteLength(record + solution)),
                judgeSha256: digest(JSON.stringify(bridgeJudge)),
                judge: bridgeJudge,
                languages: {
                    python: {
                        solutionSource: 'codegate-bridge',
                        solution: locator(bridgeSolution, Buffer.byteLength(record + solution + bridgeRecord))
                    }
                }
            },
            '1': {
                slug: 'example', leetcodeDifficulty: 'Easy', record: locator(record), judgeSha256: judgeDigest(judgeFiles),
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

    it('keeps bridge problems out of random selection but permits an explicit catalogue choice', async () => {
        await fixture();
        await expect(prepareChallenge('python', '25', [], { root, random: () => 0 }))
            .resolves.toMatchObject({ problemId: 'example' });
        await expect(prepareChallenge('python', '25', [], {
            root,
            problemId: 'bridge-example',
            leetcodeDifficulties: ['Hard'],
            problemNumberRange: { min: 100, max: 200 }
        })).resolves.toMatchObject({
            problemId: 'bridge-example',
            title: '-1. Bridge Example',
            leetcodeDifficulty: 'Beginner'
        });
    });

    it('filters replacement candidates by LeetCode difficulty', async () => {
        await fixture();
        await expect(prepareChallenge('python', '25', [], { root, leetcodeDifficulties: ['Hard'] }))
            .rejects.toThrow('No python challenge is available');
    });

    it('filters replacement candidates by LeetCode problem number', async () => {
        await fixture();
        await expect(prepareChallenge('python', '25', [], { root, problemNumberRange: { min: 2, max: null } }))
            .rejects.toThrow('No python challenge is available');
    });

    it('lists catalogue entries under the active filters', async () => {
        await fixture();
        await expect(availableProblemCatalog('python', ['Easy'], { min: 1, max: 10 }, root))
            .resolves.toEqual([
                { problemId: 'bridge-example', number: -1, title: 'Bridge Example', leetcodeDifficulty: 'Beginner' },
                { problemId: 'example', number: 1, title: 'Example', leetcodeDifficulty: 'Easy' }
            ]);
        await expect(availableProblemCatalog('python', ['Hard'], { min: null, max: null }, root))
            .resolves.toEqual([
                { problemId: 'bridge-example', number: -1, title: 'Bridge Example', leetcodeDifficulty: 'Beginner' }
            ]);
    });
});
