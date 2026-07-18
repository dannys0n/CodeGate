import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSyntaxDrill, isSyntaxDrillApproved } from '$lib/server/codegate/syntax-drills';
import { releaseGateSession } from '$lib/server/codegate/sessions';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? '');
        const challengeId = String(body.challengeId ?? '');
        const drill = getSyntaxDrill(String(body.syntaxDrillId ?? ''), sessionId, challengeId);
        const source = String(body.source ?? '');
        if (!isSyntaxDrillApproved(drill, source)) {
            return json({ error: 'Run and pass this exact solution before completing the drill' }, { status: 409 });
        }
        releaseGateSession(sessionId, challengeId, 'accepted');
        return json({ released: true });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }
};
