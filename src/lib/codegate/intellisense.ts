import type { GateLanguage } from './types';

export const intellisenseLanguages: GateLanguage[] = ['cpp', 'python', 'java', 'csharp', 'rust', 'go', 'typescript'];

export const intellisenseLanguageNames: Record<GateLanguage, string> = {
    cpp: 'C++',
    python: 'Python',
    java: 'Java',
    csharp: 'C#',
    rust: 'Rust',
    go: 'Go',
    typescript: 'TypeScript'
};

export function isIntellisenseLanguage(value: unknown): value is GateLanguage {
    return typeof value === 'string' && intellisenseLanguages.includes(value as GateLanguage);
}
