import fs from 'node:fs/promises';
import path from 'node:path';
import { loadNeenza, parsePythonSignature } from './neenza.mjs';
import { loadNewfacade } from './newfacade.mjs';
import { indexDoocs, selectSolutions } from './solutions.mjs';
import { parseKeywordArguments, parsePythonLiteral } from './python-literal.mjs';
import { generateExactMarker } from './exact-marker.mjs';

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
async function sourceRoot(source, key, context) {
  const configured = source.paths?.[key];
  if (typeof configured !== 'string' || path.isAbsolute(configured)) throw new Error(`${key} path must be repository-relative`);
  const resolved = await fs.realpath(path.resolve(context.repositoryRoot, configured));
  if (!inside(context.repositoryRoot, resolved)) throw new Error(`${key} path escapes the repository`);
  return resolved;
}
function storedInput(value, type) {
  return ['int_array', 'int_array_2d', 'string_array'].includes(type) ? JSON.stringify(value) : value;
}
function matchesType(value, type) {
  if (type === 'int') return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string' && !/[\x00-\x1f\x7f]/.test(value);
  if (type === 'int_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'int'));
  if (type === 'string_array') return Array.isArray(value) && value.every((item) => matchesType(item, 'string'));
  if (type === 'int_array_2d') return Array.isArray(value) && value.every((row) => matchesType(row, 'int_array'));
  return false;
}
function ambiguousStatement(record) {
  return /\b(any order|any valid|multiple answers|arbitrary order|return the answer in any|order does not matter|regardless of order|any permutation|any arrangement|any topological)\b/i.test(`${record.description ?? ''}`);
}
function incorrectPython(signature) {
  const args = signature.params.map((param) => param.name).join(', ');
  const value = ({ int: '0', boolean: 'False', string: "''", int_array: '[]', int_array_2d: '[]', string_array: '[]' })[signature.outputType];
  return `class Solution:\n    def ${signature.functionName}(self, ${args}):\n        return ${value}\n`;
}
function incorrectCpp(signature) {
  const types = { int: 'int', boolean: 'bool', string: 'string', int_array: 'vector<int>&', int_array_2d: 'vector<vector<int>>&', string_array: 'vector<string>&' };
  const output = { int: 'int', boolean: 'bool', string: 'string', int_array: 'vector<int>', int_array_2d: 'vector<vector<int>>', string_array: 'vector<string>' }[signature.outputType];
  const params = signature.params.map((param) => `${types[param.type]} ${param.name}`).join(', ');
  return `#include <bits/stdc++.h>\nusing namespace std;\nclass Solution { public: ${output} ${signature.functionName}(${params}) { return {}; } };\n`;
}
function markdown(record) {
  const constraints = (record.constraints ?? []).map((value) => `- ${value}`).join('\n');
  const followups = (record.follow_ups ?? []).map((value) => `- ${value}`).join('\n');
  return `# ${record.frontend_id}. ${record.title}\n\n${record.description ?? ''}\n\n${constraints ? `## Constraints\n\n${constraints}\n\n` : ''}${followups ? `## Follow-ups\n\n${followups}\n` : ''}`;
}

export async function loadLeetcodeBundle(source, context) {
  const [neenzaRoot, kamyuRoot, doocsRoot, newfacadeRoot] = await Promise.all(['neenza', 'kamyu', 'doocs', 'newfacade'].map((key) => sourceRoot(source, key, context)));
  const [problems, newfacade, doocs] = await Promise.all([loadNeenza(neenzaRoot), loadNewfacade(newfacadeRoot), indexDoocs(doocsRoot)]);
  const requested = new Set((source.frontendIds ?? []).map(String));
  const records = [];
  const ordered = problems.sort((left, right) => Number(left.frontendId) - Number(right.frontendId));
  for (const problem of ordered) {
    if (requested.size && !requested.has(problem.frontendId)) continue;
    if (source.limit && records.length >= source.limit) break;
    try {
      const dataset = newfacade.get(problem.frontendId);
      let signature;
      try {
        signature = parsePythonSignature(problem.starters.python);
      } catch (primaryError) {
        if (!dataset?.starter_code) throw primaryError;
        signature = parsePythonSignature(dataset.starter_code);
      }
      const exactCases = [];
      if (dataset && !ambiguousStatement(problem)) {
        for (const vector of dataset.input_output) {
          try {
            const input = parseKeywordArguments(vector.input);
            if (!signature.params.every((param) => Object.hasOwn(input, param.name) && matchesType(input[param.name], param.type))) continue;
            const output = parsePythonLiteral(vector.output);
            if (!matchesType(output, signature.outputType)) continue;
            exactCases.push({ input, output });
          } catch {
            // A few generated dataset rows contain malformed calls or error text.
            // Individual bad vectors are discarded; the record still needs the
            // configured minimum number of well-typed vectors to create a pack.
          }
        }
      }
      const solutions = await selectSolutions({ frontendId: problem.frontendId, slug: problem.slug, doocs, kamyuRoot });
      const languages = {};
      for (const language of ['python', 'cpp']) {
        const referenceCode = solutions[language];
        const starterCode = problem.starters[language];
        if (!referenceCode || !starterCode || !referenceCode.includes('class Solution') || !referenceCode.includes(signature.functionName)) continue;
        languages[language] = {
          referenceCode,
          starterCode,
          incorrectCode: language === 'python' ? incorrectPython(signature) : incorrectCpp(signature),
          provenance: solutions.provenance[language]
        };
      }
      if (!Object.keys(languages).length) continue;
      const tests = exactCases.map(({ input }) => Object.fromEntries(signature.params.map((param) => [param.name, storedInput(input[param.name], param.type)])));
      const metadata = {
        id: problem.slug,
        frontendId: problem.frontendId,
        title: `${problem.frontendId}. ${problem.title}`,
        difficulty: problem.difficulty,
        link: `https://leetcode.com/problems/${problem.slug}/`,
        category: problem.topics?.[0]?.toLowerCase().replaceAll(' ', '-') ?? 'algorithm',
        examples: exactCases.slice(0, 3).map(({ input, output }) => ({
          input: signature.params.map((param) => `${param.name} = ${JSON.stringify(input[param.name])}`).join(', '),
          output: JSON.stringify(output)
        })),
        starterCode: { python: problem.starters.python, cpp: problem.starters.cpp },
        testCases: tests.slice(0, 3),
        ...signature,
        hints: problem.hints ?? []
      };
      records.push({
        frontendId: problem.frontendId,
        slug: problem.slug,
        shape: 'function',
        endpointOnly: true,
        languages,
        pack: exactCases.length >= (source.minimumTests ?? 3) ? {
          statement: markdown(problem), metadata, tests,
          marker: generateExactMarker(metadata, exactCases)
        } : undefined,
        source: { name: source.name, revision: source.revision },
        sourceDirectory: context.repositoryRoot,
        sourceRecord: `sources/leetcode-problems/problems/${String(problem.frontendId).padStart(4, '0')}-${problem.slug}.json`,
        testSource: exactCases.length ? 'newfacade' : 'existing-cojudge'
      });
    } catch (error) {
      records.push({ frontendId: problem.frontendId, slug: problem.slug, adapterError: error instanceof Error ? error.message : String(error) });
    }
  }
  return records;
}
