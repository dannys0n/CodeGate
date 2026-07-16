import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createGateSession } from '$lib/server/codegate/sessions';
import { difficultyLevels, gateLanguages, leetcodeDifficultyLevels, type DifficultyLevel, type GateLanguage, type LeetcodeDifficulty } from '$lib/codegate/types';
import { prepareChallenge } from '$lib/server/codegate/runtime-challenge';

export const load: PageServerLoad = async ({ url }) => {
    const requestedLanguage = url.searchParams.get('language');
    const language: GateLanguage = gateLanguages.includes(requestedLanguage as GateLanguage) ? requestedLanguage as GateLanguage : 'python';
    const requested = url.searchParams.get('difficulty');
    const difficulty: DifficultyLevel = difficultyLevels.includes(requested as DifficultyLevel) ? requested as DifficultyLevel : '99';
    const requestedLeetcodeDifficulties = (url.searchParams.get('leetcodeDifficulties') ?? '')
        .split(',')
        .filter((value): value is LeetcodeDifficulty => leetcodeDifficultyLevels.includes(value as LeetcodeDifficulty));
    const leetcodeDifficulties = requestedLeetcodeDifficulties.length ? requestedLeetcodeDifficulties : [...leetcodeDifficultyLevels];
    const readBound = (name: string) => {
        const value = Number(url.searchParams.get(name));
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    };
    let problemNumberMin = readBound('problemNumberMin');
    let problemNumberMax = readBound('problemNumberMax');
    if (problemNumberMin !== null && problemNumberMax !== null && problemNumberMin > problemNumberMax) {
        [problemNumberMin, problemNumberMax] = [problemNumberMax, problemNumberMin];
    }
    const problemNumberRange = { min: problemNumberMin, max: problemNumberMax };
    const prepared = await prepareChallenge(language, difficulty, [], { leetcodeDifficulties, problemNumberRange });
    const session = createGateSession({ schemaVersion: 1, generatedAt: prepared.preparedAt, sourceRevision: 'runtime', variants: [prepared] }, prepared.language, prepared.difficulty, Math.random, leetcodeDifficulties, problemNumberRange);
    const target = new URL(`/problems/${session.challenge.variant.problemId}`, url);
    target.searchParams.set('codegate', '1');
    target.searchParams.set('language', session.challenge.variant.language);
    target.searchParams.set('difficulty', session.challenge.variant.difficulty);
    target.searchParams.set('sessionId', session.id);
    target.searchParams.set('challengeId', session.challenge.id);
    throw redirect(303, `${target.pathname}${target.search}`);
};
