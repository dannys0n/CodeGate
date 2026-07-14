import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertCandidateManifest, loadCandidateAssets } from './catalog';
import { resolveProblemFile } from '../problem-files';

let temporaryRoot: string | undefined;
afterEach(async () => { if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true }); });

function rawDigest(value: Buffer | string) {
    return createHash('sha256').update(value).digest('hex');
}

function judgeDigest(files: Array<[string, Buffer]>) {
    const hash = createHash('sha256');
    for (const [name, contents] of files) hash.update(name).update('\0').update(contents).update('\0');
    return hash.digest('hex');
}

describe('CodeGate grouped candidate manifest', () => {
    it('accepts one problem containing multiple languages', () => {
        expect(() => assertCandidateManifest({
            schemaVersion: 2,
            sources: { neenza: 'sources/problems', doocs: 'sources/doocs', kamyu: 'sources/kamyu', newfacade: 'sources/newfacade' },
            problems: {
                '1': {
                    slug: 'two-sum', record: '0001-two-sum.json', recordSha256: 'a'.repeat(64), judgeSha256: 'b'.repeat(64),
                    languages: {
                        python: { solutionSource: 'doocs', solution: '0001/solution.py', solutionSha256: 'c'.repeat(64) },
                        cpp: { solutionSource: 'kamyu', solution: 'C++/two-sum.cpp', solutionSha256: 'd'.repeat(64) }
                    }
                }
            },
            quarantine: []
        })).not.toThrow();
    });

    it('loads indexed sources and fails closed after a source changes', async () => {
        temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-catalog-'));
        const record = Buffer.from(JSON.stringify({ code_snippets: { python3: 'class Solution:\n    def solve(self, value):\n        pass' } }));
        const solution = Buffer.from('class Solution:\n    def solve(self, value):\n        return value\n');
        const metadata = Buffer.from(JSON.stringify({ id: 'example', functionName: 'solve' }));
        const judgeFiles: Array<[string, Buffer]> = [
            ['metadata.json', metadata], ['official-tests.json', Buffer.from('[]')], ['Marker.java', Buffer.from('class Marker {}')]
        ];
        const writes: Array<[string, Buffer]> = [
            ['sources/problems/0001-example.json', record], ['sources/doocs/0001/solution.py', solution],
            ...judgeFiles.map(([name, contents]) => [`problems/example/${name}`, contents] as [string, Buffer])
        ];
        for (const [relative, contents] of writes) {
            const target = path.join(temporaryRoot, relative);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, contents);
        }
        const manifest = {
            schemaVersion: 2, generatorVersion: 1, generatedAt: 'now', sourceRevision: 'fixture',
            sources: { neenza: 'sources/problems', doocs: 'sources/doocs', kamyu: 'sources/kamyu', newfacade: 'sources/newfacade' },
            problems: { '1': { slug: 'example', record: '0001-example.json', recordSha256: rawDigest(record), judgeSha256: judgeDigest(judgeFiles), languages: { python: { solutionSource: 'doocs', solution: '0001/solution.py', solutionSha256: rawDigest(solution) } } } },
            quarantine: []
        };
        await fs.mkdir(path.join(temporaryRoot, 'codegate'));
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-manifest.json'), JSON.stringify(manifest));
        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).resolves.toMatchObject({ frontendId: '1' });
        await fs.writeFile(path.join(temporaryRoot, 'sources/doocs/0001/solution.py'), 'changed');
        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).rejects.toThrow(/changed after indexing/);
    });

    it('materializes one generated judge pack from an indexed test record', async () => {
        temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-generated-'));
        const record = JSON.stringify({ frontend_id: '1', title: 'Example', description: 'Solve it.', code_snippets: { python3: 'class Solution:\n    def solve(self, value: int) -> int:\n        pass' } });
        const solution = 'class Solution:\n    def solve(self, value):\n        return value\n';
        const dataset = JSON.stringify({ input_output: [{ input: 'value = 1', output: '1' }, { input: 'value = 2', output: '2' }, { input: 'value = 3', output: '3' }] });
        const judge = {
            kind: 'generated-exact',
            metadata: { id: 'example', title: '1. Example', difficulty: 'Easy', functionName: 'solve', params: [{ name: 'value', type: 'int' }], outputType: 'int', hints: [] },
            testRecord: { file: 'dataset.jsonl', offset: 0, length: Buffer.byteLength(dataset), sha256: rawDigest(dataset) }
        };
        const writes: Array<[string, string]> = [
            ['sources/problems/0001-example.json', record], ['sources/doocs/0001/Solution.py', solution], ['sources/newfacade/dataset.jsonl', dataset]
        ];
        for (const [relative, contents] of writes) {
            const target = path.join(temporaryRoot, relative);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, contents);
        }
        await fs.mkdir(path.join(temporaryRoot, 'codegate'));
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-manifest.json'), JSON.stringify({
            schemaVersion: 2, generatorVersion: 1, generatedAt: 'now', sourceRevision: 'fixture',
            sources: { neenza: 'sources/problems', doocs: 'sources/doocs', kamyu: 'sources/kamyu', newfacade: 'sources/newfacade' },
            problems: { '1': { slug: 'example', record: '0001-example.json', recordSha256: rawDigest(record), judgeSha256: rawDigest(JSON.stringify(judge)), judge, languages: { python: { solutionSource: 'doocs', solution: '0001/Solution.py', solutionSha256: rawDigest(solution) } } } },
            quarantine: []
        }));

        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).resolves.toMatchObject({ frontendId: '1' });
        const tests = JSON.parse(await fs.readFile(resolveProblemFile('example', 'official-tests.json'), 'utf8'));
        expect(tests).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
        expect(await fs.readFile(resolveProblemFile('example', 'Marker.java'), 'utf8')).toContain('if (value == 3) return 3;');
    });
});
