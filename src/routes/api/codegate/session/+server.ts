import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGateSession, refreshGateChallenge, releaseGateSession, requireActiveChallenge, switchGateVariant } from '$lib/server/codegate/sessions';
import { difficultyLevels, gateLanguages, leetcodeDifficultyLevels, type DifficultyLevel, type GateLanguage, type LeetcodeDifficulty } from '$lib/codegate/types';
import { prepareChallenge } from '$lib/server/codegate/runtime-challenge';

export const GET: RequestHandler = async ({ url }) => {
    const session = getGateSession(url.searchParams.get('sessionId') ?? '');
    if (!session) return json({ error: 'Session not found' }, { status: 404 });
    return json(session);
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const sessionId = String(body.sessionId ?? '');
        const challengeId = String(body.challengeId ?? '');
        if (body.action === 'give-up') {
            return json(releaseGateSession(sessionId, challengeId, 'given-up'));
        }
        if (body.action === 'refresh' || body.action === 'switch-variant') {
            const language: GateLanguage = gateLanguages.includes(body.language) ? body.language : 'python';
            const difficulty: DifficultyLevel = difficultyLevels.includes(body.difficulty) ? body.difficulty : '99';
            const current = requireActiveChallenge(sessionId, challengeId);
            const requestedLeetcodeDifficulties = Array.isArray(body.leetcodeDifficulties)
                ? body.leetcodeDifficulties.filter((value: unknown): value is LeetcodeDifficulty => leetcodeDifficultyLevels.includes(value as LeetcodeDifficulty))
                : current.leetcodeDifficulties;
            const leetcodeDifficulties = requestedLeetcodeDifficulties.length ? requestedLeetcodeDifficulties : current.leetcodeDifficulties;
            const prepared = await prepareChallenge(language, difficulty, current.recentProblemIds, body.action === 'switch-variant'
                ? { problemId: current.challenge.variant.problemId }
                : { leetcodeDifficulties });
            const manifest = { schemaVersion: 1 as const, generatedAt: prepared.preparedAt, sourceRevision: 'runtime', variants: [prepared] };
            return json(body.action === 'refresh'
                ? refreshGateChallenge(sessionId, challengeId, manifest, prepared.language, prepared.difficulty, Math.random, leetcodeDifficulties)
                : switchGateVariant(sessionId, challengeId, manifest, prepared.language, prepared.difficulty));
        }
        return json({ error: 'Unsupported session action' }, { status: 400 });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }
};
