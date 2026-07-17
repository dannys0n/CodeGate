// @ts-nocheck
import { parseKeywordArguments, parsePythonLiteral } from './python-literal.mjs';

function matchesType(value, type) {
  if (type === 'int') return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string' && !/[\x00-\x1f\x7f]/.test(value);
  if (type === 'int_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'int'));
  if (type === 'string_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'string'));
  if (type === 'boolean_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'boolean'));
  if (type === 'int_array_2d') return Array.isArray(value) && value.every((row) => matchesType(row, 'int_array'));
  if (type === 'char_array_2d') return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((item) => matchesType(item, 'string') && [...item].length === 1));
  if (type === 'string_list_2d') return Array.isArray(value) && value.every((row) => matchesType(row, 'string_array'));
  if (type === 'list_node') return matchesType(value, 'int_array');
  if (type === 'tree_node') return Array.isArray(value) && value.every((item) => item === null || matchesType(item, 'int'));
  return false;
}
function storedInput(value, type) { return ['int_array', 'int_array_2d', 'string_array', 'boolean_array', 'char_array_2d', 'string_list_2d', 'list_node', 'tree_node'].includes(type) ? JSON.stringify(value) : value; }

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
