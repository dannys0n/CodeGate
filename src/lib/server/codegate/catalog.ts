import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { gateLanguages, type AssetLocator, type CandidateLanguage, type CandidateManifest, type CandidateProblem, type DifficultyLevel, type GateLanguage } from '../../codegate/types';
import { normalizeSource, starterField, stripSolution } from '../../codegate/source-transform.mjs';
import { deactivateGeneratedProblem, materializeGeneratedProblem } from '../problem-files';
import { extractExactCases } from '../../codegate/test-vectors.mjs';

const supportedLanguages = new Set<string>(gateLanguages);
const manifestCache = new Map<string, { mtimeMs: number; size: number; manifest: CandidateManifest }>();
const defaultAppRoot = () => process.env.CODEGATE_APP_ROOT || process.cwd();

export function assertCandidateManifest(value: unknown): asserts value is CandidateManifest {
    if (!value || typeof value !== 'object') throw new Error('Candidate manifest must be an object');
    const manifest = value as Record<string, unknown>;
    if (manifest.schemaVersion !== 3 || !isLocator((manifest.assetBundle as Record<string, unknown> | undefined), true) || typeof manifest.problems !== 'object' || !manifest.problems || !Array.isArray(manifest.quarantine)) {
        throw new Error('Unsupported candidate manifest schema');
    }
    for (const [frontendId, entry] of Object.entries(manifest.problems as Record<string, unknown>)) {
        if (!/^\d+$/.test(frontendId) || !entry || typeof entry !== 'object') throw new Error('Invalid CodeGate problem');
        const problem = entry as Record<string, unknown>;
        if (
            typeof problem.slug !== 'string' || !isLocator(problem.record as Record<string, unknown>) ||
            !/^[a-f0-9]{64}$/.test(String(problem.judgeSha256)) ||
            !problem.languages || typeof problem.languages !== 'object'
        ) {
            throw new Error(`Invalid candidate problem ${frontendId}`);
        }
        const languages = Object.entries(problem.languages as Record<string, unknown>);
        if (!languages.length) throw new Error(`Candidate problem ${frontendId} has no languages`);
        if (problem.judge !== undefined) {
            const judge = problem.judge as Record<string, unknown>;
            const testRecord = judge.testRecord as Record<string, unknown> | undefined;
            if (judge.kind !== 'generated-exact' || !judge.metadata || typeof judge.metadata !== 'object' || !isLocator(testRecord)) {
                throw new Error(`Invalid generated judge data for ${frontendId}`);
            }
        }
        for (const [language, value] of languages) {
            const solution = value as Record<string, unknown>;
            if (!supportedLanguages.has(language) || !solution || typeof solution.solutionSource !== 'string' || !isLocator(solution.solution as Record<string, unknown>)) {
                throw new Error(`Invalid ${language} candidate for ${frontendId}`);
            }
        }
    }
}

function isLocator(value: Record<string, unknown> | undefined, bundle = false): boolean {
    if (!value || !Number.isSafeInteger(bundle ? value.length : value.offset) || !Number.isSafeInteger(value.length) || Number(value.length) < 0 || !/^[a-f0-9]{64}$/.test(String(value.sha256))) return false;
    return bundle ? typeof value.file === 'string' && value.file.length > 0 : Number(value.offset) >= 0;
}

export async function loadCandidateManifest(root = defaultAppRoot()): Promise<CandidateManifest> {
    const manifestPath = path.join(root, 'codegate', 'candidate-manifest.json');
    const stat = await fs.stat(manifestPath);
    const cached = manifestCache.get(manifestPath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.manifest;
    const value: unknown = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assertCandidateManifest(value);
    manifestCache.set(manifestPath, { mtimeMs: stat.mtimeMs, size: stat.size, manifest: value });
    return value;
}

function rawSha256(contents: Buffer): string {
    return createHash('sha256').update(contents).digest('hex');
}

export type CandidateAssets = {
    frontendId: string;
    problem: CandidateProblem;
    language: CandidateLanguage;
    record: Record<string, any>;
    starter: string;
    solution: string;
};

export async function loadCandidateAssets(frontendId: string, language: GateLanguage, root = defaultAppRoot()): Promise<CandidateAssets> {
    const manifest = await loadCandidateManifest(root);
    const problem = manifest.problems[frontendId];
    const languageEntry = problem?.languages[language];
    if (!problem || !languageEntry) throw new Error(`No ${language} source is indexed for problem ${frontendId}`);
    const assetRoot = process.env.CODEGATE_ASSET_ROOT || root;
    const bundlePath = path.posix.join('codegate', manifest.assetBundle.file);
    const [recordContents, solutionContents] = await Promise.all([
        readSafeSlice(bundlePath, problem.record, assetRoot),
        readSafeSlice(bundlePath, languageEntry.solution, assetRoot)
    ]);
    if (rawSha256(recordContents) !== problem.record.sha256) throw new Error(`Problem record changed after indexing: ${problem.slug}`);
    if (rawSha256(solutionContents) !== languageEntry.solution.sha256) throw new Error(`Solution changed after indexing: ${problem.slug}/${language}`);
    const record = JSON.parse(recordContents.toString('utf8'));
    let metadata: Record<string, any>;
    if (problem.judge) {
        if (rawSha256(Buffer.from(JSON.stringify(problem.judge))) !== problem.judgeSha256) throw new Error(`Generated judge data changed after indexing: ${problem.slug}`);
        metadata = problem.judge.metadata;
        const datasetContents = await readSafeSlice(bundlePath, problem.judge.testRecord, assetRoot);
        if (rawSha256(datasetContents) !== problem.judge.testRecord.sha256) throw new Error(`Test record changed after indexing: ${problem.slug}`);
        const cases = extractExactCases(JSON.parse(datasetContents.toString('utf8')), metadata as any);
        if (cases.length < 3) throw new Error(`Insufficient valid tests after loading: ${problem.slug}`);
        await materializeGeneratedProblem(problem, record, cases as Array<{ input: Record<string, unknown>; output: unknown }>);
    } else {
        await deactivateGeneratedProblem();
        const metadataContents = await readSafeFile(`problems/${problem.slug}/metadata.json`, root);
        metadata = JSON.parse(metadataContents.toString('utf8'));
        const problemRoot = `problems/${problem.slug}`;
        const judgeFiles = await Promise.all(['metadata.json', 'official-tests.json', 'Marker.java'].map(async (name) => [name, await readSafeFile(`${problemRoot}/${name}`, root)] as const));
        if (sha256(judgeFiles) !== problem.judgeSha256) throw new Error(`Judge assets changed after indexing: ${problem.slug}`);
    }
    const field = starterField(language);
    const rawStarter = record.code_snippets?.[field];
    if (typeof rawStarter !== 'string' || !rawStarter.trim()) throw new Error(`Missing ${language} starter for ${problem.slug}`);
    const starter = normalizeSource(language, rawStarter, metadata.functionName, 'starter');
    const solution = normalizeSource(language, solutionContents.toString('utf8'), metadata.functionName, 'solution');
    if (!starter || !solution) throw new Error(`Unable to normalize ${problem.slug}/${language}`);
    return { frontendId, problem, language: languageEntry, record, starter, solution };
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
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Indexed source escapes repository root');
    return fs.readFile(absoluteSource);
}

async function readSafeSlice(sourcePath: string, locator: AssetLocator, root: string): Promise<Buffer> {
    const absoluteRoot = path.resolve(root);
    const absoluteSource = path.resolve(root, sourcePath);
    const relative = path.relative(absoluteRoot, absoluteSource);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Indexed source escapes repository root');
    const handle = await fs.open(absoluteSource, 'r');
    try {
        const buffer = Buffer.alloc(locator.length);
        const { bytesRead } = await handle.read(buffer, 0, locator.length, locator.offset);
        if (bytesRead !== locator.length) throw new Error('Indexed asset bundle is truncated');
        return buffer;
    } finally {
        await handle.close();
    }
}

export async function loadChallengeSource(problemId: string, language: GateLanguage, difficulty: DifficultyLevel, root = defaultAppRoot()): Promise<string> {
    const manifest = await loadCandidateManifest(root);
    const entry = Object.entries(manifest.problems).find(([, problem]) => problem.slug === problemId);
    if (!entry) throw new Error(`Problem is not indexed: ${problemId}`);
    const assets = await loadCandidateAssets(entry[0], language, root);
    if (difficulty === '0') return assets.starter;
    if (difficulty === '100') return assets.solution;
    return stripSolution(assets.solution, language, Number(difficulty), assets.record.hints ?? []);
}
