import { describe, expect, it } from 'vitest';
import { truncateSyntaxDrillAfterFeatureInfo, truncateSyntaxDrillAtInfoLimit } from '../../codegate/syntax-drill-format';
import { approveSyntaxDrill, createSyntaxDrill, isSyntaxDrillApproved, syntaxDrillConsoleOutput, syntaxDrillInstruction, syntaxDrillProblemExample, syntaxDrillProblemSystemPrompt, syntaxDrillPrompt, syntaxDrillReviewPrompt, syntaxDrillResponse, syntaxDrillStarterPrompt } from './syntax-drills';
import type { SyntaxDrillConcept } from './syntax-drill-concepts';

const selectedConcept: SyntaxDrillConcept = {
    id: 'map-iteration', family: 'iteration', stage: 3,
    title: 'Iterating std::unordered_map',
    requirements: ['use a range-based for loop', 'access both key and value']
};

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
        const drill = createSyntaxDrill(problem, 'Declare the map before iterating over its entries.', 'cpp', selectedConcept, 'session', 'challenge');
        const response = syntaxDrillResponse(drill);
        expect(response.problem.functionName).toBe('solve');
        expect(response.problem.params).toEqual([]);
        expect(response.problem.testCases).toEqual([]);
        expect(response.problem.exampleCode).toContain('counts[7] = 1');
        expect(response.source).toContain('class Solution');
        expect(response.source).toContain('int solve()');
        expect(response.source).toContain('return 0;');
        expect(response.problem.info).toHaveLength(2);
        expect(response.conceptId).toBe('map-iteration');
        expect(response.conceptStage).toBe(3);
        expect(response.source).toContain('Declare the map before iterating');
        expect(response.source).not.toContain('Iterate through an unordered map once');
    });

    it('keeps user prints while removing the internal result marker', () => {
        expect(syntaxDrillConsoleOutput(['debug value\n:::RESULT:::0\n'])).toBe('debug value');
        expect(syntaxDrillConsoleOutput(['debug without newline:::RESULT:::0\n'])).toBe('debug without newline');
    });

    it('uses the callable names expected by capitalizing language runners', () => {
        expect(createSyntaxDrill(problem, 'Print once.', 'csharp', selectedConcept, 'session', 'challenge').starter).toContain('int Solve()');
        expect(createSyntaxDrill(problem, 'Print once.', 'go', selectedConcept, 'session', 'challenge').starter).toContain('func Solve() int');
    });

    it('keeps generation focused on one syntax feature rather than algorithms', () => {
        const systemPrompt = syntaxDrillProblemSystemPrompt('cpp');
        const prompt = syntaxDrillPrompt('cpp', selectedConcept);
        expect(prompt).toContain('ASSIGNED FEATURE: Iterating std::unordered_map');
        expect(prompt).toContain('access both key and value');
        expect(prompt).toContain('Generate Example and Info now');
        expect(prompt).toContain('Demonstrate the assigned feature in code');
        expect(prompt).toContain('Include its import/header when required');
        expect(prompt).toContain('Maximum eight Info bullets');
        expect(systemPrompt).toContain('Create the Example and Info');
        expect(systemPrompt).toContain('using only the assigned concept and requirements');
        expect(systemPrompt).toContain('assigned title must appear in Info');
        expect(systemPrompt).toContain('at most 5 nonblank lines');
        expect(systemPrompt).toContain('## Info');
        expect(systemPrompt).toContain('## Example');
        expect(systemPrompt).toContain('one optional flat "Required setup:" bullet');
        expect(systemPrompt).toContain('"Syntax:" with generic inline code');
        expect(systemPrompt).toContain('"Example:" with different valid inline code');
        expect(systemPrompt).toContain('exactly one flat feature bullet');
        expect(systemPrompt).toContain('Never use bold, nested bullets');
        expect(syntaxDrillInstruction(selectedConcept)).toBe('Use `Iterating std::unordered_map` once with your own values.');
        const example = syntaxDrillProblemExample('cpp');
        expect(example.request).toContain('ASSIGNED FEATURE: std::abs');
        expect(example.response).toContain('## Example');
        expect(example.response).toContain('Syntax: `std::abs(value)`');
    });

    it('retains explanations for multiple required syntax features', () => {
        const detailed = `# Use Two Features\nUse a map and sort its extracted keys.\n\n## Info\n- A map stores key-value pairs.\n- Sorting orders the extracted keys.\n- Both operations are common standard-library building blocks.`;
        const drill = createSyntaxDrill(detailed, 'Declare the required values.', 'cpp', selectedConcept, 'session', 'challenge');
        expect(drill.problem.info).toHaveLength(3);
    });

    it('keeps fenced syntax examples inside their Info item', () => {
        const fencedInfo = `# Append a Value\nAppend one value to a vector.\n\n## Info\n- push_back adds one value to the end.\n\`\`\`cpp\nvalues.push_back(7);\n\`\`\`\n- size returns the number of values, such as \`values.size()\`.`;
        const drill = createSyntaxDrill(fencedInfo, 'Append one value.', 'cpp', selectedConcept, 'session', 'challenge');
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

    it('ends streamed problem text after the expected feature Info entry', () => {
        const source = '# Drill\nTask.\n## Info\n- Required setup: import x.\n- `feature` works. Syntax: `feature(x)`. Example: `feature(1)`.\n- unrelated detail\n';
        const limited = truncateSyntaxDrillAfterFeatureInfo(source);
        expect(limited.reached).toBe(true);
        expect(limited.text).toContain('Example: `feature(1)`');
        expect(limited.text).not.toContain('unrelated detail');
    });

    it('gives editor generation only the task and requests a comment rather than code', () => {
        const prompt = syntaxDrillStarterPrompt('cpp', problem);
        expect(prompt).toContain('imperative starter comment');
        expect(prompt).toContain('Iterate through an unordered map');
        expect(prompt).toContain('no code or solution');
    });

    it('derives an instruction when the model omits the standalone task sentence', () => {
        const irregular = `# Use Clamp\n## Example\n\`\`\`cpp\nstd::clamp(value, 0, 10);\n\`\`\`\n## Notes\n- Clamp limits a value to a range.`;
        const drill = createSyntaxDrill(irregular, 'Call the relevant standard-library function.', 'cpp', selectedConcept, 'session', 'challenge');
        expect(drill.problem.statement).toBe('Practice: Use Clamp.');
        expect(drill.problem.exampleCode).toContain('std::clamp');
        expect(drill.problem.info).toContain('Clamp limits a value to a range.');
    });

    it('keeps free-form model output displayable when optional sections are absent', () => {
        const irregular = 'Use the standard-library absolute-value function on one integer.';
        const drill = createSyntaxDrill(irregular, 'Call the absolute-value function.', 'cpp', selectedConcept, 'session', 'challenge');
        expect(drill.problem.statement).toBe(irregular);
        expect(drill.problem.exampleCode).toBe('');
    });

    it('recovers a fenced example when the model omits its heading', () => {
        const irregular = '# Use Length\nUse len.\n```python\ncount = len([1, 2])\n```\n## Info\n- len counts items.';
        const drill = createSyntaxDrill(irregular, 'Count items.', 'python', selectedConcept, 'session', 'challenge');
        expect(drill.problem.exampleCode).toBe('count = len([1, 2])');
    });

    it('removes accidental program wrappers from generated examples', () => {
        const wrapped = `# Sort Values\nUse sort.\n## Example\n\`\`\`cpp\n#include <algorithm>\nint main() {\nint values[] = {2, 1};\nstd::sort(values, values + 2);\nreturn 0;\n}\n\`\`\`\n## Info\n- sort works.`;
        const drill = createSyntaxDrill(wrapped, 'Sort once.', 'cpp', selectedConcept, 'session', 'challenge');
        expect(drill.problem.exampleCode).toContain('std::sort');
        expect(drill.problem.exampleCode).not.toContain('main');
        expect(drill.problem.exampleCode).not.toContain('return 0');
    });

    it('asks the reviewer for a concise natural-language verdict', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map.', 'cpp', selectedConcept, 'session', 'challenge');
        const prompt = syntaxDrillReviewPrompt(drill, 'class Solution {};');
        expect(prompt).toContain('PASS or NEEDS WORK');
        expect(prompt).toContain('demonstrates the requested syntax with real code');
        expect(prompt).toContain('class Solution {}');
    });

    it('approves only the exact source that passed review', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map.', 'cpp', selectedConcept, 'session', 'challenge');
        approveSyntaxDrill(drill, 'approved source');
        expect(isSyntaxDrillApproved(drill, 'approved source')).toBe(true);
        expect(isSyntaxDrillApproved(drill, 'edited source')).toBe(false);
    });
});
