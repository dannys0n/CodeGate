import { describe, expect, it } from 'vitest';
import { generateExactMarker } from '../../src/lib/codegate/exact-marker.mjs';
import { extractExactCases, officialTests } from '../../src/lib/codegate/test-vectors.mjs';
import { normalizeSource } from '../../src/lib/codegate/source-transform.mjs';
import { availableProblemCatalog } from '../../src/lib/server/codegate/runtime-challenge';
import { bridgeProblems } from './bridge-problems.mjs';

describe('CodeGate bridge problems', () => {
    it('defines a continuous negative progression with C++ and Python sources', () => {
        expect(bridgeProblems).toHaveLength(90);
        expect(bridgeProblems.map((problem) => problem.number)).toEqual(
            Array.from({ length: 90 }, (_, index) => index - 90)
        );
        expect(new Set(bridgeProblems.map((problem) => problem.slug)).size).toBe(bridgeProblems.length);
        for (const problem of bridgeProblems) {
            expect(problem.metadata.difficulty).toBe('Beginner');
            expect(problem.solutions.python).toContain(`def ${problem.metadata.functionName}(`);
            expect(problem.solutions.cpp).toContain(`${problem.metadata.functionName}(`);
        }
    });

    it('contains valid typed exact cases and generated judge markers', () => {
        for (const problem of bridgeProblems) {
            const cases = extractExactCases({ exact_cases: problem.cases }, problem.metadata);
            expect(cases.length, problem.slug).toBe(problem.cases.length);
            expect(officialTests(cases, problem.metadata).length, problem.slug).toBeGreaterThanOrEqual(5);
            expect(generateExactMarker(problem.metadata, cases), problem.slug).toContain('class Marker');
        }
    });

    it('normalizes every reference solution for the existing runners', () => {
        for (const problem of bridgeProblems) {
            expect(normalizeSource('python', problem.solutions.python, problem.metadata.functionName, 'solution'), problem.slug)
                .toContain('class Solution');
            expect(normalizeSource('cpp', problem.solutions.cpp, problem.metadata.functionName, 'solution'), problem.slug)
                .toContain('class Solution');
        }
    });

    it('appears only in the C++ and Python catalogue, independent of ordinary filters', async () => {
        for (const language of ['cpp', 'python'] as const) {
            const catalogue = await availableProblemCatalog(language, ['Hard'], { min: 100, max: 200 });
            const bridgeEntries = catalogue.filter((entry) => entry.number < 0);
            expect(bridgeEntries).toHaveLength(90);
            expect(bridgeEntries.map((entry) => entry.number)).toEqual(
                Array.from({ length: 90 }, (_, index) => index - 90)
            );
            expect(bridgeEntries.every((entry) => entry.leetcodeDifficulty === 'Beginner')).toBe(true);
            expect(bridgeEntries[0]?.title).toBe('Add Two Numbers');
            expect(bridgeEntries.at(-1)?.title).toBe('Word Initials');
        }
        const javaCatalogue = await availableProblemCatalog('java', ['Easy', 'Medium', 'Hard'], { min: null, max: null });
        expect(javaCatalogue.some((entry) => entry.number < 0)).toBe(false);
    });
});
