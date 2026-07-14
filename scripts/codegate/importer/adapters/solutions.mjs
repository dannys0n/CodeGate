import fs from 'node:fs/promises';
import path from 'node:path';

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function read(file) { return (await exists(file)) ? fs.readFile(file, 'utf8') : undefined; }
function clean(source) { return source?.replace(/[ \t]+$/gm, '').trim(); }

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

function pythonPreamble(source) {
  if (!source) return source;
  return `from typing import *\nfrom collections import *\nfrom functools import *\nfrom itertools import *\nfrom math import *\nfrom bisect import *\nfrom heapq import *\nimport bisect, heapq, math\n\n${clean(source)}\n`;
}

function cppPreamble(source) {
  if (!source) return source;
  return `#include <bits/stdc++.h>\nusing namespace std;\n\n${clean(source)}\n`;
}

function compatiblePython(source) {
  return source && !/\bxrange\b|\.iteritems\s*\(|\.itervalues\s*\(|\bsys\.maxint\b|\braw_input\s*\(/.test(source);
}

export async function selectSolutions({ frontendId, slug, doocs, kamyuRoot }) {
  const doocsRoot = doocs.get(frontendId);
  const doocsPython = doocsRoot ? await read(path.join(doocsRoot, 'Solution.py')) : undefined;
  const doocsCpp = doocsRoot ? await read(path.join(doocsRoot, 'Solution.cpp')) : undefined;
  const kamyuPython = await read(path.join(kamyuRoot, 'Python', `${slug}.py`));
  const kamyuCpp = await read(path.join(kamyuRoot, 'C++', `${slug}.cpp`));
  return {
    python: pythonPreamble(doocsPython ?? (compatiblePython(kamyuPython) ? kamyuPython : undefined)),
    cpp: cppPreamble(kamyuCpp ?? doocsCpp),
    provenance: {
      python: doocsPython ? 'doocs' : compatiblePython(kamyuPython) ? 'kamyu' : undefined,
      cpp: kamyuCpp ? 'kamyu' : doocsCpp ? 'doocs' : undefined
    }
  };
}
