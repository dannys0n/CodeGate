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

function replacement(line, language, suppliedPercent) {
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const guidance = `TODO: restore implementation; ${suppliedPercent}% solution supplied.`;
  if (language === 'python') return `${indent}pass  # ${guidance}`;
  if (/^\s*return\b/.test(line)) return `${indent}return {}; // ${guidance}`;
  return `${indent}// ${guidance}`;
}

function reduceReference(reference, language, suppliedPercent) {
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
  for (const candidate of removalOrder.slice(0, removalCount)) {
    lines[candidate.index] = replacement(candidate.line, language, suppliedPercent);
  }
  return `${lines.join('\n')}\n`;
}

export function generateVariants({ metadata, language, reference }) {
  const starter = metadata.starterCode?.[language];
  if (typeof starter !== 'string' || !starter.trim()) throw new Error(`missing ${language} starter code`);
  return {
    '0': `${starter.trimEnd()}\n`,
    '25': reduceReference(reference, language, 25),
    '50': reduceReference(reference, language, 50),
    '75': reduceReference(reference, language, 75),
    '100': `${reference.trimEnd()}\n`
  };
}

export { levels as difficultyLevels };
