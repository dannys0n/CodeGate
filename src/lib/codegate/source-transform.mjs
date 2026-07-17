// @ts-nocheck
export const sourceTransformVersion = 2;

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

const goStandardImports = Object.freeze([
  ['heap', 'container/heap'],
  ['math', 'math'],
  ['slices', 'slices'],
  ['sort', 'sort'],
  ['strconv', 'strconv'],
  ['strings', 'strings']
]);

function inferredGoImports(source) {
  return goStandardImports
    .filter(([identifier, module]) => new RegExp(`\\b${identifier}\\s*\\.`).test(source) && !source.includes(`"${module}"`))
    .map(([, module]) => `import "${module}"`)
    .join('\n');
}

const typescriptPriorityQueue = `class PriorityQueue<T> {
  private heap: T[] = [];
  private compare: (left: T, right: T) => number;
  constructor(options?: ((left: T, right: T) => number) | { compare: (left: T, right: T) => number }) {
    this.compare = typeof options === 'function' ? options : options?.compare ?? ((left: any, right: any) => left - right);
  }
  size(): number { return this.heap.length; }
  isEmpty(): boolean { return this.heap.length === 0; }
  front(): T { return this.heap[0]; }
  back(): T { return this.heap.reduce((worst, value) => this.compare(worst, value) < 0 ? value : worst); }
  enqueue(value: T): this {
    this.heap.push(value);
    for (let child = this.heap.length - 1; child > 0;) {
      const parent = (child - 1) >> 1;
      if (this.compare(this.heap[parent], this.heap[child]) <= 0) break;
      [this.heap[parent], this.heap[child]] = [this.heap[child], this.heap[parent]];
      child = parent;
    }
    return this;
  }
  dequeue(): T {
    if (this.heap.length === 0) throw new Error('PriorityQueue is empty');
    const first = this.heap[0], last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      for (let parent = 0;;) {
        let child = parent * 2 + 1;
        if (child >= this.heap.length) break;
        if (child + 1 < this.heap.length && this.compare(this.heap[child + 1], this.heap[child]) < 0) child++;
        if (this.compare(this.heap[parent], this.heap[child]) <= 0) break;
        [this.heap[parent], this.heap[child]] = [this.heap[child], this.heap[parent]];
        parent = child;
      }
    }
    return first;
  }
  toArray(): T[] { return [...this.heap].sort(this.compare); }
}
class MinPriorityQueue<T> extends PriorityQueue<T> {
  constructor() { super((left: any, right: any) => left - right); }
}
class MaxPriorityQueue<T> extends PriorityQueue<T> {
  constructor() { super((left: any, right: any) => right - left); }
}`;

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
  if (language === 'csharp') return `using System;\nusing System.Collections.Generic;\nusing System.Linq;\nusing System.Text;\n\n${source}\n`;
  if (language === 'rust') return `${source}\n`;
  if (language === 'go') {
    const expected = functionNameFor(language, functionName);
    const renamed = source.replace(new RegExp(`\\bfunc\\s+${functionName}\\s*\\(`), `func ${expected}(`);
    const withoutPackage = renamed.replace(/^\s*package\s+main\s*/m, '');
    const imports = inferredGoImports(withoutPackage);
    return `package main\n${imports ? `\n${imports}\n` : ''}\n${withoutPackage.trim()}\n`;
  }
  if (language === 'typescript') {
    const exported = source.replace(new RegExp(`(^|\\n)function\\s+${functionName}\\s*\\(`), `$1export function ${functionName}(`);
    const queueCompatibility = /\b(?:MinPriorityQueue|MaxPriorityQueue|PriorityQueue)\s*(?:<|\()/.test(exported)
      ? `${typescriptPriorityQueue}\n\n`
      : '';
    return `${queueCompatibility}${exported}\n`;
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
  const keep = percent === 99
    ? Math.max(0, removable.length - 1)
    : Math.floor(removable.length * Math.max(0, percent) / 100);
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
