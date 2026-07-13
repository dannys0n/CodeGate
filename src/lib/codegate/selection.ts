import type { GateLanguage, GateSelectionPreferences, PlayableVariant, ScaffoldLevel } from './types';

const scaffoldFallbacks: Record<ScaffoldLevel, ScaffoldLevel[]> = {
    'very-easy': ['very-easy', 'easy', 'medium', 'hard', 'original'],
    easy: ['easy', 'very-easy', 'medium', 'hard', 'original'],
    medium: ['medium', 'easy', 'hard', 'very-easy', 'original'],
    hard: ['hard', 'medium', 'original', 'easy', 'very-easy'],
    original: ['original', 'hard', 'medium', 'easy', 'very-easy']
};

export function variantsForPreference(
    variants: PlayableVariant[],
    language: GateLanguage,
    scaffold: ScaffoldLevel
): PlayableVariant[] {
    const sameLanguage = variants.filter((variant) => variant.language === language);
    for (const candidateScaffold of scaffoldFallbacks[scaffold]) {
        const matches = sameLanguage.filter((variant) => variant.scaffold === candidateScaffold);
        if (matches.length > 0) return matches;
    }
    return [];
}

export function selectChallenge(
    variants: PlayableVariant[],
    preferences: GateSelectionPreferences,
    random: () => number = Math.random
): PlayableVariant | null {
    const preferred = variantsForPreference(variants, preferences.language, preferences.scaffold);
    if (preferred.length === 0) return null;

    const recent = new Set(preferences.recentProblemIds ?? []);
    const fresh = preferred.filter((variant) => !recent.has(variant.problemId));
    const pool = fresh.length > 0 ? fresh : preferred;
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    return pool[index] ?? null;
}
