import { describe, expect, it } from 'vitest';
import { tsHelperMethods } from './tsUtil';

describe('TypeScript marker output', () => {
  it('JSON-encodes strings so whitespace and escapes survive judging', () => {
    expect(tsHelperMethods).toContain("if (typeof x === 'string') return JSON.stringify(x)");
    expect(tsHelperMethods).toContain('JSON.stringify(s)');
  });
});
