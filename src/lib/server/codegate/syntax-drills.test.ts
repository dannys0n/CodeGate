import { describe, expect, it } from 'vitest';
import { truncateSyntaxDrillAtInfoLimit } from '../../codegate/syntax-drill-format';
import { approveSyntaxDrill, createSyntaxDrill, isSyntaxDrillApproved, normalizeSyntaxDrillTitle, syntaxDrillConsoleOutput, syntaxDrillPrompt, syntaxDrillReviewPrompt, syntaxDrillResponse, syntaxDrillStarterPrompt, syntaxDrillTitlePrompt } from './syntax-drills';

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
    it('creates a deterministic runnable scaffold without authored test cases', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map before iterating over its entries.', 'cpp', 'session', 'challenge');
        const response = syntaxDrillResponse(drill);
        expect(response.problem.functionName).toBe('solve');
        expect(response.problem.params).toEqual([]);
        expect(response.problem.testCases).toEqual([]);
        expect(response.problem.exampleCode).toContain('counts[7] = 1');
        expect(response.source).toContain('class Solution');
        expect(response.source).toContain('int solve()');
        expect(response.source).toContain('return 0;');
        expect(response.problem.info).toHaveLength(2);
        expect(response.source).toContain('Declare the map before iterating');
        expect(response.source).not.toContain('Iterate through an unordered map once');
    });

    it('keeps user prints while removing the internal result marker', () => {
        expect(syntaxDrillConsoleOutput(['debug value\n:::RESULT:::0\n'])).toBe('debug value');
        expect(syntaxDrillConsoleOutput(['debug without newline:::RESULT:::0\n'])).toBe('debug without newline');
    });

    it('uses the callable names expected by capitalizing language runners', () => {
        expect(createSyntaxDrill(problem, 'Print once.', 'csharp', 'session', 'challenge').starter).toContain('int Solve()');
        expect(createSyntaxDrill(problem, 'Print once.', 'go', 'session', 'challenge').starter).toContain('func Solve() int');
    });

    it('keeps generation focused on one syntax feature rather than algorithms', () => {
        const titlePrompt = syntaxDrillTitlePrompt('cpp', 42);
        const prompt = syntaxDrillPrompt('cpp', 'Use std::exchange');
        expect(prompt).toContain('This is not an algorithm problem');
        expect(prompt).toContain('titled "Use std::exchange"');
        expect(prompt).toContain('authoritative syntax feature or API');
        expect(prompt).toContain('one to five short lines');
        expect(prompt).toContain('## Info');
        expect(prompt).toContain('## Example');
        expect(prompt).toContain('directly shows the exact syntax or standard-library API required');
        expect(prompt).toContain('every header or import required for the feature');
        expect(prompt).toContain('use different names or values');
        expect(prompt).toContain('briefly explain what it does');
        expect(prompt).toContain('generic syntax template with placeholder names');
        expect(prompt).toContain('filled-in valid example using concrete names and values');
        expect(prompt).toContain('group every required header or import into this single entry');
        expect(prompt).toContain('Headers and imports are setup, not syntax features');
        expect(prompt).toContain('does not need a generic Syntax template or filled-in Example');
        expect(prompt).toContain('both the generic Syntax template and the distinct filled-in Example are mandatory');
        expect(prompt).toContain('no more than eight Info entries');
        expect(prompt).toContain('Keep every Info entry on one line');
        expect(titlePrompt).toContain("anything from cpp's standard library");
        expect(titlePrompt).toContain('30 seconds or less using one to five short lines');
        expect(titlePrompt).toContain('Avoid defaulting to containers, loops, printing');
        expect(titlePrompt).toContain('random seed 42');
        expect(titlePrompt).toContain('Return only a descriptive title under seven words');
    });

    it('normalizes common title-only response variations', () => {
        expect(normalizeSyntaxDrillTitle('## Title: Exchange Two Values!')).toBe('Exchange Two Values');
        expect(normalizeSyntaxDrillTitle('```text\nFormat a Duration\n```')).toBe('Format a Duration');
    });

    it('retains explanations for multiple required syntax features', () => {
        const detailed = `# Use Two Features\nUse a map and sort its extracted keys.\n\n## Info\n- A map stores key-value pairs.\n- Sorting orders the extracted keys.\n- Both operations are common standard-library building blocks.`;
        const drill = createSyntaxDrill(detailed, 'Declare the required values.', 'cpp', 'session', 'challenge');
        expect(drill.problem.info).toHaveLength(3);
    });

    it('keeps fenced syntax examples inside their Info item', () => {
        const fencedInfo = `# Append a Value\nAppend one value to a vector.\n\n## Info\n- push_back adds one value to the end.\n\`\`\`cpp\nvalues.push_back(7);\n\`\`\`\n- size returns the number of values, such as \`values.size()\`.`;
        const drill = createSyntaxDrill(fencedInfo, 'Append one value.', 'cpp', 'session', 'challenge');
        expect(drill.problem.info).toHaveLength(2);
        expect(drill.problem.info[0]).toContain('values.push_back(7);');
        expect(drill.problem.info[0]).toContain('```cpp');
        expect(drill.problem.info[1]).toContain('values.size()');
    });

    it('ends streamed problem text after the eighth completed Info entry', () => {
        const entries = Array.from({ length: 9 }, (_, index) => `- Info ${index + 1}: Syntax: \`item${index + 1}\`. Example: \`value${index + 1}\`.`).join('\n');
        const limited = truncateSyntaxDrillAtInfoLimit(`# Drill\nTask.\n## Info\n${entries}\nclosing text`);
        expect(limited.reached).toBe(true);
        expect(limited.text).toContain('Info 8');
        expect(limited.text).not.toContain('Info 9');
        expect(limited.text).not.toContain('closing text');
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
