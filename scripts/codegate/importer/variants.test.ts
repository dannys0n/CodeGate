import { describe, expect, it } from 'vitest';
import { generateVariants } from './variants.mjs';

const metadata = {
  functionName: 'answer',
  params: [{ name: 'value', type: 'int' }],
  hints: ['Use the input value to build the result.'],
  starterCode: {
    python: 'import math\n\nclass Solution:\n    def answer(self, value: int) -> int:\n        pass\n'
  }
};

describe('offline percentage difficulty generation', () => {
  it('preserves headers and removes nested amounts of the reference implementation', () => {
    const reference = 'import math\n\nclass Solution:\n    def answer(self, value: int) -> int:\n        doubled = value * 2\n        adjusted = doubled + 1\n        value += 1\n        return adjusted\n';
    const input = { metadata, language: 'python', reference };
    const variants = generateVariants(input);
    expect(generateVariants(input)).toEqual(variants);
    expect(Object.keys(variants)).toEqual(['0', '25', '50', '75', '100']);
    expect(variants['0']).toBe(metadata.starterCode.python);
    expect(variants['100']).toBe(reference);
    for (const level of ['25', '50', '75'] as const) {
      expect(variants[level]).toContain('import math');
      expect(variants[level]).toContain('class Solution:');
      expect(variants[level]).toContain('def answer(self, value: int) -> int:');
      expect(variants[level]).toContain('value += 1');
      expect(variants[level]).toContain('Hint: Use the input value to build the result.');
    }
    const hintCount = (source: string) => source.match(/Hint:/g)?.length ?? 0;
    expect(hintCount(variants['25'])).toBeGreaterThan(hintCount(variants['50']));
    expect(hintCount(variants['50'])).toBeGreaterThan(hintCount(variants['75']));
  });
});
