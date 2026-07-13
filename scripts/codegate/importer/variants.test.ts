import { describe, expect, it } from 'vitest';
import { generateVariants } from './variants.mjs';

const metadata = {
  functionName: 'answer',
  params: [{ name: 'value', type: 'int' }],
  hints: ['Use the input.'],
  starterCode: {
    python: 'class Solution:\n    def answer(self, value: int) -> int:\n        pass\n'
  }
};

describe('offline scaffold generation', () => {
  it('is deterministic and emits ordinary incomplete source at every level', () => {
    const input = { metadata, language: 'python', reference: 'class Solution:\n    def answer(self, value: int) -> int:\n        return value\n' };
    const first = generateVariants(input);
    expect(generateVariants(input)).toEqual(first);
    expect(Object.keys(first)).toEqual(['very-easy', 'easy', 'medium', 'hard', 'original']);
    for (const source of Object.values(first)) {
      expect(source).toContain('class Solution');
      expect(source).toContain('def answer');
      expect(source).not.toBe(input.reference);
    }
    expect(first['very-easy']).toContain('TODO: restore');
  });
});
