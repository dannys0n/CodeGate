import type { ProgrammingLanguage } from '$lib/utils/util';

export const difficultyLevels = ['0', '25', '50', '75', '100'] as const;
export type DifficultyLevel = (typeof difficultyLevels)[number];
export type GateLanguage = Extract<ProgrammingLanguage, 'python' | 'cpp'>;

export type PlayableVariant = {
    problemId: string;
    title: string;
    leetcodeDifficulty: string;
    language: GateLanguage;
    difficulty: DifficultyLevel;
    sourcePath: string;
    sourceSha256: string;
    judgeSha256: string;
    validatedAt: string;
    validationStatus: 'validated';
};

export type PlayableManifest = {
    schemaVersion: 1;
    generatedAt: string;
    sourceRevision: string;
    variants: PlayableVariant[];
};

export type GateSelectionPreferences = {
    language: GateLanguage;
    difficulty: DifficultyLevel;
    recentProblemIds?: string[];
};
