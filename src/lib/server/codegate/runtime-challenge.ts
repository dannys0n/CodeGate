import { createHash } from 'node:crypto';
import type { DifficultyLevel, GateLanguage, LeetcodeDifficulty, PlayableVariant, ProblemNumberRange } from '../../codegate/types';
import { stripSolution } from '../../codegate/source-transform.mjs';
import { loadCandidateAssets, loadCandidateManifest, type CandidateAssets } from './catalog';

function randomized<T>(items: T[], random: () => number): T[] {
    return items
        .map((item) => ({ item, order: random() }))
        .sort((left, right) => left.order - right.order)
        .map(({ item }) => item);
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
    options: { problemId?: string; random?: () => number; root?: string; leetcodeDifficulties?: readonly LeetcodeDifficulty[]; problemNumberRange?: ProblemNumberRange } = {}
): Promise<PlayableVariant> {
    const root = options.root ?? process.env.CODEGATE_APP_ROOT ?? process.cwd();
    const manifest = await loadCandidateManifest(root);
    const recent = new Set(recentProblemIds);
    const allowedDifficulties = options.leetcodeDifficulties ? new Set(options.leetcodeDifficulties) : undefined;
    const matches = Object.entries(manifest.problems).filter(([frontendId, problem]) => {
        const problemNumber = Number(frontendId);
        const inNumberRange = Number.isSafeInteger(problemNumber)
            && (options.problemNumberRange?.min === null || options.problemNumberRange?.min === undefined || problemNumber >= options.problemNumberRange.min)
            && (options.problemNumberRange?.max === null || options.problemNumberRange?.max === undefined || problemNumber <= options.problemNumberRange.max);
        return (
        Boolean(problem.languages[language])
        && (!options.problemId || problem.slug === options.problemId)
        && (!allowedDifficulties || allowedDifficulties.has(problem.leetcodeDifficulty))
        && inNumberRange
        );
    });
    const fresh = matches.filter(([, problem]) => !recent.has(problem.slug));
    const selected = randomized(fresh.length ? fresh : matches, options.random ?? Math.random)[0];
    if (!selected) throw new Error(`No ${language} challenge is available`);

    const [frontendId] = selected;
    const assets = await loadCandidateAssets(frontendId, language, root);
    const source = sourceFor(assets, language, difficulty);
    return {
        problemId: assets.problem.slug,
        title: `${frontendId}. ${assets.record.title}`,
        leetcodeDifficulty: String(assets.record.difficulty ?? ''),
        language,
        difficulty,
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        judgeSha256: assets.problem.judgeSha256,
        preparedAt: new Date().toISOString()
    };
}

export async function availableCandidates(problemId: string, root = process.env.CODEGATE_APP_ROOT ?? process.cwd()): Promise<GateLanguage[]> {
    const manifest = await loadCandidateManifest(root);
    const problem = Object.values(manifest.problems).find((candidate) => candidate.slug === problemId);
    if (!problem) return [];
    return Object.keys(problem.languages) as GateLanguage[];
}
