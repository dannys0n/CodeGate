import type { ProgrammingLanguage } from '$lib/utils/util';

export const scaffoldLevels = ['very-easy', 'easy', 'medium', 'hard', 'original'] as const;
export type ScaffoldLevel = (typeof scaffoldLevels)[number];
export type GateLanguage = Extract<ProgrammingLanguage, 'python' | 'cpp'>;

export type PlayableVariant = {
    problemId: string;
    title: string;
    leetcodeDifficulty: string;
    language: GateLanguage;
    scaffold: ScaffoldLevel;
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
    scaffold: ScaffoldLevel;
    recentProblemIds?: string[];
};
