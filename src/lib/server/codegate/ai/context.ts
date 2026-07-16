import { loadCandidateAssets, loadCandidateManifest } from '../catalog';
import { requireActiveChallenge } from '../sessions';

export async function requireAiChallenge(body: Record<string, unknown>) {
    const sessionId = String(body.sessionId ?? '');
    const challengeId = String(body.challengeId ?? '');
    const session = requireActiveChallenge(sessionId, challengeId);
    const variant = session.challenge.variant;
    const manifest = await loadCandidateManifest();
    const entry = Object.entries(manifest.problems).find(([, problem]) => problem.slug === variant.problemId);
    if (!entry) throw new Error('Challenge problem is not indexed');
    const assets = await loadCandidateAssets(entry[0], variant.language);
    const statement = [assets.record.description, assets.record.problem, assets.record.statement, assets.record.content]
        .find((value) => typeof value === 'string' && value.trim()) ?? assets.record.title ?? variant.title;
    return { session, variant, assets, statement: String(statement) };
}

export function boundedText(value: unknown, name: string, maximum: number) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
    if (value.length > maximum) throw new Error(`${name} is too large`);
    return value;
}

export function promptExcerpt(value: unknown, maximum: number) {
    const text = String(value ?? '');
    return text.length <= maximum ? text : `${text.slice(0, maximum)}\n[truncated for local AI context]`;
}
