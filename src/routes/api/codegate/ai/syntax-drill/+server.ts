import type { RequestHandler } from './$types';
import { randomInt } from 'node:crypto';
import { ensureCodeGateModelLoaded, eventStream, requestedAiEndpoint, streamModelText } from '$lib/server/codegate/ai/model-runner';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';
import { gateLanguages, type GateLanguage } from '$lib/codegate/types';
import { normalizeSyntaxDrillLearning } from '$lib/codegate/syntax-drill-learning';
import { truncateSyntaxDrillAfterFeatureInfo, truncateSyntaxDrillAtInfoLimit } from '$lib/codegate/syntax-drill-format';
import { selectSyntaxDrillConcept } from '$lib/server/codegate/syntax-drill-concepts';
import {
    createSyntaxDrill,
    storeSyntaxDrill,
    syntaxDrillInstruction,
    syntaxDrillProblemExample,
    syntaxDrillProblemSystemPrompt,
    syntaxDrillPrompt,
    syntaxDrillResponse,
    syntaxDrillStarterPrompt
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
        const learning = normalizeSyntaxDrillLearning(body.syntaxDrillLearning);

        return eventStream(async (emit, signal) => {
            if (!endpoint) await ensureCodeGateModelLoaded(emit, signal);
            const seed = randomInt(1, 2_147_483_640);
            emit('status', 'Choosing a syntax topic...');
            const concept = selectSyntaxDrillConcept(language, learning, () => seed / 2_147_483_640);
            let problem = `# ${concept.title}\n${syntaxDrillInstruction(concept)}\n`;
            emit('problem', problem);
            emit('status', 'Writing the syntax drill...');
            const example = syntaxDrillProblemExample(language);
            await streamModelText([
                {
                    role: 'system',
                    content: syntaxDrillProblemSystemPrompt(language)
                },
                { role: 'user', content: example.request },
                { role: 'assistant', content: example.response },
                { role: 'user', content: syntaxDrillPrompt(language, concept) }
            ], (type, value) => {
                if (type === 'text') {
                    const candidate = problem + value;
                    const completed = truncateSyntaxDrillAfterFeatureInfo(candidate);
                    const limited = completed.reached ? completed : truncateSyntaxDrillAtInfoLimit(candidate);
                    const accepted = limited.text.slice(problem.length);
                    problem = limited.text;
                    if (accepted) emit('problem', accepted);
                    if (limited.reached) return false;
                }
            }, signal, { seed: seed + 1, temperature: 0.5, topP: 0.8, maxTokens: 192, frequencyPenalty: 0.25, endpoint });

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
            }, signal, { seed: seed + 2, temperature: 0.2, maxTokens: 48, endpoint });

            const drill = createSyntaxDrill(problem, starterGuidance, language, concept, sessionId, challengeId);
            const response = syntaxDrillResponse(drill);
            emit('status', 'Preparing the syntax drill...');
            await storeSyntaxDrill(drill);
            emit('result', JSON.stringify(response));
        }, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
