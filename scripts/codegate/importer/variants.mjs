const levels = ['0', '25', '50', '75', '100'];

function isProtectedLine(line, language) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(language === 'python' ? '#' : '//')) return true;
  if (language === 'python') {
    return /^(from\s+\S+\s+import\s+|import\s+|@|class\s+|def\s+|async\s+def\s+)/.test(trimmed)
      || trimmed.endsWith(':')
      || /^[A-Za-z_][\w.\[\]]*\s*[+-]=\s*1$/.test(trimmed);
  }
  return /^(#|using\s+|namespace\s+|class\s+|struct\s+|public:|private:|protected:)/.test(trimmed)
    || /^[{}]+;?$/.test(trimmed)
    || /[{}]\s*;?$/.test(trimmed)
    || /\+\+|--/.test(trimmed);
}

function replacement(line, language, hint) {
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const guidance = `Hint: ${hint}`;
  if (language === 'python') return `${indent}pass  # ${guidance}`;
  if (/^\s*return\b/.test(line)) return `${indent}return {}; // ${guidance}`;
  return `${indent}// ${guidance}`;
}

function reduceReference(reference, language, suppliedPercent, hints) {
  const lines = reference.trimEnd().split(/\r?\n/);
  const candidates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isProtectedLine(line, language));
  const removalCount = Math.max(1, Math.ceil(candidates.length * (100 - suppliedPercent) / 100));
  const removalOrder = [...candidates].sort((left, right) => {
    const leftReturn = /^\s*return\b/.test(left.line) ? 1 : 0;
    const rightReturn = /^\s*return\b/.test(right.line) ? 1 : 0;
    return rightReturn - leftReturn || right.index - left.index;
  });
  for (const [index, candidate] of removalOrder.slice(0, removalCount).entries()) {
    lines[candidate.index] = replacement(candidate.line, language, hints[index % hints.length]);
  }
  return `${lines.join('\n')}\n`;
}

export function generateVariants({ metadata, language, reference, starter: suppliedStarter, hints = [], endpointOnly = false }) {
  const starter = suppliedStarter ?? metadata.starterCode?.[language];
  if (typeof starter !== 'string' || !starter.trim()) throw new Error(`missing ${language} starter code`);
  const availableHints = [...hints, ...(metadata.hints ?? [])]
    .filter((hint) => typeof hint === 'string' && hint.trim())
    .map((hint) => hint.replaceAll('`', '').trim());
  if (availableHints.length === 0) {
    availableHints.push(`Implement ${metadata.functionName ?? 'the method'} using the problem constraints.`);
  }
  const endpoints = {
    '0': `${starter.trimEnd()}\n`,
    '100': `${reference.trimEnd()}\n`
  };
  if (endpointOnly) return endpoints;
  return {
    '0': endpoints['0'],
    '25': reduceReference(reference, language, 25, availableHints),
    '50': reduceReference(reference, language, 50, availableHints),
    '75': reduceReference(reference, language, 75, availableHints),
    '100': endpoints['100']
  };
}

export { levels as difficultyLevels };
