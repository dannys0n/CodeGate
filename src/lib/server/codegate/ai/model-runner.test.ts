import { describe, expect, it } from 'vitest';
import { extractModelDelta } from './model-runner';

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
});
