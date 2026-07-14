import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CandidateAssets } from './catalog';
import type { DifficultyLevel, GateLanguage, PlayableVariant } from '../../codegate/types';
import { loadCandidateAssets, loadCandidateManifest } from './catalog';
import { stripSolution } from '../../codegate/source-transform.mjs';

type CachedCheck = {
    fingerprint: string;
    status: 'validated' | 'quarantined';
    checkedAt: string;
    reason?: string;
};

type RuntimeValidationCache = {
    schemaVersion: 2;
    solutions: Record<string, CachedCheck>;
};

type ServerFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const checksInFlight = new Map<string, Promise<CandidateAssets | null>>();
let cacheWrite = Promise.resolve();

function cachePath(root: string): string {
    return process.env.CODEGATE_VALIDATION_CACHE
        ? path.resolve(process.env.CODEGATE_VALIDATION_CACHE)
        : path.join(root, 'codegate', 'runtime-validation-cache.json');
}

async function readCache(root: string): Promise<RuntimeValidationCache> {
    try {
        const value = JSON.parse(await fs.readFile(cachePath(root), 'utf8')) as RuntimeValidationCache;
        if (value.schemaVersion === 2 && value.solutions) return value;
    } catch {
        // A missing or old cache is rebuilt from baseline judge results.
    }
    return { schemaVersion: 2, solutions: {} };
}

async function writeCache(root: string, cache: RuntimeValidationCache): Promise<void> {
    const target = cachePath(root);
    cacheWrite = cacheWrite.then(async () => {
        await fs.mkdir(path.dirname(target), { recursive: true });
        const temporary = `${target}.${process.pid}.tmp`;
        await fs.writeFile(temporary, `${JSON.stringify(cache, null, 2)}\n`);
        await fs.rename(temporary, target);
    });
    await cacheWrite;
}

function isInfrastructureFailure(message: string): boolean {
    return /docker|container|daemon|connect|ECONN|ENOENT|ENOTFOUND|no such image|socket|network|registry|image pull|pull access|certificate|TLS|named pipe/i.test(message);
}

async function baselinePasses(fetch: ServerFetch, assets: CandidateAssets, language: GateLanguage): Promise<boolean> {
    let startTcNo = 0;
    while (true) {
        const started = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problemId: assets.problem.slug, language, code: assets.solution, startTcNo })
        });
        const startBody = await started.json();
        if (!started.ok || !startBody.jobId) throw new Error(startBody.error ?? 'Unable to start baseline validation');
        let body: any;
        for (let poll = 0; poll < 3600; poll += 1) {
            const response = await fetch(`/api/submit?jobId=${encodeURIComponent(startBody.jobId)}`);
            body = await response.json();
            if (body.ready) {
                if (!response.ok && isInfrastructureFailure(String(body.error ?? ''))) throw new Error(body.error);
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!body?.ready) throw new Error('Baseline validation timed out while waiting for the judge');
        if (body.timeout || body.error || !body.accepted) return false;
        const total = Number(body.totalTc ?? 0);
        startTcNo += Number(body.passedTc ?? 1);
        if (total <= 0 || startTcNo >= total) return true;
    }
}

async function validateBaseline(frontendId: string, language: GateLanguage, fetch: ServerFetch, root: string): Promise<CandidateAssets | null> {
    const manifest = await loadCandidateManifest(root);
    const problem = manifest.problems[frontendId];
    const solution = problem?.languages[language];
    if (!problem || !solution) return null;
    const assets = await loadCandidateAssets(frontendId, language, root);
    const fingerprint = `${manifest.generatorVersion}:${problem.recordSha256}:${problem.judgeSha256}:${solution.solutionSha256}`;
    const key = `${frontendId}:${language}`;
    const cache = await readCache(root);
    const cached = cache.solutions[key];
    if (cached?.fingerprint === fingerprint) return cached.status === 'validated' ? assets : null;
    const accepted = await baselinePasses(fetch, assets, language);
    cache.solutions[key] = {
        fingerprint,
        status: accepted ? 'validated' : 'quarantined',
        checkedAt: new Date().toISOString(),
        reason: accepted ? undefined : 'baseline solution failed official tests'
    };
    await writeCache(root, cache);
    return accepted ? assets : null;
}

async function ensureBaseline(frontendId: string, language: GateLanguage, fetch: ServerFetch, root: string): Promise<CandidateAssets | null> {
    const key = `${frontendId}:${language}`;
    const existing = checksInFlight.get(key);
    if (existing) return existing;
    const pending = validateBaseline(frontendId, language, fetch, root).finally(() => checksInFlight.delete(key));
    checksInFlight.set(key, pending);
    return pending;
}

function randomized<T>(items: T[], random: () => number): T[] {
    return items.map((item) => ({ item, order: random() })).sort((left, right) => left.order - right.order).map(({ item }) => item);
}

function sourceFor(assets: CandidateAssets, language: GateLanguage, difficulty: DifficultyLevel): string {
    if (difficulty === '0') return assets.starter;
    if (difficulty === '100') return assets.solution;
    return stripSolution(assets.solution, language, Number(difficulty), assets.record.hints ?? []);
}

export async function prepareChallenge(
    language: GateLanguage,
    difficulty: DifficultyLevel,
    recentProblemIds: string[],
    fetch: ServerFetch,
    options: { problemId?: string; random?: () => number; root?: string } = {}
): Promise<PlayableVariant> {
    const root = options.root ?? process.cwd();
    const manifest = await loadCandidateManifest(root);
    const recent = new Set(recentProblemIds);
    const matches = Object.entries(manifest.problems).filter(([, problem]) =>
        Boolean(problem.languages[language]) && (!options.problemId || problem.slug === options.problemId)
    );
    const fresh = matches.filter(([, problem]) => !recent.has(problem.slug));
    for (const [frontendId] of randomized(fresh.length ? fresh : matches, options.random ?? Math.random)) {
        const assets = await ensureBaseline(frontendId, language, fetch, root);
        if (!assets) continue;
        const source = sourceFor(assets, language, difficulty);
        return {
            problemId: assets.problem.slug,
            title: `${frontendId}. ${assets.record.title}`,
            leetcodeDifficulty: String(assets.record.difficulty ?? ''),
            language,
            difficulty,
            sourceSha256: createHash('sha256').update(source).digest('hex'),
            judgeSha256: assets.problem.judgeSha256,
            validatedAt: new Date().toISOString(),
            validationStatus: 'validated'
        };
    }
    throw new Error(`No valid ${language} challenge could be prepared`);
}

export async function availableCandidates(problemId: string, root = process.cwd()): Promise<GateLanguage[]> {
    const manifest = await loadCandidateManifest(root);
    const problem = Object.values(manifest.problems).find((candidate) => candidate.slug === problemId);
    if (!problem) return [];
    return Object.keys(problem.languages) as GateLanguage[];
}
