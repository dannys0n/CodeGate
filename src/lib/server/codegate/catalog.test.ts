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

function locator(contents: Buffer | string, offset = 0) {
    return { offset, length: Buffer.byteLength(contents), sha256: rawDigest(contents) };
}

function judgeDigest(files: Array<[string, Buffer]>) {
    const hash = createHash('sha256');
    for (const [name, contents] of files) hash.update(name).update('\0').update(contents).update('\0');
    return hash.digest('hex');
}

describe('CodeGate grouped candidate manifest', () => {
    it('accepts one problem containing multiple languages', () => {
        expect(() => assertCandidateManifest({
            schemaVersion: 4,
            assetBundle: { file: 'candidate-assets.bin', length: 4, sha256: 'e'.repeat(64) },
            problems: {
                '1': {
                    slug: 'two-sum', leetcodeDifficulty: 'Easy', record: { offset: 0, length: 1, sha256: 'a'.repeat(64) }, judgeSha256: 'b'.repeat(64),
                    languages: {
                        python: { solutionSource: 'doocs', solution: { offset: 1, length: 1, sha256: 'c'.repeat(64) } },
                        cpp: { solutionSource: 'kamyu', solution: { offset: 2, length: 1, sha256: 'd'.repeat(64) } }
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
        const bundle = Buffer.concat([record, solution]);
        const writes: Array<[string, Buffer]> = [
            ['codegate/candidate-assets.bin', bundle],
            ...judgeFiles.map(([name, contents]) => [`problems/example/${name}`, contents] as [string, Buffer])
        ];
        for (const [relative, contents] of writes) {
            const target = path.join(temporaryRoot, relative);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, contents);
        }
        const manifest = {
            schemaVersion: 4, generatorVersion: 1, generatedAt: 'now', sourceRevision: 'fixture',
            assetBundle: { file: 'candidate-assets.bin', length: bundle.length, sha256: rawDigest(bundle) },
            problems: { '1': { slug: 'example', leetcodeDifficulty: 'Easy', record: locator(record), judgeSha256: judgeDigest(judgeFiles), languages: { python: { solutionSource: 'doocs', solution: locator(solution, record.length) } } } },
            quarantine: []
        };
        await fs.mkdir(path.join(temporaryRoot, 'codegate'), { recursive: true });
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-manifest.json'), JSON.stringify(manifest));
        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).resolves.toMatchObject({ frontendId: '1' });
        bundle[record.length] ^= 0xff;
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-assets.bin'), bundle);
        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).rejects.toThrow(/changed after indexing/);
    });

    it('materializes one generated judge pack from an indexed test record', async () => {
        temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-generated-'));
        const record = JSON.stringify({ frontend_id: '1', title: 'Example', description: 'Solve it.', code_snippets: { python3: 'class Solution:\n    def solve(self, value: int) -> int:\n        pass' } });
        const solution = 'class Solution:\n    def solve(self, value):\n        return value\n';
        const dataset = JSON.stringify({ input_output: [{ input: 'value = 1', output: '1' }, { input: 'value = 2', output: '2' }, { input: 'value = 3', output: '3' }] });
        const recordBuffer = Buffer.from(record);
        const solutionBuffer = Buffer.from(solution);
        const datasetBuffer = Buffer.from(dataset);
        const bundle = Buffer.concat([recordBuffer, solutionBuffer, datasetBuffer]);
        const judge = {
            kind: 'generated-exact',
            metadata: { id: 'example', title: '1. Example', difficulty: 'Easy', functionName: 'solve', params: [{ name: 'value', type: 'int' }], outputType: 'int', hints: [] },
            testRecord: locator(datasetBuffer, recordBuffer.length + solutionBuffer.length)
        };
        await fs.mkdir(path.join(temporaryRoot, 'codegate'));
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-assets.bin'), bundle);
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-manifest.json'), JSON.stringify({
            schemaVersion: 4, generatorVersion: 1, generatedAt: 'now', sourceRevision: 'fixture',
            assetBundle: { file: 'candidate-assets.bin', length: bundle.length, sha256: rawDigest(bundle) },
            problems: { '1': { slug: 'example', leetcodeDifficulty: 'Easy', record: locator(recordBuffer), judgeSha256: rawDigest(JSON.stringify(judge)), judge, languages: { python: { solutionSource: 'doocs', solution: locator(solutionBuffer, recordBuffer.length) } } } },
            quarantine: []
        }));

        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).resolves.toMatchObject({ frontendId: '1' });
        const tests = JSON.parse(await fs.readFile(resolveProblemFile('example', 'official-tests.json'), 'utf8'));
        expect(tests).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
        const metadata = JSON.parse(await fs.readFile(resolveProblemFile('example', 'metadata.json'), 'utf8'));
        expect(metadata.testCases).toEqual(tests);
        expect(await fs.readFile(resolveProblemFile('example', 'Marker.java'), 'utf8')).toContain('if (value == 3) return 3;');
    });
});
