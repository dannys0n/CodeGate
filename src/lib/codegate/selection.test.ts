import { describe, expect, it } from 'vitest';
import { selectChallenge, variantsForPreference } from './selection';
import type { PlayableVariant } from './types';

function variant(problemId: string, language: 'python' | 'cpp', scaffold: PlayableVariant['scaffold']): PlayableVariant {
    return {
        problemId,
        title: problemId,
        leetcodeDifficulty: 'Easy',
        language,
        scaffold,
        sourcePath: `problems/${problemId}/variants/${language}/${scaffold}`,
        sourceSha256: 'a'.repeat(64),
        judgeSha256: 'b'.repeat(64),
        validatedAt: '2026-01-01T00:00:00.000Z',
        validationStatus: 'validated'
    };
}

describe('CodeGate challenge selection', () => {
    it('keeps the requested language and scaffold when available', () => {
        const variants = [variant('a', 'python', 'medium'), variant('b', 'cpp', 'medium')];
        expect(variantsForPreference(variants, 'python', 'medium')).toEqual([variants[0]]);
    });

    it('falls back to the closest available scaffold without changing language', () => {
        const variants = [variant('a', 'python', 'easy'), variant('b', 'cpp', 'medium')];
        expect(variantsForPreference(variants, 'python', 'medium')).toEqual([variants[0]]);
    });

    it('excludes recent problems when an alternative exists', () => {
        const variants = [variant('recent', 'python', 'hard'), variant('fresh', 'python', 'hard')];
        expect(selectChallenge(variants, { language: 'python', scaffold: 'hard', recentProblemIds: ['recent'] }, () => 0)?.problemId).toBe('fresh');
    });

    it('reuses a recent problem only when there is no alternative', () => {
        const variants = [variant('only', 'python', 'original')];
        expect(selectChallenge(variants, { language: 'python', scaffold: 'original', recentProblemIds: ['only'] }, () => 0)?.problemId).toBe('only');
    });

    it('returns null when the requested language is unavailable', () => {
        expect(selectChallenge([variant('a', 'cpp', 'easy')], { language: 'python', scaffold: 'easy' })).toBeNull();
    });
});
