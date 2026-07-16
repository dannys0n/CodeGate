import type { RequestHandler } from './$types';
import { eventStream, provisionCodeGateModel } from '$lib/server/codegate/ai/model-runner';
import { requireAiChallenge } from '$lib/server/codegate/ai/context';

export const POST: RequestHandler = async ({ request }) => {
    try {
        await requireAiChallenge(await request.json());
        return eventStream(provisionCodeGateModel, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
