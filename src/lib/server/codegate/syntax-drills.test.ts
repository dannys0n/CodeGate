import { describe, expect, it } from 'vitest';
import { approveSyntaxDrill, createSyntaxDrill, isSyntaxDrillApproved, syntaxDrillPrompt, syntaxDrillReviewPrompt, syntaxDrillResponse, syntaxDrillStarterPrompt } from './syntax-drills';

const problem = `# Iterate a Map
Iterate through an unordered map once using a range-based loop.

## Example
\`\`\`cpp
unordered_map<int, int> counts;
counts[7] = 1;
\`\`\`

## Info
- An unordered map stores key-value pairs.
- Iteration is useful when every stored pair must be visited.`;

describe('AI syntax drills', () => {
    it('creates a deterministic compile-only scaffold without test cases', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map before iterating over its entries.', 'cpp', 'session', 'challenge');
        const response = syntaxDrillResponse(drill);
        expect(response.problem.functionName).toBe('solve');
        expect(response.problem.params).toEqual([]);
        expect(response.problem.testCases).toEqual([]);
        expect(response.problem.exampleCode).toContain('counts[7] = 1');
        expect(response.source).toContain('class Solution');
        expect(response.source).toContain('void solve()');
        expect(response.problem.info).toHaveLength(2);
        expect(response.source).toContain('Declare the map before iterating');
        expect(response.source).not.toContain('Iterate through an unordered map once');
    });

    it('keeps generation focused on one syntax feature rather than algorithms', () => {
        const prompt = syntaxDrillPrompt('cpp', 42);
        expect(prompt).toContain('This is not an algorithm problem');
        expect(prompt).toContain("anything from cpp's standard library");
        expect(prompt).toContain('Do not repeatedly favor containers or iteration');
        expect(prompt).toContain('one to five short lines');
        expect(prompt).toContain('random seed 42');
        expect(prompt).toContain('## Info');
        expect(prompt).toContain('## Example');
        expect(prompt).toContain('tiny 1-3 line example');
        expect(prompt).toContain('common use');
    });

    it('gives editor generation only the task and requests a comment rather than code', () => {
        const prompt = syntaxDrillStarterPrompt('cpp', problem);
        expect(prompt).toContain('inline starter comment');
        expect(prompt).toContain('Iterate through an unordered map');
        expect(prompt).toContain('Do not provide code');
    });

    it('derives an instruction when the model omits the standalone task sentence', () => {
        const irregular = `# Use Clamp\n## Example\n\`\`\`cpp\nstd::clamp(value, 0, 10);\n\`\`\`\n## Notes\n- Clamp limits a value to a range.`;
        const drill = createSyntaxDrill(irregular, 'Call the relevant standard-library function.', 'cpp', 'session', 'challenge');
        expect(drill.problem.statement).toBe('Practice: Use Clamp.');
        expect(drill.problem.exampleCode).toContain('std::clamp');
        expect(drill.problem.info).toContain('Clamp limits a value to a range.');
    });

    it('keeps free-form model output displayable when optional sections are absent', () => {
        const irregular = 'Use the standard-library absolute-value function on one integer.';
        const drill = createSyntaxDrill(irregular, 'Call the absolute-value function.', 'cpp', 'session', 'challenge');
        expect(drill.problem.statement).toBe(irregular);
        expect(drill.problem.exampleCode).toBe('');
    });

    it('asks the reviewer for a concise natural-language verdict', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map.', 'cpp', 'session', 'challenge');
        const prompt = syntaxDrillReviewPrompt(drill, 'class Solution {};');
        expect(prompt).toContain('PASS or NEEDS WORK');
        expect(prompt).toContain('not an algorithm review');
        expect(prompt).toContain('class Solution {}');
    });

    it('approves only the exact source that passed review', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map.', 'cpp', 'session', 'challenge');
        approveSyntaxDrill(drill, 'approved source');
        expect(isSyntaxDrillApproved(drill, 'approved source')).toBe(true);
        expect(isSyntaxDrillApproved(drill, 'edited source')).toBe(false);
    });
});
