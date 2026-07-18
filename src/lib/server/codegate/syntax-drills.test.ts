import { describe, expect, it } from 'vitest';
import { approveSyntaxDrill, createSyntaxDrill, isSyntaxDrillApproved, syntaxDrillPrompt, syntaxDrillReviewPrompt, syntaxDrillResponse } from './syntax-drills';

const problem = `# Iterate a Map
Iterate through an unordered map once using a range-based loop.

## Info
- An unordered map stores key-value pairs.
- Iteration is useful when every stored pair must be visited.`;

describe('AI syntax drills', () => {
    it('creates a deterministic compile-only scaffold without test cases', () => {
        const drill = createSyntaxDrill(problem, 'cpp', 'session', 'challenge');
        const response = syntaxDrillResponse(drill);
        expect(response.problem.functionName).toBe('solve');
        expect(response.problem.params).toEqual([]);
        expect(response.problem.testCases).toEqual([]);
        expect(response.source).toContain('class Solution');
        expect(response.source).toContain('void solve()');
        expect(response.problem.info).toHaveLength(2);
        expect(response.source).toContain('Iterate through an unordered map');
    });

    it('keeps generation focused on one syntax feature rather than algorithms', () => {
        const prompt = syntaxDrillPrompt('cpp', 42);
        expect(prompt).toContain('This is not an algorithm problem');
        expect(prompt).toContain('one to five short lines');
        expect(prompt).toContain('random seed 42');
        expect(prompt).toContain('## Info');
        expect(prompt).toContain('common use');
    });

    it('asks the reviewer for a concise natural-language verdict', () => {
        const drill = createSyntaxDrill(problem, 'cpp', 'session', 'challenge');
        const prompt = syntaxDrillReviewPrompt(drill, 'class Solution {};');
        expect(prompt).toContain('PASS or NEEDS WORK');
        expect(prompt).toContain('not an algorithm review');
        expect(prompt).toContain('class Solution {}');
    });

    it('approves only the exact source that passed review', () => {
        const drill = createSyntaxDrill(problem, 'cpp', 'session', 'challenge');
        approveSyntaxDrill(drill, 'approved source');
        expect(isSyntaxDrillApproved(drill, 'approved source')).toBe(true);
        expect(isSyntaxDrillApproved(drill, 'edited source')).toBe(false);
    });
});
