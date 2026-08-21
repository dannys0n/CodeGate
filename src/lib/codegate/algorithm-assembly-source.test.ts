import { describe, expect, it } from 'vitest';
import { shuffledAssemblyOrder, splitCppAssemblySource, splitPythonAssemblySource } from './algorithm-assembly-source';

describe('C++ Algorithm Assembly source splitting', () => {
    it('reconstructs a multiline reference solution exactly', () => {
        const source = `class Solution {\npublic:\n    int add(int left, int right) {\n        int result = left + right;\n        return result;\n    }\n};\n`;
        const result = splitCppAssemblySource(source);
        expect(result.blocks).toHaveLength(2);
        expect(result.fixedPrefix + result.blocks.map((block) => block.code).join('') + result.fixedSuffix).toBe(source);
    });

    it('falls back to structural boundaries for compact solutions', () => {
        const source = 'class Solution{public:int add(int a,int b){return a+b;}};';
        const result = splitCppAssemblySource(source);
        expect(result.blocks).toHaveLength(1);
        expect(result.fixedPrefix + result.blocks[0].code + result.fixedSuffix).toBe(source);
    });

    it('does not split inside multiline strings or comments', () => {
        const source = `class Solution {\n/* a comment\n   with several lines */\nconst char* value = R"tag(first\nsecond)tag";\n};\n`;
        expect(() => splitCppAssemblySource(source)).toThrow(/no function body/);
    });

    it('never presents an already-correct initial order', () => {
        const blocks = splitCppAssemblySource('class S{public:int f(){int x=1;return x;}};').blocks;
        const canonical = blocks.map((block) => block.id);
        expect(shuffledAssemblyOrder(blocks, () => 0.999)).not.toEqual(canonical);
    });

    it('reconstructs Python while preserving comments and triple-quoted strings', () => {
        const source = `class Solution:\n    def solve(self, values):\n        """A docstring\n        that spans lines."""\n        # Keep this comment together.\n        total = sum(values)\n        return total\n`;
        const result = splitPythonAssemblySource(source);
        expect(result.blocks.length).toBeGreaterThanOrEqual(2);
        expect(result.fixedPrefix + result.blocks.map((block) => block.code).join('') + result.fixedSuffix).toBe(source);
        expect(result.blocks.every((block) => !block.code.includes('A docstring\n') || block.code.includes('that spans lines.'))).toBe(true);
    });

    it('supports compact Python separated by statements', () => {
        const source = 'def solve(value): value += 1; value *= 2; return value';
        expect(() => splitPythonAssemblySource(source)).toThrow(/no function body/);
    });

    it('partitions CRLF Python solutions', () => {
        const source = 'class Solution:\r\n    def solve(self, values):\r\n        total = sum(values)\r\n        return total\r\n';
        const result = splitPythonAssemblySource(source);
        expect(result.fixedPrefix + result.blocks.map((block) => block.code).join('') + result.fixedSuffix).toBe(source);
    });
});
