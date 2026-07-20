import { describe, expect, it, vi } from 'vitest';
import { eventStream, extractModelDelta, streamModelText } from './model-runner';

describe('Docker Model Runner stream deltas', () => {
    it('prefers normal assistant content', () => {
        expect(extractModelDelta({ choices: [{ delta: { content: 'Hash map', reasoning_content: 'analysis' } }] })).toEqual({
            content: 'Hash map',
            reasoning: 'analysis'
        });
    });

    it('accepts reasoning-only and completion-style backend shapes', () => {
        expect(extractModelDelta({ choices: [{ delta: { reasoning: 'fallback' } }] })).toEqual({
            content: '',
            reasoning: 'fallback'
        });
        expect(extractModelDelta({ choices: [{ text: 'plain completion' }] })).toEqual({
            content: 'plain completion',
            reasoning: ''
        });
    });

    it('ignores late output after the response consumer cancels', async () => {
        let releaseOperation!: () => void;
        const waitForRelease = new Promise<void>((resolve) => { releaseOperation = resolve; });
        let operationSignal: AbortSignal | undefined;
        const response = eventStream(async (emit, signal) => {
            operationSignal = signal;
            await waitForRelease;
            emit('text', 'late output');
            throw new Error('late failure');
        });
        const reader = response.body!.getReader();

        await reader.cancel();
        releaseOperation();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(operationSignal?.aborted).toBe(true);
    });

    it('discovers and streams from an OpenAI-compatible custom endpoint', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(Response.json({ data: [{ id: 'loaded-model', state: 'loaded' }] }))
            .mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"ready"}}]}\n\ndata: [DONE]\n\n', {
                headers: { 'content-type': 'text/event-stream' }
            }));
        vi.stubGlobal('fetch', fetchMock);
        const output: string[] = [];

        await streamModelText([{ role: 'user', content: 'test' }], (type, text) => {
            if (type === 'text') output.push(text);
        }, undefined, { endpoint: 'http://127.0.0.1:43123', maxTokens: 96, topP: 0.8, frequencyPenalty: 0.25 });

        expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:43123/v1/models');
        expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:43123/v1/chat/completions');
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ model: 'loaded-model', stream: true, max_tokens: 96, top_p: 0.8, frequency_penalty: 0.25 });
        expect(output).toEqual(['ready']);
        vi.unstubAllGlobals();
    });

    it('cancels model output when the stream consumer reaches its limit', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            'data: {"choices":[{"delta":{"content":"first"}}]}\n\ndata: {"choices":[{"delta":{"content":"late"}}]}\n\ndata: [DONE]\n\n',
            { headers: { 'content-type': 'text/event-stream' } }
        ));
        vi.stubGlobal('fetch', fetchMock);
        const output: string[] = [];

        await streamModelText([{ role: 'user', content: 'test' }], (type, text) => {
            if (type !== 'text') return;
            output.push(text);
            return false;
        });

        expect(output).toEqual(['first']);
        vi.unstubAllGlobals();
    });
});
