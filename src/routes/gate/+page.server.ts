import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createGateSession } from '$lib/server/codegate/sessions';
import { difficultyLevels, gateLanguages, type DifficultyLevel, type GateLanguage } from '$lib/codegate/types';
import { prepareChallenge } from '$lib/server/codegate/runtime-validation';

export const load: PageServerLoad = async ({ url, fetch }) => {
    const requestedLanguage = url.searchParams.get('language');
    const language: GateLanguage = gateLanguages.includes(requestedLanguage as GateLanguage) ? requestedLanguage as GateLanguage : 'python';
    const requested = url.searchParams.get('difficulty');
    const difficulty: DifficultyLevel = difficultyLevels.includes(requested as DifficultyLevel) ? requested as DifficultyLevel : '50';
    const prepared = await prepareChallenge(language, difficulty, [], fetch);
    const session = createGateSession({ schemaVersion: 1, generatedAt: prepared.validatedAt, sourceRevision: 'runtime', variants: [prepared] }, prepared.language, prepared.difficulty);
    const target = new URL(`/problems/${session.challenge.variant.problemId}`, url);
    target.searchParams.set('codegate', '1');
    target.searchParams.set('language', session.challenge.variant.language);
    target.searchParams.set('difficulty', session.challenge.variant.difficulty);
    target.searchParams.set('sessionId', session.id);
    target.searchParams.set('challengeId', session.challenge.id);
    throw redirect(303, `${target.pathname}${target.search}`);
};
