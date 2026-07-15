import fs from 'node:fs/promises';
import path from 'node:path';
import { loadNeenza, parsePythonSignature } from './neenza.mjs';
import { loadNewfacade } from './newfacade.mjs';
import { indexDoocs, normalizeForRunner, selectSolutions } from './solutions.mjs';
import { generateExactMarker } from '../../../../src/lib/codegate/exact-marker.mjs';
import { starterField } from '../../../../src/lib/codegate/source-transform.mjs';
import { extractExactCases, officialTests } from '../../../../src/lib/codegate/test-vectors.mjs';

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
      const exactCases = dataset && !ambiguousStatement(problem) ? extractExactCases(dataset, signature) : [];
      const solutions = await selectSolutions({ frontendId: problem.frontendId, slug: problem.slug, functionName: signature.functionName, doocs, kamyuRoot });
      const languages = {};
      const normalizedStarters = {};
      for (const language of ['python', 'cpp', 'java', 'csharp', 'rust', 'go', 'typescript']) {
        const referenceCode = solutions[language];
        const starterCode = ['python', 'cpp'].includes(language)
          ? problem.starters[language]
          : normalizeForRunner(language, problem.starters[language], signature.functionName);
        if (!referenceCode || !starterCode) continue;
        normalizedStarters[language] = starterCode;
        languages[language] = {
          referenceCode,
          starterCode,
          incorrectCode: language === 'python' ? incorrectPython(signature) : language === 'cpp' ? incorrectCpp(signature) : starterCode,
          provenance: solutions.provenance[language],
          starterSource: {
            path: `sources/leetcode-problems/problems/${String(problem.frontendId).padStart(4, '0')}-${problem.slug}.json`,
            field: `code_snippets.${starterField(language)}`
          },
          solutionSource: {
            path: path.relative(context.repositoryRoot, solutions.paths[language]).replaceAll(path.sep, '/')
          }
        };
      }
      if (!Object.keys(languages).length) continue;
      const tests = officialTests(exactCases, signature);
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
        starterCode: normalizedStarters,
        testCases: tests.slice(0, 3),
        ...signature,
        hints: problem.hints ?? []
      };
      records.push({
        frontendId: problem.frontendId,
        slug: problem.slug,
        difficulty: problem.difficulty,
        shape: 'function',
        endpointOnly: true,
        slimSources: true,
        languages,
        pack: exactCases.length >= (source.minimumTests ?? 3) ? {
          statement: markdown(problem), metadata, tests,
          marker: generateExactMarker(metadata, exactCases),
          outputs: exactCases.map(({ output }) => output)
        } : undefined,
        source: { name: source.name, revision: source.revision },
        sourceDirectory: context.repositoryRoot,
        sourceRecord: `sources/leetcode-problems/problems/${String(problem.frontendId).padStart(4, '0')}-${problem.slug}.json`,
        testSource: exactCases.length ? 'newfacade' : 'existing-cojudge',
        testLocator: exactCases.length >= (source.minimumTests ?? 3) ? dataset._locator : undefined
      });
    } catch (error) {
      records.push({ frontendId: problem.frontendId, slug: problem.slug, adapterError: error instanceof Error ? error.message : String(error) });
    }
  }
  return records;
}
