import type { RequestHandler } from './$types';
import { eventStream, requestedAiEndpoint, unloadCodeGateModel } from '$lib/server/codegate/ai/model-runner';
import { requireAiChallenge } from '$lib/server/codegate/ai/context';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        await requireAiChallenge(body);
        const endpoint = requestedAiEndpoint(body);
        return eventStream(async (emit, signal) => {
            if (endpoint) emit('status', 'Disconnected from the custom AI endpoint.\n');
            emit('status', 'Unloading the CodeGate Docker model if it is running...\n');
            await unloadCodeGateModel(emit, signal);
            emit('status', 'AI helper is inactive. Stored model files were not removed.\n');
        }, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
