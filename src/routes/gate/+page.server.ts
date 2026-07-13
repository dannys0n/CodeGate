import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadPlayableManifest } from '$lib/server/codegate/catalog';
import { createGateSession } from '$lib/server/codegate/sessions';
import { difficultyLevels, type DifficultyLevel, type GateLanguage } from '$lib/codegate/types';

export const load: PageServerLoad = async ({ url }) => {
    const language: GateLanguage = url.searchParams.get('language') === 'cpp' ? 'cpp' : 'python';
    const requested = url.searchParams.get('difficulty');
    const difficulty: DifficultyLevel = difficultyLevels.includes(requested as DifficultyLevel) ? requested as DifficultyLevel : '50';
    const session = createGateSession(await loadPlayableManifest(), language, difficulty);
    const target = new URL(`/problems/${session.challenge.variant.problemId}`, url);
    target.searchParams.set('codegate', '1');
    target.searchParams.set('language', session.challenge.variant.language);
    target.searchParams.set('difficulty', session.challenge.variant.difficulty);
    target.searchParams.set('sessionId', session.id);
    target.searchParams.set('challengeId', session.challenge.id);
    throw redirect(303, `${target.pathname}${target.search}`);
};
