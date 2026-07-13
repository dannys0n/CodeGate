import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertPlayableManifest, loadPlayableManifest } from './catalog';

let temporaryRoot: string | undefined;
afterEach(async () => { if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true }); });

function digest(files: Array<[string, Buffer]>) {
    const hash = createHash('sha256');
    for (const [name, contents] of files) hash.update(name).update('\0').update(contents).update('\0');
    return hash.digest('hex');
}

describe('CodeGate playable manifest validation', () => {
    it('accepts validated Python and C++ entries', () => {
        const manifest: unknown = {
            schemaVersion: 1,
            generatedAt: '2026-01-01T00:00:00.000Z',
            sourceRevision: 'fixture',
            variants: [{
                problemId: 'two-sum',
                title: 'Two Sum',
                leetcodeDifficulty: 'Easy',
                language: 'python',
                difficulty: '50',
                sourcePath: 'problems/two-sum/variants/python/50.py',
                sourceSha256: 'a'.repeat(64),
                judgeSha256: 'b'.repeat(64),
                validatedAt: '2026-01-01T00:00:00.000Z',
                validationStatus: 'validated'
            }]
        };
        expect(() => assertPlayableManifest(manifest)).not.toThrow();
    });

    it('rejects candidate entries that have not been validated', () => {
        expect(() => assertPlayableManifest({
            schemaVersion: 1,
            variants: [{
                problemId: 'two-sum',
                sourcePath: 'problems/two-sum/variants/python/50.py',
                language: 'python',
                difficulty: '50',
                validationStatus: 'candidate'
            }]
        })).toThrow(/Invalid playable variant/);
    });

    it('fails closed when validated source changes', async () => {
        temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-catalog-'));
        const sourcePath = 'problems/example/variants/python/50.py';
        const judgeFiles: Array<[string, Buffer]> = [
            ['metadata.json', Buffer.from('{}')],
            ['official-tests.json', Buffer.from('[]')],
            ['Marker.java', Buffer.from('class Marker {}')]
        ];
        const source = Buffer.from('class Solution:\n    pass\n');
        for (const [name, contents] of judgeFiles) {
            const target = path.join(temporaryRoot, 'problems', 'example', name);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, contents);
        }
        const sourceTarget = path.join(temporaryRoot, sourcePath);
        await fs.mkdir(path.dirname(sourceTarget), { recursive: true });
        await fs.writeFile(sourceTarget, source);
        const manifest = {
            schemaVersion: 1,
            generatedAt: '2026-01-01T00:00:00.000Z',
            sourceRevision: 'fixture',
            variants: [{
                problemId: 'example', title: 'Example', leetcodeDifficulty: 'Easy', language: 'python', difficulty: '50',
                sourcePath, sourceSha256: digest([['50.py', source]]), judgeSha256: digest(judgeFiles),
                validatedAt: '2026-01-01T00:00:00.000Z', validationStatus: 'validated'
            }]
        };
        await fs.mkdir(path.join(temporaryRoot, 'codegate'));
        await fs.writeFile(path.join(temporaryRoot, 'codegate', 'playable-manifest.json'), JSON.stringify(manifest));
        await expect(loadPlayableManifest(temporaryRoot)).resolves.toMatchObject({ variants: [{ problemId: 'example' }] });
        await fs.writeFile(sourceTarget, 'class Solution:\n    def changed(self): pass\n');
        await expect(loadPlayableManifest(temporaryRoot)).rejects.toThrow(/changed after validation/);
    });
});
