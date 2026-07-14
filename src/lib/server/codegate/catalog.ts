import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { gateLanguages, type CandidateLanguage, type CandidateManifest, type CandidateProblem, type DifficultyLevel, type GateLanguage } from '../../codegate/types';
import { normalizeSource, starterField, stripSolution } from '../../codegate/source-transform.mjs';

const supportedLanguages = new Set<string>(gateLanguages);

export function assertCandidateManifest(value: unknown): asserts value is CandidateManifest {
    if (!value || typeof value !== 'object') throw new Error('Candidate manifest must be an object');
    const manifest = value as Record<string, unknown>;
    if (manifest.schemaVersion !== 2 || typeof manifest.sources !== 'object' || !manifest.sources || typeof manifest.problems !== 'object' || !manifest.problems || !Array.isArray(manifest.quarantine)) {
        throw new Error('Unsupported candidate manifest schema');
    }
    const sources = manifest.sources as Record<string, unknown>;
    if (typeof sources.neenza !== 'string' || typeof sources.doocs !== 'string' || typeof sources.kamyu !== 'string') {
        throw new Error('Candidate manifest source roots are incomplete');
    }
    for (const [frontendId, entry] of Object.entries(manifest.problems as Record<string, unknown>)) {
        if (!/^\d+$/.test(frontendId) || !entry || typeof entry !== 'object') throw new Error('Invalid CodeGate problem');
        const problem = entry as Record<string, unknown>;
        if (
            typeof problem.slug !== 'string' || typeof problem.record !== 'string' ||
            !/^[a-f0-9]{64}$/.test(String(problem.recordSha256)) || !/^[a-f0-9]{64}$/.test(String(problem.judgeSha256)) ||
            !problem.languages || typeof problem.languages !== 'object'
        ) {
            throw new Error(`Invalid candidate problem ${frontendId}`);
        }
        const languages = Object.entries(problem.languages as Record<string, unknown>);
        if (!languages.length) throw new Error(`Candidate problem ${frontendId} has no languages`);
        for (const [language, value] of languages) {
            const solution = value as Record<string, unknown>;
            if (!supportedLanguages.has(language) || !solution || typeof solution.solutionSource !== 'string' || typeof solution.solution !== 'string' || !/^[a-f0-9]{64}$/.test(String(solution.solutionSha256))) {
                throw new Error(`Invalid ${language} candidate for ${frontendId}`);
            }
        }
    }
}

export async function loadCandidateManifest(root = process.cwd()): Promise<CandidateManifest> {
    const manifestPath = path.join(root, 'codegate', 'candidate-manifest.json');
    const value: unknown = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assertCandidateManifest(value);
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

export async function loadCandidateAssets(frontendId: string, language: GateLanguage, root = process.cwd()): Promise<CandidateAssets> {
    const manifest = await loadCandidateManifest(root);
    const problem = manifest.problems[frontendId];
    const languageEntry = problem?.languages[language];
    if (!problem || !languageEntry) throw new Error(`No ${language} source is indexed for problem ${frontendId}`);
    const recordPath = path.posix.join(manifest.sources.neenza, problem.record);
    const solutionRoot = manifest.sources[languageEntry.solutionSource];
    if (!solutionRoot) throw new Error(`Unknown solution source: ${languageEntry.solutionSource}`);
    const [recordContents, solutionContents, metadataContents] = await Promise.all([
        readSafeFile(recordPath, root),
        readSafeFile(path.posix.join(solutionRoot, languageEntry.solution), root),
        readSafeFile(`problems/${problem.slug}/metadata.json`, root)
    ]);
    if (rawSha256(recordContents) !== problem.recordSha256) throw new Error(`Problem record changed after indexing: ${problem.slug}`);
    if (rawSha256(solutionContents) !== languageEntry.solutionSha256) throw new Error(`Solution changed after indexing: ${problem.slug}/${language}`);
    const metadata = JSON.parse(metadataContents.toString('utf8'));
    const record = JSON.parse(recordContents.toString('utf8'));
    const field = starterField(language);
    const rawStarter = record.code_snippets?.[field];
    if (typeof rawStarter !== 'string' || !rawStarter.trim()) throw new Error(`Missing ${language} starter for ${problem.slug}`);
    const starter = normalizeSource(language, rawStarter, metadata.functionName, 'starter');
    const solution = normalizeSource(language, solutionContents.toString('utf8'), metadata.functionName, 'solution');
    if (!starter || !solution) throw new Error(`Unable to normalize ${problem.slug}/${language}`);
    const problemRoot = `problems/${problem.slug}`;
    const judgeFiles = await Promise.all(['metadata.json', 'official-tests.json', 'Marker.java'].map(async (name) => [name, await readSafeFile(`${problemRoot}/${name}`, root)] as const));
    if (sha256(judgeFiles) !== problem.judgeSha256) throw new Error(`Judge assets changed after indexing: ${problem.slug}`);
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

export async function loadChallengeSource(problemId: string, language: GateLanguage, difficulty: DifficultyLevel, root = process.cwd()): Promise<string> {
    const manifest = await loadCandidateManifest(root);
    const entry = Object.entries(manifest.problems).find(([, problem]) => problem.slug === problemId);
    if (!entry) throw new Error(`Problem is not indexed: ${problemId}`);
    const assets = await loadCandidateAssets(entry[0], language, root);
    if (difficulty === '0') return assets.starter;
    if (difficulty === '100') return assets.solution;
    return stripSolution(assets.solution, language, Number(difficulty), assets.record.hints ?? []);
}
