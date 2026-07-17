import { describe, expect, it } from 'vitest';
import { parseKeywordArguments, parsePythonLiteral } from '../../../../src/lib/codegate/python-literal.mjs';
import { parsePythonSignature } from './neenza.mjs';
import { canUseExactCases } from './leetcode-bundle.mjs';
import { generateExactMarker } from '../../../../src/lib/codegate/exact-marker.mjs';
import { normalizeForRunner } from './solutions.mjs';
import { extractExactCases } from '../../../../src/lib/codegate/test-vectors.mjs';

describe('LeetCode source adapters', () => {
  it('parses restricted Python literals without evaluating code', () => {
    expect(parseKeywordArguments('nums = [2, 7, -1], target = 6, enabled = True')).toEqual({
      nums: [2, 7, -1], target: 6, enabled: true
    });
    expect(parsePythonLiteral("[['a'], ['b']]" )).toEqual([['a'], ['b']]);
    expect(() => parsePythonLiteral('__import__("os")')).toThrow();
  });

  it('normalizes supported Neenza signatures and rejects unsupported object types', () => {
    expect(parsePythonSignature('class Solution:\n    def solve(self, nums: List[int], labels: List[str]) -> bool:\n        ')).toEqual({
      functionName: 'solve',
      params: [{ name: 'nums', type: 'int_array' }, { name: 'labels', type: 'string_array' }],
      outputType: 'boolean'
    });
    expect(() => parsePythonSignature('class Solution:\n    def solve(self, node: GraphNode) -> int:\n        ')).toThrow(/unsupported/);
  });

  it('selects the Solution method instead of helper constructors', () => {
    const starter = [
      'class ListNode:',
      '    def __init__(self, val=0, next=None):',
      '        self.val = val',
      '',
      'class Solution:',
      '    def solve(self, nums: List[int], target: int = 0) -> int:',
      '        pass'
    ].join('\n');

    expect(parsePythonSignature(starter)).toEqual({
      functionName: 'solve',
      params: [{ name: 'nums', type: 'int_array' }, { name: 'target', type: 'int' }],
      outputType: 'int'
    });
  });

  it('normalizes standard linked-list and binary-tree nodes', () => {
    expect(parsePythonSignature('class Solution:\n    def depth(self, root: Optional[TreeNode]) -> int:\n        pass')).toEqual({
      functionName: 'depth', params: [{ name: 'root', type: 'tree_node' }], outputType: 'int'
    });
    expect(parsePythonSignature('class Solution:\n    def reverse(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        pass')).toEqual({
      functionName: 'reverse', params: [{ name: 'head', type: 'list_node' }], outputType: 'list_node'
    });
  });

  it('uses companion signatures to distinguish character matrices from nested strings', () => {
    const python = 'class Solution:\n    def solve(self, board: List[List[str]]) -> bool:\n        pass';
    expect(parsePythonSignature(python, { cpp: 'bool solve(vector<vector<char>>& board);' })).toEqual({
      functionName: 'solve', params: [{ name: 'board', type: 'char_array_2d' }], outputType: 'boolean'
    });
    expect(parsePythonSignature('class Solution:\n    def solve(self, words: List[str]) -> List[List[str]]:\n        pass', {
      java: 'List<List<String>> solve(List<String> words);'
    })).toEqual({
      functionName: 'solve', params: [{ name: 'words', type: 'string_array' }], outputType: 'string_list_2d'
    });
  });

  it('normalizes boolean arrays for the shared judge contract', () => {
    expect(parsePythonSignature('class Solution:\n    def flags(self, values: List[bool]) -> List[bool]:\n        pass')).toEqual({
      functionName: 'flags', params: [{ name: 'values', type: 'boolean_array' }], outputType: 'boolean_array'
    });
  });

  it('normalizes floating-point scalars and arrays', () => {
    expect(parsePythonSignature('class Solution:\n    def average(self, values: List[float], scale: float) -> float:\n        pass')).toEqual({
      functionName: 'average',
      params: [{ name: 'values', type: 'float_array' }, { name: 'scale', type: 'float' }],
      outputType: 'float'
    });
  });

  it('accepts unquoted string outputs without accepting dataset errors', () => {
    const metadata = { params: [{ name: 'value', type: 'int' }], outputType: 'string' };
    expect(extractExactCases({ input_output: [
      { input: 'value = 1', output: 'XLIV' },
      { input: 'value = 2', output: 'None' },
      { input: 'value = 3', output: 'Error: reference solution failed' }
    ] }, metadata)).toEqual([
      { input: { value: 1 }, output: 'XLIV' },
      { input: { value: 2 }, output: 'None' }
    ]);
  });

  it('keeps exact cases for deterministic scalar outputs despite order wording', () => {
    const record = { description: 'Process the values in any order.' };
    expect(canUseExactCases(record, 'int')).toBe(true);
    expect(canUseExactCases(record, 'boolean')).toBe(true);
    expect(canUseExactCases(record, 'int_array')).toBe(false);
  });

  it('generates a deterministic exact-output Marker.java', () => {
    const metadata = { functionName: 'answer', params: [{ name: 'value', type: 'int' }], outputType: 'int' };
    const marker = generateExactMarker(metadata, [{ input: { value: 2 }, output: 4 }]);
    expect(marker).toContain('public int answer(int value)');
    expect(marker).toContain('if (value == 2) return 4;');
    expect(marker).toContain('isCorrect');

    const treeMarker = generateExactMarker(
      { functionName: 'depth', params: [{ name: 'root', type: 'tree_node' }], outputType: 'int' },
      [{ input: { root: [1, null, 2] }, output: 2 }]
    );
    expect(treeMarker).toContain('tree(new Integer[] {1,null,2})');
    expect(treeMarker).toContain('sameTree(root,');

    const matrixMarker = generateExactMarker(
      { functionName: 'valid', params: [{ name: 'board', type: 'char_array_2d' }], outputType: 'boolean' },
      [{ input: { board: [['1', '.']] }, output: true }]
    );
    expect(matrixMarker).toContain("new char[] {'1','.'}");

    const booleanMarker = generateExactMarker(
      { functionName: 'flags', params: [{ name: 'values', type: 'boolean_array' }], outputType: 'boolean_array' },
      [{ input: { values: [true, false] }, output: [false, true] }]
    );
    expect(booleanMarker).toContain('List<Boolean> flags');
    expect(booleanMarker).toContain('Arrays.asList(true,false)');

    const floatMarker = generateExactMarker(
      { functionName: 'average', params: [{ name: 'scale', type: 'float' }], outputType: 'float_array' },
      [{ input: { scale: 0.5 }, output: [0.25, 1] }]
    );
    expect(floatMarker).toContain('closeList');
    expect(floatMarker).toContain('Arrays.asList(0.25,1.0)');
  });

  it('adds only the wrappers required by existing judge runners', () => {
    expect(normalizeForRunner('java', 'class Solution {}', 'twoSum')).toContain('import java.util.*;');
    expect(normalizeForRunner('csharp', 'public class Solution {}', 'twoSum')).toContain('using System.Collections.Generic;');
    expect(normalizeForRunner('go', 'func twoSum(nums []int) []int { return nums }', 'twoSum')).toContain('func TwoSum(');
    expect(normalizeForRunner('typescript', 'function twoSum(): number[] { return []; }', 'twoSum')).toContain('export function twoSum(');
    expect(normalizeForRunner('rust', 'impl Solution {}', 'twoSum')).toBe('impl Solution {}\n');
  });
});
