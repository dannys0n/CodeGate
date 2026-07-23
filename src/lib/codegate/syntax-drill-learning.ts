import { gateLanguages, type GateLanguage } from './types';

export type SyntaxConceptProgress = {
    seen: number;
    passed: number;
};

export type SyntaxLanguageProgress = {
    concepts: Record<string, SyntaxConceptProgress>;
    recent: string[];
};

export type SyntaxDrillLearning = Partial<Record<GateLanguage, SyntaxLanguageProgress>>;

const maximumConceptsPerLanguage = 256;
const maximumRecentConcepts = 12;

function boundedCount(value: unknown): number {
    return typeof value === 'number' && Number.isSafeInteger(value)
        ? Math.min(999, Math.max(0, value))
        : 0;
}

export function normalizeSyntaxDrillLearning(value: unknown): SyntaxDrillLearning {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const normalized: SyntaxDrillLearning = {};
    for (const language of gateLanguages) {
        const rawLanguage = source[language];
        if (!rawLanguage || typeof rawLanguage !== 'object' || Array.isArray(rawLanguage)) continue;
        const languageRecord = rawLanguage as Record<string, unknown>;
        const rawConcepts = languageRecord.concepts;
        const concepts: Record<string, SyntaxConceptProgress> = {};
        if (rawConcepts && typeof rawConcepts === 'object' && !Array.isArray(rawConcepts)) {
            for (const [id, rawProgress] of Object.entries(rawConcepts).slice(0, maximumConceptsPerLanguage)) {
                if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id) || !rawProgress || typeof rawProgress !== 'object' || Array.isArray(rawProgress)) continue;
                const progress = rawProgress as Record<string, unknown>;
                const seen = boundedCount(progress.seen);
                const passed = Math.min(seen, boundedCount(progress.passed));
                concepts[id] = { seen, passed };
            }
        }
        const recent = Array.isArray(languageRecord.recent)
            ? languageRecord.recent
                .filter((id): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(id))
                .slice(-maximumRecentConcepts)
            : [];
        normalized[language] = { concepts, recent };
    }
    return normalized;
}

export function recordSyntaxConcept(
    learning: SyntaxDrillLearning,
    language: GateLanguage,
    conceptId: string,
    outcome: 'seen' | 'passed'
): SyntaxDrillLearning {
    const normalized = normalizeSyntaxDrillLearning(learning);
    const current = normalized[language] ?? { concepts: {}, recent: [] };
    const previous = current.concepts[conceptId] ?? { seen: 0, passed: 0 };
    const seen = outcome === 'seen' ? previous.seen + 1 : Math.max(previous.seen, previous.passed + 1);
    const passed = outcome === 'passed' ? previous.passed + 1 : previous.passed;
    return {
        ...normalized,
        [language]: {
            concepts: { ...current.concepts, [conceptId]: { seen: Math.min(999, seen), passed: Math.min(999, passed) } },
            recent: outcome === 'seen'
                ? [...current.recent.filter((id) => id !== conceptId), conceptId].slice(-maximumRecentConcepts)
                : current.recent
        }
    };
}
