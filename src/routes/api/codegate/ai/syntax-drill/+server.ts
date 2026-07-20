import type { RequestHandler } from './$types';
import { randomInt } from 'node:crypto';
import { eventStream, requestedAiEndpoint, streamModelText } from '$lib/server/codegate/ai/model-runner';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';
import { gateLanguages, type GateLanguage } from '$lib/codegate/types';
import { truncateSyntaxDrillAfterFeatureInfo, truncateSyntaxDrillAtInfoLimit } from '$lib/codegate/syntax-drill-format';
import {
    createSyntaxDrill,
    isUsableSyntaxDrillTitle,
    normalizeSyntaxDrillTitle,
    storeSyntaxDrill,
    syntaxDrillInstruction,
    syntaxDrillProblemExample,
    syntaxDrillProblemSystemPrompt,
    syntaxDrillPrompt,
    syntaxDrillResponse,
    syntaxDrillStarterPrompt,
    syntaxDrillTitleCategory,
    syntaxDrillTitlePrompt,
    syntaxDrillTitlesOverlap
} from '$lib/server/codegate/syntax-drills';

const recentTitles = new Map<GateLanguage, string[]>();
const recentTitleCategories = new Map<GateLanguage, string[]>();

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
            const seed = randomInt(1, 2_147_483_640);
            let title = '';
            emit('status', 'Choosing a syntax topic...');
            const recent = recentTitles.get(language) ?? [];
            const recentCategories = recentTitleCategories.get(language) ?? [];
            const requiredCategory = syntaxDrillTitleCategory(language, seed, recentCategories);
            let fallbackTitle = '';
            for (let attempt = 0; attempt < 8; attempt += 1) {
                let rawTitle = '';
                await streamModelText([
                    {
                        role: 'system',
                        content: 'Return only one canonical, real syntax topic from the required category. Topics may be data types, callable/function syntax, storage/container types, declarations, operators, or library operations.'
                    },
                    { role: 'user', content: syntaxDrillTitlePrompt(language, seed + attempt, requiredCategory) }
                ], (type, value) => {
                    if (type === 'text') rawTitle += value;
                }, signal, { seed: seed + attempt, temperature: 1, topP: 0.75, maxTokens: 16, endpoint });
                const candidate = normalizeSyntaxDrillTitle(rawTitle);
                if (!isUsableSyntaxDrillTitle(rawTitle, candidate)) continue;
                fallbackTitle ||= candidate;
                if (!recent.some((entry) => syntaxDrillTitlesOverlap(entry, candidate))) {
                    title = candidate;
                    break;
                }
            }
            title ||= fallbackTitle;
            if (!title) throw new Error('The AI model did not return a usable syntax topic');
            recentTitles.set(language, [...recent, title].slice(-8));
            recentTitleCategories.set(language, [...recentCategories, requiredCategory].slice(-6));
            let problem = `# ${title}\n${syntaxDrillInstruction(title)}\n`;
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
                { role: 'user', content: syntaxDrillPrompt(language, title) }
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
