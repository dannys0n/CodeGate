import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareChallenge } from './runtime-validation';

let root: string | undefined;
const originalCache = process.env.CODEGATE_VALIDATION_CACHE;

afterEach(async () => {
    if (originalCache === undefined) delete process.env.CODEGATE_VALIDATION_CACHE;
    else process.env.CODEGATE_VALIDATION_CACHE = originalCache;
    if (root) await fs.rm(root, { recursive: true, force: true });
    root = undefined;
});

function rawDigest(contents: string): string {
    return createHash('sha256').update(contents).digest('hex');
}

function judgeDigest(files: Record<string, string>): string {
    const hash = createHash('sha256');
    for (const name of ['metadata.json', 'official-tests.json', 'Marker.java']) hash.update(name).update('\0').update(files[name]).update('\0');
    return hash.digest('hex');
}

async function fixture(solutionBody = 'return [0]'): Promise<void> {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-runtime-'));
    process.env.CODEGATE_VALIDATION_CACHE = path.join(root, 'cache', 'runtime.json');
    const record = JSON.stringify({ title: 'Example', difficulty: 'Easy', hints: ['Use a lookup.'], code_snippets: { python3: 'class Solution:\n    def solve(self, value: int) -> List[int]:\n        ' } });
    const solution = `class Solution:\n    def solve(self, value):\n        ${solutionBody}\n`;
    const judgeFiles = {
        'metadata.json': JSON.stringify({ id: 'example', functionName: 'solve', params: [{ name: 'value', type: 'int' }], outputType: 'int_array' }),
        'official-tests.json': '[{"value":1}]',
        'Marker.java': 'class Marker { int[] solve(int value) { return null; } boolean isCorrect() { return false; } }'
    };
    const writes: Record<string, string> = {
        'sources/neenza/problems/0001-example.json': record,
        'sources/doocs/solution/0001/Solution.py': solution,
        ...Object.fromEntries(Object.entries(judgeFiles).map(([name, contents]) => [`problems/example/${name}`, contents]))
    };
    for (const [name, contents] of Object.entries(writes)) {
        const target = path.join(root, name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, contents);
    }
    await fs.mkdir(path.join(root, 'codegate'));
    await fs.writeFile(path.join(root, 'codegate', 'candidate-manifest.json'), JSON.stringify({
        schemaVersion: 2,
        generatorVersion: 1,
        generatedAt: 'now',
        sourceRevision: 'fixture',
        sources: { neenza: 'sources/neenza/problems', doocs: 'sources/doocs/solution', kamyu: 'sources/kamyu', newfacade: 'sources/newfacade' },
        problems: {
            '1': {
                slug: 'example', record: '0001-example.json', recordSha256: rawDigest(record), judgeSha256: judgeDigest(judgeFiles),
                languages: { python: { solutionSource: 'doocs', solution: '0001/Solution.py', solutionSha256: rawDigest(solution) } }
            }
        },
        quarantine: []
    }));
}

function judgeFetch() {
    const jobs = new Map<string, string>();
    let submissions = 0;
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
            const code = JSON.parse(String(init.body)).code;
            const jobId = String(++submissions);
            jobs.set(jobId, code);
            return Response.json({ jobId });
        }
        const jobId = new URL(url, 'http://local').searchParams.get('jobId') ?? '';
        const accepted = jobs.get(jobId)?.includes('return [0]') ?? false;
        return Response.json({ ready: true, accepted, totalTc: 1, passedTc: 1 });
    };
    return { fetch, submissions: () => submissions };
}

describe('CodeGate runtime baseline validation', () => {
    it('validates the solution once while generating difficulty source in memory', async () => {
        await fixture();
        const judge = judgeFetch();
        await expect(prepareChallenge('python', '25', [], judge.fetch, { root })).resolves.toMatchObject({ problemId: 'example', difficulty: '25' });
        expect(judge.submissions()).toBe(1);
        await expect(prepareChallenge('python', '75', [], judge.fetch, { root })).resolves.toMatchObject({ problemId: 'example', difficulty: '75' });
        expect(judge.submissions()).toBe(1);
    });

    it('quarantines a rejected baseline solution', async () => {
        await fixture('return []');
        const judge = judgeFetch();
        await expect(prepareChallenge('python', '50', [], judge.fetch, { root })).rejects.toThrow(/No valid/);
        expect(judge.submissions()).toBe(1);
        await expect(prepareChallenge('python', '50', [], judge.fetch, { root })).rejects.toThrow(/No valid/);
        expect(judge.submissions()).toBe(1);
    });
});
