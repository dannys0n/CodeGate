import { describe, expect, it } from 'vitest';
import { parseKeywordArguments, parsePythonLiteral } from '../../../../src/lib/codegate/python-literal.mjs';
import { parsePythonSignature } from './neenza.mjs';
import { generateExactMarker } from '../../../../src/lib/codegate/exact-marker.mjs';
import { normalizeForRunner } from './solutions.mjs';

describe('LeetCode source adapters', () => {
  it('parses restricted Python literals without evaluating code', () => {
    expect(parseKeywordArguments('nums = [2, 7, -1], target = 6, enabled = True')).toEqual({
      nums: [2, 7, -1], target: 6, enabled: true
    });
    expect(parsePythonLiteral("[['a'], ['b']]" )).toEqual([['a'], ['b']]);
    expect(() => parsePythonLiteral('__import__("os")')).toThrow();
  });

  it('normalizes supported Neenza signatures and rejects object types', () => {
    expect(parsePythonSignature('class Solution:\n    def solve(self, nums: List[int], labels: List[str]) -> bool:\n        ')).toEqual({
      functionName: 'solve',
      params: [{ name: 'nums', type: 'int_array' }, { name: 'labels', type: 'string_array' }],
      outputType: 'boolean'
    });
    expect(() => parsePythonSignature('class Solution:\n    def solve(self, root: TreeNode) -> int:\n        ')).toThrow(/unsupported/);
  });

  it('generates a deterministic exact-output Marker.java', () => {
    const metadata = { functionName: 'answer', params: [{ name: 'value', type: 'int' }], outputType: 'int' };
    const marker = generateExactMarker(metadata, [{ input: { value: 2 }, output: 4 }]);
    expect(marker).toContain('public int answer(int value)');
    expect(marker).toContain('if (value == 2) return 4;');
    expect(marker).toContain('isCorrect');
  });

  it('adds only the wrappers required by existing judge runners', () => {
    expect(normalizeForRunner('java', 'class Solution {}', 'twoSum')).toContain('import java.util.*;');
    expect(normalizeForRunner('csharp', 'public class Solution {}', 'twoSum')).toContain('using System.Collections.Generic;');
    expect(normalizeForRunner('go', 'func twoSum(nums []int) []int { return nums }', 'twoSum')).toContain('func TwoSum(');
    expect(normalizeForRunner('typescript', 'function twoSum(): number[] { return []; }', 'twoSum')).toContain('export function twoSum(');
    expect(normalizeForRunner('rust', 'impl Solution {}', 'twoSum')).toBe('impl Solution {}\n');
  });
});
