import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertCandidateManifest, loadCandidateAssets } from './catalog';

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
            sources: { neenza: 'sources/problems', doocs: 'sources/doocs', kamyu: 'sources/kamyu' },
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
            sources: { neenza: 'sources/problems', doocs: 'sources/doocs', kamyu: 'sources/kamyu' },
            problems: { '1': { slug: 'example', record: '0001-example.json', recordSha256: rawDigest(record), judgeSha256: judgeDigest(judgeFiles), languages: { python: { solutionSource: 'doocs', solution: '0001/solution.py', solutionSha256: rawDigest(solution) } } } },
            quarantine: []
        };
        await fs.mkdir(path.join(temporaryRoot, 'codegate'));
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'candidate-manifest.json'), JSON.stringify(manifest));
        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).resolves.toMatchObject({ frontendId: '1' });
        await fs.writeFile(path.join(temporaryRoot, 'sources/doocs/0001/solution.py'), 'changed');
        await expect(loadCandidateAssets('1', 'python', temporaryRoot)).rejects.toThrow(/changed after indexing/);
    });
});
