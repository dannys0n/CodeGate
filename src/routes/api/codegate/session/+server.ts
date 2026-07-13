import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPlayableManifest } from '$lib/server/codegate/catalog';
import { getGateSession, refreshGateChallenge, releaseGateSession } from '$lib/server/codegate/sessions';
import { scaffoldLevels, type GateLanguage, type ScaffoldLevel } from '$lib/codegate/types';

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
        if (body.action === 'refresh') {
            const language: GateLanguage = body.language === 'cpp' ? 'cpp' : 'python';
            const scaffold: ScaffoldLevel = scaffoldLevels.includes(body.scaffold) ? body.scaffold : 'medium';
            return json(refreshGateChallenge(sessionId, challengeId, await loadPlayableManifest(), language, scaffold));
        }
        return json({ error: 'Unsupported session action' }, { status: 400 });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }
};
