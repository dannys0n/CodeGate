import type { ProgrammingLanguage } from '$lib/utils/util';

export const difficultyLevels = ['0', '25', '50', '75', '100'] as const;
export type DifficultyLevel = (typeof difficultyLevels)[number];
export const gateLanguages = ['java', 'python', 'cpp', 'csharp', 'rust', 'go', 'typescript'] as const satisfies readonly ProgrammingLanguage[];
export type GateLanguage = (typeof gateLanguages)[number];

export type CandidateLanguage = {
    solutionSource: string;
    solution: string;
    solutionSha256: string;
};

export type CandidateProblem = {
    slug: string;
    record: string;
    recordSha256: string;
    judgeSha256: string;
    judge?: {
        kind: 'generated-exact';
        metadata: Record<string, unknown>;
        testRecord: { file: string; offset: number; length: number; sha256: string };
    };
    languages: Partial<Record<GateLanguage, CandidateLanguage>>;
};

export type CandidateManifest = {
    schemaVersion: 2;
    generatorVersion: number;
    generatedAt: string;
    sourceRevision: string;
    sources: Record<string, string>;
    problems: Record<string, CandidateProblem>;
    quarantine: Array<{ problemId: string; reason: string }>;
};

export type PlayableVariant = {
    problemId: string;
    title: string;
    leetcodeDifficulty: string;
    language: GateLanguage;
    difficulty: DifficultyLevel;
    sourceSha256: string;
    judgeSha256: string;
    preparedAt: string;
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
