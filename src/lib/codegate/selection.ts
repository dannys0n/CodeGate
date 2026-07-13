import type { DifficultyLevel, GateLanguage, GateSelectionPreferences, PlayableVariant } from './types';

const difficultyFallbacks: Record<DifficultyLevel, DifficultyLevel[]> = {
    '0': ['0', '25', '50', '75', '100'],
    '25': ['25', '0', '50', '75', '100'],
    '50': ['50', '25', '75', '0', '100'],
    '75': ['75', '50', '100', '25', '0'],
    '100': ['100', '75', '50', '25', '0']
};

export function variantsForPreference(
    variants: PlayableVariant[],
    language: GateLanguage,
    difficulty: DifficultyLevel
): PlayableVariant[] {
    const sameLanguage = variants.filter((variant) => variant.language === language);
    for (const candidateDifficulty of difficultyFallbacks[difficulty]) {
        const matches = sameLanguage.filter((variant) => variant.difficulty === candidateDifficulty);
        if (matches.length > 0) return matches;
    }
    return [];
}

export function selectChallenge(
    variants: PlayableVariant[],
    preferences: GateSelectionPreferences,
    random: () => number = Math.random
): PlayableVariant | null {
    const preferred = variantsForPreference(variants, preferences.language, preferences.difficulty);
    if (preferred.length === 0) return null;

    const recent = new Set(preferences.recentProblemIds ?? []);
    const fresh = preferred.filter((variant) => !recent.has(variant.problemId));
    const pool = fresh.length > 0 ? fresh : preferred;
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    return pool[index] ?? null;
}
