import { describe, expect, it } from 'vitest';
import { selectChallenge, variantsForPreference } from './selection';
import type { PlayableVariant } from './types';

function variant(problemId: string, language: 'python' | 'cpp', difficulty: PlayableVariant['difficulty']): PlayableVariant {
    return {
        problemId, title: problemId, leetcodeDifficulty: 'Easy', language, difficulty,
        sourceSha256: 'a'.repeat(64), judgeSha256: 'b'.repeat(64),
        preparedAt: '2026-01-01T00:00:00.000Z'
    };
}

describe('CodeGate challenge selection', () => {
    it('keeps the requested language and difficulty when available', () => {
        const variants = [variant('a', 'python', '50'), variant('b', 'cpp', '50')];
        expect(variantsForPreference(variants, 'python', '50')).toEqual([variants[0]]);
    });

    it('falls back to the closest available difficulty without changing language', () => {
        const variants = [variant('a', 'python', '25'), variant('b', 'cpp', '50')];
        expect(variantsForPreference(variants, 'python', '50')).toEqual([variants[0]]);
    });

    it('excludes recent problems when an alternative exists', () => {
        const variants = [variant('recent', 'python', '75'), variant('fresh', 'python', '75')];
        expect(selectChallenge(variants, { language: 'python', difficulty: '75', recentProblemIds: ['recent'] }, () => 0)?.problemId).toBe('fresh');
    });

    it('reuses a recent problem only when there is no alternative', () => {
        const variants = [variant('only', 'python', '100')];
        expect(selectChallenge(variants, { language: 'python', difficulty: '100', recentProblemIds: ['only'] }, () => 0)?.problemId).toBe('only');
    });

    it('returns null when the requested language is unavailable', () => {
        expect(selectChallenge([variant('a', 'cpp', '25')], { language: 'python', difficulty: '25' })).toBeNull();
    });
});
