import type { RequestHandler } from './$types';
import { randomInt } from 'node:crypto';
import { eventStream, streamModelText } from '$lib/server/codegate/ai/model-runner';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';
import { gateLanguages, type GateLanguage } from '$lib/codegate/types';
import { createSyntaxDrill, storeSyntaxDrill, syntaxDrillPrompt, syntaxDrillResponse, syntaxDrillStarterPrompt } from '$lib/server/codegate/syntax-drills';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? '');
        const challengeId = String(body.challengeId ?? '');
        requireActiveChallenge(sessionId, challengeId);
        const language = String(body.language ?? '') as GateLanguage;
        if (!gateLanguages.includes(language)) return new Response('Unsupported syntax drill language', { status: 400 });

        return eventStream(async (emit, signal) => {
            const seed = randomInt(1, 2_147_483_644);
            let problem = '';
            emit('status', 'Generating a syntax drill…');
            await streamModelText([
                {
                    role: 'system',
                    content: 'You create tiny, single-feature programming syntax exercises. Never create an algorithm problem.'
                },
                { role: 'user', content: syntaxDrillPrompt(language, seed) }
            ], (type, value) => {
                if (type === 'text') {
                    problem += value;
                    emit('problem', value);
                }
            }, signal, { seed, temperature: 0.85 });

            let starterGuidance = '';
            emit('status', 'Preparing the editor…');
            await streamModelText([
                {
                    role: 'system',
                    content: 'You create one concise inline starter comment for a programming syntax exercise. Never provide the solution.'
                },
                { role: 'user', content: syntaxDrillStarterPrompt(language, problem) }
            ], (type, value) => {
                if (type === 'text') starterGuidance += value;
            }, signal, { seed: seed + 1, temperature: 0.2 });

            const drill = createSyntaxDrill(problem, starterGuidance, language, sessionId, challengeId);
            const response = syntaxDrillResponse(drill);
            emit('status', 'Preparing the syntax drill…');
            await storeSyntaxDrill(drill);
            emit('result', JSON.stringify(response));
        }, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
