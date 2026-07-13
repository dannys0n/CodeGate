import { randomUUID } from 'node:crypto';
import { selectChallenge } from '../../codegate/selection';
import type { GateLanguage, PlayableManifest, PlayableVariant, ScaffoldLevel } from '../../codegate/types';

export type GateOutcome = 'accepted' | 'given-up' | 'infrastructure-failure' | 'abandoned';

export type GateChallenge = {
    id: string;
    variant: PlayableVariant;
};

export type GateSession = {
    id: string;
    createdAt: string;
    status: 'active' | 'released';
    outcome?: GateOutcome;
    releasedAt?: string;
    challenge: GateChallenge;
    recentProblemIds: string[];
    activeSubmission?: {
        id: string;
        challengeId: string;
        expectedStart: number;
    };
};

const sessions = new Map<string, GateSession>();

function choose(
    manifest: PlayableManifest,
    language: GateLanguage,
    scaffold: ScaffoldLevel,
    recentProblemIds: string[],
    random: () => number
) {
    const variant = selectChallenge(manifest.variants, { language, scaffold, recentProblemIds }, random);
    if (!variant) throw new Error(`No validated ${language}/${scaffold} challenge is available`);
    return variant;
}

export function createGateSession(
    manifest: PlayableManifest,
    language: GateLanguage,
    scaffold: ScaffoldLevel,
    random: () => number = Math.random
): GateSession {
    const variant = choose(manifest, language, scaffold, [], random);
    const session: GateSession = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'active',
        challenge: { id: randomUUID(), variant },
        recentProblemIds: [variant.problemId]
    };
    sessions.set(session.id, session);
    return session;
}

export function getGateSession(sessionId: string): GateSession | undefined {
    return sessions.get(sessionId);
}

export function requireActiveChallenge(sessionId: string, challengeId: string): GateSession {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'active') throw new Error('Gate session is not active');
    if (session.challenge.id !== challengeId) throw new Error('Gate challenge is stale');
    return session;
}

export function refreshGateChallenge(
    sessionId: string,
    challengeId: string,
    manifest: PlayableManifest,
    language: GateLanguage,
    scaffold: ScaffoldLevel,
    random: () => number = Math.random
): GateSession {
    const session = requireActiveChallenge(sessionId, challengeId);
    const variant = choose(manifest, language, scaffold, session.recentProblemIds, random);
    session.activeSubmission = undefined;
    session.challenge = { id: randomUUID(), variant };
    session.recentProblemIds = [...session.recentProblemIds.slice(-9), variant.problemId];
    return session;
}

export function releaseGateSession(sessionId: string, challengeId: string, outcome: GateOutcome): GateSession {
    const session = requireActiveChallenge(sessionId, challengeId);
    session.status = 'released';
    session.outcome = outcome;
    session.releasedAt = new Date().toISOString();
    session.activeSubmission = undefined;
    return session;
}

export function beginGateSubmissionChunk(
    sessionId: string,
    challengeId: string,
    startTcNo: number,
    submissionId?: string
): { session: GateSession; submissionId: string } {
    const session = requireActiveChallenge(sessionId, challengeId);
    if (!session.activeSubmission) {
        if (startTcNo !== 0 || submissionId) throw new Error('Submission must start at the first official test');
        session.activeSubmission = { id: randomUUID(), challengeId, expectedStart: 0 };
    } else if (session.activeSubmission.id !== submissionId) {
        throw new Error('Another submission is already running');
    }
    if (session.activeSubmission.expectedStart !== startTcNo) throw new Error('Submission test sequence is stale');
    return { session, submissionId: session.activeSubmission.id };
}

export function advanceGateSubmission(
    sessionId: string,
    challengeId: string,
    submissionId: string,
    startTcNo: number,
    passedCount: number,
    totalCount: number,
    accepted: boolean
): { released: boolean; stale: boolean } {
    let session: GateSession;
    try {
        session = requireActiveChallenge(sessionId, challengeId);
    } catch {
        return { released: false, stale: true };
    }
    const active = session.activeSubmission;
    if (!active || active.id !== submissionId || active.expectedStart !== startTcNo) {
        return { released: false, stale: true };
    }
    if (!accepted) {
        session.activeSubmission = undefined;
        return { released: false, stale: false };
    }
    active.expectedStart += passedCount;
    if (active.expectedStart >= totalCount) {
        releaseGateSession(sessionId, challengeId, 'accepted');
        return { released: true, stale: false };
    }
    return { released: false, stale: false };
}

export function abandonGateSubmission(sessionId: string, challengeId: string, submissionId: string) {
    const session = sessions.get(sessionId);
    if (session?.status === 'active' && session.challenge.id === challengeId && session.activeSubmission?.id === submissionId) {
        session.activeSubmission = undefined;
    }
}

export function clearGateSessionsForTests() {
    sessions.clear();
}
