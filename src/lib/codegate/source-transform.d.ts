export const sourceTransformVersion: number;
export function starterField(language: string): string | undefined;
export function normalizeSource(language: string, source: string, functionName: string, kind?: 'starter' | 'solution'): string | undefined;
export function stripSolution(source: string, language: string, percent: number, hints?: string[]): string;
