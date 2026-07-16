import { describe, expect, it, vi } from 'vitest';
import { consumeAiStream } from './ai-stream';

function streamedResponse(chunks: string[]) {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
        }
    }));
}

describe('AI event streams', () => {
    it('decodes events split across transport chunks', async () => {
        const events = vi.fn();
        const response = streamedResponse([
            'data: {"type":"status","text":"Load',
            'ing"}\n\ndata: {"type":"text","text":"Sliding "}\n\n',
            'data: {"type":"text","text":"window"}\n\ndata: {"type":"done"}\n\n'
        ]);

        await consumeAiStream(response, events);
        expect(events.mock.calls.map(([event]) => event)).toEqual([
            { type: 'status', text: 'Loading' },
            { type: 'text', text: 'Sliding ' },
            { type: 'text', text: 'window' },
            { type: 'done' }
        ]);
    });

    it('surfaces streamed errors', async () => {
        const response = streamedResponse(['data: {"type":"error","text":"Model unavailable"}\n\n']);
        await expect(consumeAiStream(response, () => {})).rejects.toThrow('Model unavailable');
    });
});
