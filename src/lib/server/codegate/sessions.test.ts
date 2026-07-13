import { beforeEach, describe, expect, it } from 'vitest';
import { advanceGateSubmission, beginGateSubmissionChunk, clearGateSessionsForTests, createGateSession, refreshGateChallenge, releaseGateSession } from './sessions';
import type { PlayableManifest, PlayableVariant } from '../../codegate/types';

function variant(problemId: string): PlayableVariant {
    return { problemId, title: problemId, leetcodeDifficulty: 'Easy', language: 'python', scaffold: 'medium', sourcePath: `${problemId}.py`, sourceSha256: 'a'.repeat(64), judgeSha256: 'b'.repeat(64), validatedAt: 'now', validationStatus: 'validated' };
}

const manifest: PlayableManifest = { schemaVersion: 1, generatedAt: 'now', sourceRevision: 'test', variants: [variant('a'), variant('b')] };

describe('CodeGate server sessions', () => {
    beforeEach(clearGateSessionsForTests);

    it('invalidates an old challenge after refresh', () => {
        const session = createGateSession(manifest, 'python', 'medium', () => 0);
        const oldChallenge = session.challenge.id;
        refreshGateChallenge(session.id, oldChallenge, manifest, 'python', 'medium', () => 0);
        expect(() => beginGateSubmissionChunk(session.id, oldChallenge, 0)).toThrow(/stale/);
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
