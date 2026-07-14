// @ts-nocheck
export const sourceTransformVersion = 1;

const starterFields = Object.freeze({
  java: 'java',
  python: 'python3',
  cpp: 'cpp',
  csharp: 'csharp',
  rust: 'rust',
  go: 'golang',
  typescript: 'typescript'
});

function clean(source) {
  return typeof source === 'string' ? source.replace(/[ \t]+$/gm, '').trim() : undefined;
}

function functionNameFor(language, functionName) {
  if (language === 'csharp' || language === 'go') return functionName.charAt(0).toUpperCase() + functionName.slice(1);
  if (language === 'rust') return functionName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return functionName;
}

export function starterField(language) {
  return starterFields[language];
}

export function normalizeSource(language, source, functionName, kind = 'solution') {
  source = clean(source);
  if (!source) return source;
  if (language === 'python') {
    if (kind === 'starter') return `${source}\n`;
    return `from typing import *\nfrom collections import *\nfrom functools import *\nfrom itertools import *\nfrom math import *\nfrom bisect import *\nfrom heapq import *\nimport bisect, heapq, math\n\n${source}\n`;
  }
  if (language === 'cpp') {
    if (kind === 'starter') return `${source}\n`;
    return `#include <bits/stdc++.h>\nusing namespace std;\n\n${source}\n`;
  }
  if (language === 'java') return `import java.util.*;\n\n${source}\n`;
  if (language === 'csharp') return `using System;\nusing System.Collections.Generic;\nusing System.Linq;\n\n${source}\n`;
  if (language === 'rust') return `${source}\n`;
  if (language === 'go') {
    const expected = functionNameFor(language, functionName);
    const renamed = source.replace(new RegExp(`\\bfunc\\s+${functionName}\\s*\\(`), `func ${expected}(`);
    return `package main\n\n${renamed}\n`;
  }
  if (language === 'typescript') {
    const exported = source.replace(new RegExp(`(^|\\n)function\\s+${functionName}\\s*\\(`), `$1export function ${functionName}(`);
    return `${exported}\n`;
  }
  return `${source}\n`;
}

function protectedLine(line, language) {
  const value = line.trim();
  if (!value || value.startsWith(language === 'python' ? '#' : '//')) return true;
  if (language === 'python') {
    return /^(from\s+\S+\s+import\s+|import\s+|@|class\s+|def\s+|async\s+def\s+)/.test(value) || value.endsWith(':');
  }
  return /^(#|package\s+|import\s+|using\s+|namespace\s+|class\s+|struct\s+|interface\s+|impl\s+|public:|private:|protected:)/.test(value)
    || /[{}]\s*;?$/.test(value);
}

function hintLine(line, language, hint) {
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const text = String(hint || 'Complete this section.').replaceAll('`', '').trim();
  return language === 'python' ? `${indent}pass  # Hint: ${text}` : `${indent}// Hint: ${text}`;
}

export function stripSolution(source, language, percent, hints = []) {
  if (percent >= 100) return source;
  const lines = source.trimEnd().split(/\r?\n/);
  const removable = lines.map((line, index) => ({ line, index })).filter(({ line }) => !protectedLine(line, language));
  const keep = Math.floor(removable.length * Math.max(0, percent) / 100);
  const removed = new Set(removable.slice(keep).map(({ index }) => index));
  const availableHints = hints.filter((hint) => typeof hint === 'string' && hint.trim());
  let region = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!removed.has(index)) continue;
    const previousRemoved = removed.has(index - 1);
    lines[index] = previousRemoved ? '' : hintLine(lines[index], language, availableHints[region++ % Math.max(1, availableHints.length)]);
  }
  return `${lines.filter((line, index) => line !== '' || !removed.has(index)).join('\n')}\n`;
}
