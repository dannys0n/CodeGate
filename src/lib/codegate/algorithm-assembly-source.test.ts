import { describe, expect, it } from 'vitest';
import { shuffledAssemblyOrder, splitCppAssemblySource, splitPythonAssemblySource } from './algorithm-assembly-source';

describe('C++ Algorithm Assembly source splitting', () => {
    it('reconstructs a multiline reference solution exactly', () => {
        const source = `class Solution {\npublic:\n    int add(int left, int right) {\n        int result = left + right;\n        return result;\n    }\n};\n`;
        const blocks = splitCppAssemblySource(source);
        expect(blocks).toHaveLength(5);
        expect(blocks.map((block) => block.code).join('')).toBe(source);
    });

    it('falls back to structural boundaries for compact solutions', () => {
        const source = 'class Solution{public:int add(int a,int b){return a+b;}};';
        const blocks = splitCppAssemblySource(source);
        expect(blocks.length).toBeGreaterThanOrEqual(2);
        expect(blocks.map((block) => block.code).join('')).toBe(source);
    });

    it('does not split inside multiline strings or comments', () => {
        const source = `class Solution {\n/* a comment\n   with several lines */\nconst char* value = R"tag(first\nsecond)tag";\n};\n`;
        const blocks = splitCppAssemblySource(source);
        expect(blocks.map((block) => block.code).join('')).toBe(source);
        expect(blocks.every((block) => !block.code.includes('first\n') || block.code.includes('second)tag"'))).toBe(true);
    });

    it('never presents an already-correct initial order', () => {
        const blocks = splitCppAssemblySource('class S{public:int f(){int x=1;return x;}};');
        const canonical = blocks.map((block) => block.id);
        expect(shuffledAssemblyOrder(blocks, () => 0.999)).not.toEqual(canonical);
    });

    it('reconstructs Python while preserving comments and triple-quoted strings', () => {
        const source = `class Solution:\n    def solve(self, values):\n        """A docstring\n        that spans lines."""\n        # Keep this comment together.\n        total = sum(values)\n        return total\n`;
        const blocks = splitPythonAssemblySource(source);
        expect(blocks).toHaveLength(5);
        expect(blocks.map((block) => block.code).join('')).toBe(source);
        expect(blocks.every((block) => !block.code.includes('A docstring\n') || block.code.includes('that spans lines.'))).toBe(true);
    });

    it('supports compact Python separated by statements', () => {
        const source = 'def solve(value): value += 1; value *= 2; return value';
        const blocks = splitPythonAssemblySource(source);
        expect(blocks.length).toBeGreaterThanOrEqual(2);
        expect(blocks.map((block) => block.code).join('')).toBe(source);
    });
});
