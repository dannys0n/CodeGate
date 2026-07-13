import fs from 'node:fs/promises';
import path from 'node:path';
import { difficultyLevels, generateVariants } from './importer/variants.mjs';

const root = process.cwd();
const problemsRoot = path.join(root, 'problems');
const extensions = { python: 'py', cpp: 'cpp' };
const entries = await fs.readdir(problemsRoot, { withFileTypes: true });
let problemCount = 0;
let variantCount = 0;

for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
  const problemRoot = path.join(problemsRoot, entry.name);
  const configPath = path.join(problemRoot, 'codegate.json');
  let config;
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch {
    continue;
  }
  const metadata = JSON.parse(await fs.readFile(path.join(problemRoot, 'metadata.json'), 'utf8'));
  for (const [language, extension] of Object.entries(extensions)) {
    const languageConfig = config.languages?.[language];
    if (!languageConfig) continue;
    const reference = await fs.readFile(path.join(problemRoot, languageConfig.reference), 'utf8');
    const variants = generateVariants({ metadata, language, reference });
    const paths = {};
    for (const difficulty of difficultyLevels) {
      const relative = `variants/${language}/${difficulty}.${extension}`;
      await fs.writeFile(path.join(problemRoot, relative), variants[difficulty]);
      paths[difficulty] = relative;
      variantCount++;
    }
    languageConfig.variants = paths;
  }
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  problemCount++;
}

console.log(JSON.stringify({ problems: problemCount, variants: variantCount }, null, 2));
