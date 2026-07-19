import type { RequestHandler } from './$types';
import { randomInt } from 'node:crypto';
import { eventStream, requestedAiEndpoint, streamModelText } from '$lib/server/codegate/ai/model-runner';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';
import { gateLanguages, type GateLanguage } from '$lib/codegate/types';
import { truncateSyntaxDrillAtInfoLimit } from '$lib/codegate/syntax-drill-format';
import {
    createSyntaxDrill,
    normalizeSyntaxDrillTitle,
    storeSyntaxDrill,
    syntaxDrillPrompt,
    syntaxDrillResponse,
    syntaxDrillStarterPrompt,
    syntaxDrillTitlePrompt
} from '$lib/server/codegate/syntax-drills';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? '');
        const challengeId = String(body.challengeId ?? '');
        requireActiveChallenge(sessionId, challengeId);
        const language = String(body.language ?? '') as GateLanguage;
        const endpoint = requestedAiEndpoint(body);
        if (!gateLanguages.includes(language)) return new Response('Unsupported syntax drill language', { status: 400 });

        return eventStream(async (emit, signal) => {
            const seed = randomInt(1, 2_147_483_644);
            let rawTitle = '';
            emit('status', 'Choosing a syntax topic...');
            await streamModelText([
                {
                    role: 'system',
                    content: 'You choose diverse programming syntax topics. Return only the requested short title.'
                },
                { role: 'user', content: syntaxDrillTitlePrompt(language, seed) }
            ], (type, value) => {
                if (type === 'text') rawTitle += value;
            }, signal, { seed, temperature: 1, maxTokens: 64, endpoint });

            const title = normalizeSyntaxDrillTitle(rawTitle);
            let problem = `# ${title}\n`;
            emit('problem', problem);
            emit('status', 'Writing the syntax drill...');
            await streamModelText([
                {
                    role: 'system',
                    content: 'You create tiny, single-feature programming syntax exercises from an assigned title. Never change the topic or create an algorithm problem.'
                },
                { role: 'user', content: syntaxDrillPrompt(language, title) }
            ], (type, value) => {
                if (type === 'text') {
                    const limited = truncateSyntaxDrillAtInfoLimit(problem + value);
                    const accepted = limited.text.slice(problem.length);
                    problem = limited.text;
                    if (accepted) emit('problem', accepted);
                    if (limited.reached) return false;
                }
            }, signal, { seed: seed + 1, temperature: 0.3, maxTokens: 512, endpoint });

            let starterGuidance = '';
            emit('status', 'Preparing the editor...');
            await streamModelText([
                {
                    role: 'system',
                    content: 'You create one concise inline starter comment for a programming syntax exercise. Never provide the solution.'
                },
                { role: 'user', content: syntaxDrillStarterPrompt(language, problem) }
            ], (type, value) => {
                if (type === 'text') starterGuidance += value;
            }, signal, { seed: seed + 2, temperature: 0.2, endpoint });

            const drill = createSyntaxDrill(problem, starterGuidance, language, sessionId, challengeId);
            const response = syntaxDrillResponse(drill);
            emit('status', 'Preparing the syntax drill...');
            await storeSyntaxDrill(drill);
            emit('result', JSON.stringify(response));
        }, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
