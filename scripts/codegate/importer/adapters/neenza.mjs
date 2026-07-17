import fs from 'node:fs/promises';
import path from 'node:path';
import { splitTopLevel } from '../../../../src/lib/codegate/python-literal.mjs';

const typeMap = new Map([
  ['int', 'int'], ['str', 'string'], ['bool', 'boolean'],
  ['List[int]', 'int_array'], ['list[int]', 'int_array'],
  ['List[str]', 'string_array'], ['list[str]', 'string_array'],
  ['List[bool]', 'boolean_array'], ['list[bool]', 'boolean_array'],
  ['List[List[int]]', 'int_array_2d'], ['list[list[int]]', 'int_array_2d'],
  ['TreeNode', 'tree_node'], ['Optional[TreeNode]', 'tree_node'], ["'TreeNode'", 'tree_node'],
  ['ListNode', 'list_node'], ['Optional[ListNode]', 'list_node'], ["'ListNode'", 'list_node']
]);

function normalizeAnnotation(value) { return String(value ?? '').replace(/\s+/g, ''); }
function cojudgeType(annotation) { return typeMap.get(normalizeAnnotation(annotation)); }
function clean(source) { return typeof source === 'string' ? source.replace(/[ \t]+$/gm, '').trimEnd() : source; }

function nestedStringType(companions, functionName, parameterName) {
  const cpp = String(companions?.cpp ?? '').replace(/\s+/g, '');
  const java = String(companions?.java ?? '').replace(/\s+/g, '');
  const suffix = parameterName ? `(?:[&*])?${parameterName}\\b` : `${functionName}\\(`;
  if (new RegExp(`vector<vector<char>>${suffix}`).test(cpp) || new RegExp(`char\\[\\]\\[\\]${suffix}`).test(java)) return 'char_array_2d';
  if (new RegExp(`vector<vector<string>>${suffix}`).test(cpp) || new RegExp(`List<List<String>>${suffix}`).test(java)) return 'string_list_2d';
  return undefined;
}

function solutionClassBody(source) {
  const lines = String(source).split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*class\s+Solution\b/.test(line));
  if (start < 0) return String(source);

  const classIndent = lines[start].match(/^\s*/)?.[0].length ?? 0;
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (line.trim() && indent <= classIndent) break;
    body.push(line);
  }
  return body.join('\n');
}

export function parsePythonSignature(source, companions) {
  const match = solutionClassBody(source).match(/def\s+([A-Za-z_]\w*)\s*\(\s*self\s*,?([\s\S]*?)\)\s*(?:->\s*([^:\n]+))?\s*:/);
  if (!match) throw new Error('Python starter signature was not recognized');
  const params = splitTopLevel(match[2]).map((part) => {
    const parameter = part.trim().match(/^([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s*=.*)?$/);
    if (!parameter) throw new Error(`untyped or unsupported parameter: ${part.trim()}`);
    const type = normalizeAnnotation(parameter[2]) === 'List[List[str]]'
      ? nestedStringType(companions, match[1], parameter[1])
      : cojudgeType(parameter[2]);
    if (!type) throw new Error(`unsupported parameter type: ${parameter[2].trim()}`);
    return { name: parameter[1], type };
  });
  const outputType = normalizeAnnotation(match[3]) === 'List[List[str]]'
    ? nestedStringType(companions, match[1])
    : cojudgeType(match[3]);
  if (!params.length || !outputType) throw new Error(`unsupported output type: ${String(match[3] ?? '').trim()}`);
  return { functionName: match[1], params, outputType };
}

export async function loadNeenza(root) {
  const document = JSON.parse(await fs.readFile(path.join(root, 'merged_problems.json'), 'utf8'));
  const records = Array.isArray(document) ? document : document.questions;
  if (!Array.isArray(records)) throw new Error('Neenza merged_problems.json must contain an array');
  return records.map((record) => ({
    ...record,
    frontendId: String(record.frontend_id),
    slug: record.problem_slug,
    starters: {
      python: clean(record.code_snippets?.python3),
      cpp: clean(record.code_snippets?.cpp),
      java: clean(record.code_snippets?.java),
      csharp: clean(record.code_snippets?.csharp),
      rust: clean(record.code_snippets?.rust),
      go: clean(record.code_snippets?.golang),
      typescript: clean(record.code_snippets?.typescript)
    }
  }));
}
