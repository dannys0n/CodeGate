import type { RequestHandler } from './$types';
import { eventStream, requestedAiEndpoint, warmCodeGateModel, warmCustomAiEndpoint } from '$lib/server/codegate/ai/model-runner';
import { requireAiChallenge } from '$lib/server/codegate/ai/context';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        await requireAiChallenge(body);
        const endpoint = requestedAiEndpoint(body);
        if (endpoint) return eventStream((emit, signal) => warmCustomAiEndpoint(endpoint, emit, signal), request.signal);
        if (body.aiDockerEnabled === false) throw new Error('Enable Docker Model Runner or enter a custom AI endpoint');
        return eventStream(warmCodeGateModel, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
