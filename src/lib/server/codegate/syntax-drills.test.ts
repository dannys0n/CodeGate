import { describe, expect, it } from 'vitest';
import { truncateSyntaxDrillAfterFeatureInfo, truncateSyntaxDrillAtInfoLimit } from '../../codegate/syntax-drill-format';
import { approveSyntaxDrill, createSyntaxDrill, isSyntaxDrillApproved, isUsableSyntaxDrillTitle, normalizeSyntaxDrillTitle, syntaxDrillConsoleOutput, syntaxDrillInstruction, syntaxDrillProblemExample, syntaxDrillProblemSystemPrompt, syntaxDrillPrompt, syntaxDrillReviewPrompt, syntaxDrillResponse, syntaxDrillStarterPrompt, syntaxDrillTitleCategory, syntaxDrillTitlePrompt, syntaxDrillTitlesOverlap } from './syntax-drills';

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
        const systemPrompt = syntaxDrillProblemSystemPrompt('cpp');
        const prompt = syntaxDrillPrompt('cpp', 'Use std::exchange');
        expect(prompt).toContain('ASSIGNED FEATURE: Use std::exchange');
        expect(prompt).toContain('Generate Example and Info now');
        expect(prompt).toContain('Use this exact feature spelling in the code and Info');
        expect(prompt).toContain('Include its import/header when required');
        expect(prompt).toContain('Maximum eight Info bullets');
        expect(systemPrompt).toContain('Create the Example and Info');
        expect(systemPrompt).toContain('Never substitute another API');
        expect(systemPrompt).toContain('assigned name must appear in Info');
        expect(systemPrompt).toContain('at most 5 nonblank lines');
        expect(systemPrompt).toContain('## Info');
        expect(systemPrompt).toContain('## Example');
        expect(systemPrompt).toContain('one optional flat "Required setup:" bullet');
        expect(systemPrompt).toContain('"Syntax:" with generic inline code');
        expect(systemPrompt).toContain('"Example:" with different valid inline code');
        expect(systemPrompt).toContain('exactly one flat feature bullet');
        expect(systemPrompt).toContain('Never use bold, nested bullets');
        expect(titlePrompt).toContain('LANGUAGE MUST BE cpp');
        expect(titlePrompt).toContain('REQUIRED CATEGORY: fundamental or scalar data type');
        expect(titlePrompt).toContain('Never invent a name or switch categories');
        expect(titlePrompt).toContain('seed 42');
        expect(titlePrompt).toContain('canonical topic name in 1-5 words');
        expect(syntaxDrillTitleCategory('python', 1)).toBe('container or data-storage type');
        expect(syntaxDrillTitleCategory('python', 1, ['container or data-storage type'])).toBe('callable, function definition, or function type syntax');
        expect(syntaxDrillTitlesOverlap('std::sort', 'sort')).toBe(true);
        expect(syntaxDrillTitlesOverlap('list.sort', 'sorted')).toBe(true);
        expect(syntaxDrillTitlesOverlap('Move semantics', 'move constructor')).toBe(true);
        expect(syntaxDrillTitlesOverlap('list comprehension', 'list')).toBe(false);
        expect(syntaxDrillTitlesOverlap('lambda expressions', 'lambda expression')).toBe(true);
        expect(syntaxDrillTitlesOverlap('Union type', 'Union type syntax (using |)')).toBe(true);
        expect(syntaxDrillTitlesOverlap('std::vector', 'lambda expression')).toBe(false);
        expect(syntaxDrillInstruction('std::exchange')).toBe('Use `std::exchange` once with your own values.');
        const example = syntaxDrillProblemExample('cpp');
        expect(example.request).toContain('ASSIGNED FEATURE: std::abs');
        expect(example.response).toContain('## Example');
        expect(example.response).toContain('Syntax: `std::abs(value)`');
    });

    it('normalizes common title-only response variations', () => {
        expect(normalizeSyntaxDrillTitle('## Title: Exchange Two Values!')).toBe('Exchange Two Values');
        expect(normalizeSyntaxDrillTitle('```text\nFormat a Duration\n```')).toBe('Format a Duration');
        expect(normalizeSyntaxDrillTitle('Arrays#sort')).toBe('Arrays.sort');
        expect(normalizeSyntaxDrillTitle('range(10)')).toBe('range');
        expect(normalizeSyntaxDrillTitle('StringBuilder.\nappend')).toBe('StringBuilder.append');
        expect(normalizeSyntaxDrillTitle('auto return type deduction for')).toBe('auto return type deduction');
        expect(normalizeSyntaxDrillTitle('One Two Three Four Five Six Seven Eight')).toBe('One Two Three Four Five');
        expect(isUsableSyntaxDrillTitle('<no_think>\nCore operator', '<no_think>')).toBe(false);
        expect(isUsableSyntaxDrillTitle('std::swap\n</think>', 'std::swap')).toBe(true);
        expect(isUsableSyntaxDrillTitle('fn std::io::write', 'fn std::io::write')).toBe(false);
        expect(isUsableSyntaxDrillTitle('sync.WaitGroup', 'sync.WaitGroup')).toBe(false);
        expect(isUsableSyntaxDrillTitle('std::env::vars', 'std::env::vars')).toBe(false);
        expect(isUsableSyntaxDrillTitle('[T](...)', '[T](...)')).toBe(false);
        expect(isUsableSyntaxDrillTitle('def f():', 'def f()')).toBe(false);
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

    it('recovers a fenced example when the model omits its heading', () => {
        const irregular = '# Use Length\nUse len.\n```python\ncount = len([1, 2])\n```\n## Info\n- len counts items.';
        const drill = createSyntaxDrill(irregular, 'Count items.', 'python', 'session', 'challenge');
        expect(drill.problem.exampleCode).toBe('count = len([1, 2])');
    });

    it('removes accidental program wrappers from generated examples', () => {
        const wrapped = `# Sort Values\nUse sort.\n## Example\n\`\`\`cpp\n#include <algorithm>\nint main() {\nint values[] = {2, 1};\nstd::sort(values, values + 2);\nreturn 0;\n}\n\`\`\`\n## Info\n- sort works.`;
        const drill = createSyntaxDrill(wrapped, 'Sort once.', 'cpp', 'session', 'challenge');
        expect(drill.problem.exampleCode).toContain('std::sort');
        expect(drill.problem.exampleCode).not.toContain('main');
        expect(drill.problem.exampleCode).not.toContain('return 0');
    });

    it('asks the reviewer for a concise natural-language verdict', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map.', 'cpp', 'session', 'challenge');
        const prompt = syntaxDrillReviewPrompt(drill, 'class Solution {};');
        expect(prompt).toContain('PASS or NEEDS WORK');
        expect(prompt).toContain('demonstrates the requested syntax with real code');
        expect(prompt).toContain('class Solution {}');
    });

    it('approves only the exact source that passed review', () => {
        const drill = createSyntaxDrill(problem, 'Declare the map.', 'cpp', 'session', 'challenge');
        approveSyntaxDrill(drill, 'approved source');
        expect(isSyntaxDrillApproved(drill, 'approved source')).toBe(true);
        expect(isSyntaxDrillApproved(drill, 'edited source')).toBe(false);
    });
});
