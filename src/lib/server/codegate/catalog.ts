import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { scaffoldLevels, type PlayableManifest, type PlayableVariant } from '../../codegate/types';

const supportedLanguages = new Set(['python', 'cpp']);
const supportedScaffolds = new Set<string>(scaffoldLevels);

export function assertPlayableManifest(value: unknown): asserts value is PlayableManifest {
    if (!value || typeof value !== 'object') throw new Error('Playable manifest must be an object');
    const manifest = value as Record<string, unknown>;
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.variants)) {
        throw new Error('Unsupported playable manifest schema');
    }
    for (const entry of manifest.variants) {
        if (!entry || typeof entry !== 'object') throw new Error('Invalid playable variant');
        const variant = entry as Record<string, unknown>;
        if (
            typeof variant.problemId !== 'string' ||
            typeof variant.sourcePath !== 'string' ||
            !/^[a-f0-9]{64}$/.test(String(variant.sourceSha256)) ||
            !/^[a-f0-9]{64}$/.test(String(variant.judgeSha256)) ||
            !supportedLanguages.has(String(variant.language)) ||
            !supportedScaffolds.has(String(variant.scaffold)) ||
            variant.validationStatus !== 'validated'
        ) {
            throw new Error(`Invalid playable variant for ${String(variant.problemId ?? 'unknown')}`);
        }
    }
}

export async function loadPlayableManifest(root = process.cwd()): Promise<PlayableManifest> {
    const manifestPath = path.join(root, 'codegate', 'playable-manifest.json');
    const value: unknown = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assertPlayableManifest(value);
    const judgeDigests = new Map<string, string>();
    for (const variant of value.variants) {
        const source = await readSafeFile(variant.sourcePath, root);
        if (sha256([[path.basename(variant.sourcePath), source]]) !== variant.sourceSha256) {
            throw new Error(`Playable source changed after validation: ${variant.problemId}/${variant.language}/${variant.scaffold}`);
        }
        let judgeDigest = judgeDigests.get(variant.problemId);
        if (!judgeDigest) {
            const problemRoot = `problems/${variant.problemId}`;
            const files = await Promise.all(['metadata.json', 'official-tests.json', 'Marker.java'].map(async (name) => [name, await readSafeFile(`${problemRoot}/${name}`, root)] as const));
            judgeDigest = sha256(files);
            judgeDigests.set(variant.problemId, judgeDigest);
        }
        if (judgeDigest !== variant.judgeSha256) throw new Error(`Judge assets changed after validation: ${variant.problemId}`);
    }
    return value;
}

function sha256(files: ReadonlyArray<readonly [string, Buffer]>): string {
    const hash = createHash('sha256');
    for (const [name, contents] of files) hash.update(name).update('\0').update(contents).update('\0');
    return hash.digest('hex');
}

async function readSafeFile(sourcePath: string, root: string): Promise<Buffer> {
    const absoluteRoot = path.resolve(root);
    const absoluteSource = path.resolve(root, sourcePath);
    const relative = path.relative(absoluteRoot, absoluteSource);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Variant source escapes repository root');
    return fs.readFile(absoluteSource);
}

export async function loadVariantSource(variant: PlayableVariant, root = process.cwd()): Promise<string> {
    const source = await readSafeFile(variant.sourcePath, root);
    if (sha256([[path.basename(variant.sourcePath), source]]) !== variant.sourceSha256) throw new Error('Variant source changed after validation');
    return source.toString('utf8');
}
