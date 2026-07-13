import { beforeEach, describe, expect, it } from 'vitest';
import { advanceGateSubmission, beginGateSubmissionChunk, clearGateSessionsForTests, createGateSession, refreshGateChallenge, releaseGateSession, switchGateVariant } from './sessions';
import type { PlayableManifest, PlayableVariant } from '../../codegate/types';

function variant(problemId: string, language: 'python' | 'cpp' = 'python', scaffold: PlayableVariant['scaffold'] = 'medium'): PlayableVariant {
    return { problemId, title: problemId, leetcodeDifficulty: 'Easy', language, scaffold, sourcePath: `${problemId}-${language}-${scaffold}`, sourceSha256: 'a'.repeat(64), judgeSha256: 'b'.repeat(64), validatedAt: 'now', validationStatus: 'validated' };
}

const manifest: PlayableManifest = {
    schemaVersion: 1,
    generatedAt: 'now',
    sourceRevision: 'test',
    variants: [variant('a'), variant('a', 'cpp'), variant('a', 'python', 'hard'), variant('b')]
};

describe('CodeGate server sessions', () => {
    beforeEach(clearGateSessionsForTests);

    it('invalidates an old challenge after refresh', () => {
        const session = createGateSession(manifest, 'python', 'medium', () => 0);
        const oldChallenge = session.challenge.id;
        refreshGateChallenge(session.id, oldChallenge, manifest, 'python', 'medium', () => 0);
        expect(() => beginGateSubmissionChunk(session.id, oldChallenge, 0)).toThrow(/stale/);
    });

    it('switches language or scaffold without changing the problem', () => {
        const session = createGateSession(manifest, 'python', 'medium', () => 0);
        const problemId = session.challenge.variant.problemId;
        const firstChallengeId = session.challenge.id;
        beginGateSubmissionChunk(session.id, firstChallengeId, 0);

        switchGateVariant(session.id, firstChallengeId, manifest, 'cpp', 'medium');
        expect(session.challenge.variant).toMatchObject({ problemId, language: 'cpp', scaffold: 'medium' });
        expect(session.challenge.id).not.toBe(firstChallengeId);
        expect(session.activeSubmission).toBeUndefined();
        expect(() => beginGateSubmissionChunk(session.id, firstChallengeId, 0)).toThrow(/stale/);

        switchGateVariant(session.id, session.challenge.id, manifest, 'python', 'hard');
        expect(session.challenge.variant).toMatchObject({ problemId, language: 'python', scaffold: 'hard' });
        expect(session.recentProblemIds).toEqual([problemId]);
    });

    it('rejects an unavailable variant instead of changing problems', () => {
        const session = createGateSession(manifest, 'python', 'medium', () => 0);
        const challengeId = session.challenge.id;
        expect(() => switchGateVariant(session.id, challengeId, manifest, 'cpp', 'hard')).toThrow(/No validated/);
        expect(session.challenge.id).toBe(challengeId);
        expect(session.challenge.variant.problemId).toBe('a');
    });

    it('prevents concurrent submissions and enforces sequential chunks', () => {
        const session = createGateSession(manifest, 'python', 'medium', () => 0);
        const first = beginGateSubmissionChunk(session.id, session.challenge.id, 0);
        expect(() => beginGateSubmissionChunk(session.id, session.challenge.id, 0)).toThrow(/already running/);
        expect(() => beginGateSubmissionChunk(session.id, session.challenge.id, 2, first.submissionId)).toThrow(/sequence/);
    });

    it('releases exactly after the complete official suite', () => {
        const session = createGateSession(manifest, 'python', 'medium', () => 0);
        const first = beginGateSubmissionChunk(session.id, session.challenge.id, 0);
        expect(advanceGateSubmission(session.id, session.challenge.id, first.submissionId, 0, 2, 3, true).released).toBe(false);
        beginGateSubmissionChunk(session.id, session.challenge.id, 2, first.submissionId);
        expect(advanceGateSubmission(session.id, session.challenge.id, first.submissionId, 2, 1, 3, true).released).toBe(true);
        expect(() => releaseGateSession(session.id, session.challenge.id, 'accepted')).toThrow(/not active/);
    });
});
