import { describe, expect, it } from 'vitest';
import { cppHelperMethods } from './cppUtil';
import { csharpHelperMethods } from './csharpUtil';
import { generateRustRunner } from './rustUtil';

describe('imported solution compatibility', () => {
  it('declares the LeetCode Solution type for ordinary Rust functions', () => {
    const runner = generateRustRunner(
      'answer',
      [{ name: 'value', type: 'int' }],
      [{ value: 1 }],
      'impl Solution { pub fn answer(value: i32) -> i32 { value } }'
    );

    expect(runner.match(/pub struct Solution;/g)).toHaveLength(1);
  });

  it('does not duplicate a Rust Solution declaration supplied by the source', () => {
    const runner = generateRustRunner(
      'answer',
      [{ name: 'value', type: 'int' }],
      [{ value: 1 }],
      'pub struct Solution;\nimpl Solution { pub fn answer(value: i32) -> i32 { value } }'
    );

    expect(runner.match(/pub struct Solution;/g)).toHaveLength(1);
  });

  it('serializes C# booleans in the judge format', () => {
    expect(csharpHelperMethods).toContain('return val ? "true" : "false"');
  });

  it('supports common unsigned and pair-shaped C++ results', () => {
    expect(cppHelperMethods).toContain('display_output(unsigned int val)');
    expect(cppHelperMethods).toContain('display_output(const vector<pair<int, int>> &values)');
  });
});
