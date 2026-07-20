import type { RequestHandler } from './$types';
import { eventStream, requestedAiEndpoint, streamModelText } from '$lib/server/codegate/ai/model-runner';
import { approveSyntaxDrill, getSyntaxDrill, syntaxDrillConsoleOutput, syntaxDrillReviewPrompt } from '$lib/server/codegate/syntax-drills';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';
import { createProgramRunner } from '$lib/server/program-runner';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? '');
        const challengeId = String(body.challengeId ?? '');
        requireActiveChallenge(sessionId, challengeId);
        const drill = getSyntaxDrill(String(body.syntaxDrillId ?? ''), sessionId, challengeId);
        const source = String(body.source ?? '');
        if (!source.trim() || source.length > 20_000) return new Response('Invalid syntax drill source', { status: 400 });

        return eventStream(async (emit, signal) => {
            emit('status', 'Compiling the syntax drill…');
            const runner = createProgramRunner(drill.language, drill.problem.id, [{}], source);
            await runner.compile();
            const programOutput = syntaxDrillConsoleOutput(await runner.run());
            if (programOutput) emit('output', programOutput);
            emit('status', 'Compile check passed. Reviewing the requested syntax…');

            let review = '';
            await streamModelText([
                {
                    role: 'system',
                    content: 'You are a strict but concise programming syntax reviewer. Judge only whether the requested language feature was demonstrated.'
                },
                { role: 'user', content: syntaxDrillReviewPrompt(drill, source) }
            ], (type, value) => {
                if (type === 'text') {
                    review += value;
                    emit('text', value);
                }
                if (type === 'reasoning') emit('reasoning', value);
            }, signal, { temperature: 0.05, maxTokens: 160, includeReasoning: true, endpoint: requestedAiEndpoint(body) });

            const verdict = review.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            const approved = /^PASS\b/i.test(verdict) && !/^PASS\s*(?:BUT|WITH\s+CHANGES)/i.test(verdict);
            if (approved) approveSyntaxDrill(drill, source);
            emit('result', JSON.stringify({ compiled: true, approved }));
        }, request.signal);
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
    }
};
