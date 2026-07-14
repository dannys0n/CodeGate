import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeSource } from '../../../../src/lib/codegate/source-transform.mjs';

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function read(file) { return (await exists(file)) ? fs.readFile(file, 'utf8') : undefined; }

export async function indexDoocs(root) {
  const result = new Map();
  const buckets = await fs.readdir(path.join(root, 'solution'), { withFileTypes: true });
  for (const bucket of buckets.filter((entry) => entry.isDirectory())) {
    const bucketRoot = path.join(root, 'solution', bucket.name);
    for (const entry of await fs.readdir(bucketRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const id = entry.name.match(/^(\d+)/)?.[1]?.replace(/^0+(?=\d)/, '');
      if (id && !result.has(id)) result.set(id, path.join(bucketRoot, entry.name));
    }
  }
  return result;
}

export const normalizeForRunner = (language, source, functionName) => normalizeSource(language, source, functionName, 'solution');

function compatiblePython(source) {
  return source && !/\bxrange\b|\.iteritems\s*\(|\.itervalues\s*\(|\bsys\.maxint\b|\braw_input\s*\(/.test(source);
}

export async function selectSolutions({ frontendId, slug, functionName, doocs, kamyuRoot }) {
  const doocsRoot = doocs.get(frontendId);
  const doocsPython = doocsRoot ? await read(path.join(doocsRoot, 'Solution.py')) : undefined;
  const doocsCpp = doocsRoot ? await read(path.join(doocsRoot, 'Solution.cpp')) : undefined;
  const kamyuPython = await read(path.join(kamyuRoot, 'Python', `${slug}.py`));
  const kamyuCpp = await read(path.join(kamyuRoot, 'C++', `${slug}.cpp`));
  const files = { java: 'Solution.java', csharp: 'Solution.cs', rust: 'Solution.rs', go: 'Solution.go', typescript: 'Solution.ts' };
  const selected = {
    python: normalizeForRunner('python', doocsPython ?? (compatiblePython(kamyuPython) ? kamyuPython : undefined), functionName),
    cpp: normalizeForRunner('cpp', kamyuCpp ?? doocsCpp, functionName)
  };
  const provenance = {
      python: doocsPython ? 'doocs' : compatiblePython(kamyuPython) ? 'kamyu' : undefined,
      cpp: kamyuCpp ? 'kamyu' : doocsCpp ? 'doocs' : undefined
  };
  const paths = {
    python: doocsPython ? path.join(doocsRoot, 'Solution.py') : compatiblePython(kamyuPython) ? path.join(kamyuRoot, 'Python', `${slug}.py`) : undefined,
    cpp: kamyuCpp ? path.join(kamyuRoot, 'C++', `${slug}.cpp`) : doocsCpp ? path.join(doocsRoot, 'Solution.cpp') : undefined
  };
  for (const [language, file] of Object.entries(files)) {
    const source = doocsRoot ? await read(path.join(doocsRoot, file)) : undefined;
    selected[language] = normalizeForRunner(language, source, functionName);
    provenance[language] = source ? 'doocs' : undefined;
    paths[language] = source ? path.join(doocsRoot, file) : undefined;
  }
  return { ...selected, provenance, paths };
}
