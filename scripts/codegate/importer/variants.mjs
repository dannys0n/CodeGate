const levels = ['very-easy', 'easy', 'medium', 'hard', 'original'];

function comment(language, lines) {
  const prefix = language === 'python' ? '# ' : '// ';
  return lines.filter(Boolean).map((line) => `${prefix}${line}`).join('\n');
}

function prependGuidance(source, language, lines) {
  return `${comment(language, ['CodeGate scaffold guidance:', ...lines])}\n${source.trimEnd()}\n`;
}

function nearComplete(reference, language) {
  const lines = reference.trimEnd().split(/\r?\n/);
  const expression = language === 'python'
    ? /^(\s*)return\s+.+$/
    : /^(\s*)return\s+.+;\s*$/;
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = lines[index].match(expression);
    if (!match) continue;
    lines.splice(index, 1,
      `${match[1]}${language === 'python' ? '# ' : '// '}TODO: restore the result for this final step.`,
      language === 'python' ? `${match[1]}pass` : `${match[1]}return {};`);
    return `${lines.join('\n')}\n`;
  }
  return prependGuidance(reference, language, ['TODO: remove one remaining defect and return the correct result.']);
}

export function generateVariants({ metadata, language, reference, hints = [] }) {
  const starter = metadata.starterCode?.[language];
  if (typeof starter !== 'string' || !starter.trim()) throw new Error(`missing ${language} starter code`);
  const signature = `${metadata.functionName}(${metadata.params.map((param) => param.name).join(', ')})`;
  const availableHints = [...hints, ...(metadata.hints ?? [])].filter((item) => typeof item === 'string' && item.trim());
  const general = availableHints[0] ?? `Implement ${signature} using the stated constraints.`;
  const detailed = availableHints.slice(0, 3);
  return {
    'very-easy': nearComplete(reference, language),
    easy: prependGuidance(starter, language, [general, ...detailed, 'Complete the existing method body; keep the signature unchanged.']),
    medium: prependGuidance(starter, language, [general, 'Identify the key data structure and edge cases before coding.']),
    hard: prependGuidance(starter, language, [`Implement ${signature}; preserve the provided interface.`]),
    original: `${starter.trimEnd()}\n`
  };
}

export { levels as scaffoldLevels };
