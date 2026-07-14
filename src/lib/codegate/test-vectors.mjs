// @ts-nocheck
import { parseKeywordArguments, parsePythonLiteral } from './python-literal.mjs';

function matchesType(value, type) {
  if (type === 'int') return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string' && !/[\x00-\x1f\x7f]/.test(value);
  if (type === 'int_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'int'));
  if (type === 'string_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'string'));
  if (type === 'int_array_2d') return Array.isArray(value) && value.every((row) => matchesType(row, 'int_array'));
  return false;
}
function storedInput(value, type) { return ['int_array', 'int_array_2d', 'string_array'].includes(type) ? JSON.stringify(value) : value; }

export function extractExactCases(dataset, metadata) {
  const cases = [];
  for (const vector of dataset?.input_output ?? []) {
    try {
      const input = parseKeywordArguments(vector.input);
      if (!metadata.params.every((param) => Object.hasOwn(input, param.name) && matchesType(input[param.name], param.type))) continue;
      const output = parsePythonLiteral(vector.output);
      if (!matchesType(output, metadata.outputType)) continue;
      cases.push({ input, output });
    } catch { /* malformed generated vector */ }
  }
  return cases;
}
export function officialTests(cases, metadata) {
  return cases.map(({ input }) => Object.fromEntries(metadata.params.map((param) => [param.name, storedInput(input[param.name], param.type)])));
}
