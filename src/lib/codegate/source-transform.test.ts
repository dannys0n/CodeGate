import { describe, expect, it } from 'vitest';
import { normalizeSource, stripSolution } from './source-transform.mjs';

describe('CodeGate in-memory source transforms', () => {
    it('keeps partial difficulties nested and replaces removed regions with hints', () => {
        const source = [
            'from typing import *',
            '',
            'class Solution:',
            '    def answer(self, value: int) -> int:',
            '        first = value + 1',
            '        second = first * 2',
            '        third = second - 3',
            '        return third',
            ''
        ].join('\n');
        const at25 = stripSolution(source, 'python', 25, ['Work from the input.']);
        const at50 = stripSolution(source, 'python', 50, ['Work from the input.']);
        const at75 = stripSolution(source, 'python', 75, ['Work from the input.']);

        expect(at25).toContain('first = value + 1');
        expect(at25).not.toContain('second = first * 2');
        expect(at25).toContain('Hint: Work from the input.');
        expect(at50).toContain('second = first * 2');
        expect(at50).not.toContain('third = second - 3');
        expect(at75).toContain('third = second - 3');
        expect(at75).not.toContain('return third');
    });

    it('adds only runner wrappers to a baseline', () => {
        expect(normalizeSource('go', 'func twoSum() []int { return nil }', 'twoSum')).toContain('func TwoSum(');
        expect(normalizeSource('typescript', 'function twoSum(): number[] { return []; }', 'twoSum')).toContain('export function twoSum(');
    });

    it('adds only the Go standard-library imports referenced by a solution', () => {
        const transformed = normalizeSource('go', 'func answer(a []int) { sort.Ints(a); _ = strings.Join(nil, "") }', 'answer');
        expect(transformed).toContain('import "sort"');
        expect(transformed).toContain('import "strings"');
        expect(transformed).not.toContain('import "math"');
    });

    it('provides StringBuilder to imported C# solutions', () => {
        expect(normalizeSource('csharp', 'class Solution { StringBuilder value = new(); }', 'answer')).toContain('using System.Text;');
    });

    it('provides the LeetCode priority queue API only when TypeScript uses it', () => {
        const withQueue = normalizeSource('typescript', 'function answer() { return new MinPriorityQueue<number>(); }', 'answer');
        const withoutQueue = normalizeSource('typescript', 'function answer() { return 1; }', 'answer');
        expect(withQueue).toContain('class MinPriorityQueue<T>');
        expect(withQueue).toContain('dequeue(): T');
        expect(withoutQueue).not.toContain('class PriorityQueue<T>');
    });

    it('removes exactly one implementation line at 99% regardless of solution length', () => {
        const implementation = Array.from({ length: 120 }, (_, index) => `        value += ${index}`);
        const source = ['class Solution:', '    def answer(self, value: int) -> int:', ...implementation, '        return value'].join('\n');
        const transformed = stripSolution(source, 'python', 99, ['Finish the implementation.']);
        const missing = [...implementation, '        return value'].filter((line) => !transformed.includes(line));

        expect(missing).toHaveLength(1);
        expect(transformed).toContain('Hint: Finish the implementation.');
    });
});
