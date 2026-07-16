import { describe, expect, it } from 'vitest';
import { eventStream, extractModelDelta } from './model-runner';

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
});
