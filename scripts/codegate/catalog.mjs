import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scaffoldLevels = ['very-easy', 'easy', 'medium', 'hard', 'original'];
export const supportedLanguages = ['python', 'cpp'];

function assertRelativeFile(root, candidate, label) {
  if (typeof candidate !== 'string' || candidate.length === 0) throw new Error(`${label} must be a path`);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} escapes its problem directory`);
  return resolved;
}

export async function discoverCandidates(repositoryRoot = process.cwd()) {
  const problemsRoot = path.join(repositoryRoot, 'problems');
  const entries = await fs.readdir(problemsRoot, { withFileTypes: true });
  const candidates = [];
  const quarantine = [];

  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const problemRoot = path.join(problemsRoot, entry.name);
    const configPath = path.join(problemRoot, 'codegate.json');
    try {
      await fs.access(configPath);
    } catch {
      continue;
    }

    try {
      const [config, metadata] = await Promise.all([
        fs.readFile(configPath, 'utf8').then(JSON.parse),
        fs.readFile(path.join(problemRoot, 'metadata.json'), 'utf8').then(JSON.parse)
      ]);
      if (config.schemaVersion !== 1 || config.problemId !== entry.name || metadata.id !== entry.name) {
        throw new Error('problem identifiers or schema version do not agree');
      }

      for (const language of supportedLanguages) {
        const languageConfig = config.languages?.[language];
        if (!languageConfig) continue;
        const referencePath = assertRelativeFile(problemRoot, languageConfig.reference, `${language} reference`);
        const incorrectPath = path.resolve(problemRoot, languageConfig.incorrect);
        const incorrectRelative = path.relative(repositoryRoot, incorrectPath);
        if (incorrectRelative.startsWith('..') || path.isAbsolute(incorrectRelative)) {
          throw new Error(`${language} incorrect fixture escapes the repository`);
        }
        await Promise.all([fs.access(referencePath), fs.access(incorrectPath)]);

        for (const scaffold of scaffoldLevels) {
          const configuredVariant = languageConfig.variants?.[scaffold];
          if (!configuredVariant) continue;
          const variantPath = assertRelativeFile(problemRoot, configuredVariant, `${language}/${scaffold} variant`);
          await fs.access(variantPath);
          candidates.push({
            problemId: entry.name,
            title: metadata.title,
            leetcodeDifficulty: metadata.difficulty,
            language,
            scaffold,
            sourcePath: path.relative(repositoryRoot, variantPath).replaceAll(path.sep, '/'),
            referencePath,
            incorrectPath,
            sourceRevision: config.source?.revision ?? 'unknown'
          });
        }
      }
    } catch (error) {
      quarantine.push({ problemId: entry.name, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { candidates, quarantine };
}

export async function readPlayableManifest(repositoryRoot = process.cwd()) {
  const manifestPath = path.join(repositoryRoot, 'codegate', 'playable-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.variants)) throw new Error('Invalid playable manifest');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { candidates, quarantine } = await discoverCandidates();
  const manifest = await readPlayableManifest().catch(() => ({ variants: [] }));
  const playableKeys = new Set(manifest.variants.map((variant) => `${variant.problemId}:${variant.language}:${variant.scaffold}`));
  const missing = candidates.filter((candidate) => !playableKeys.has(`${candidate.problemId}:${candidate.language}:${candidate.scaffold}`));
  console.log(JSON.stringify({ candidates: candidates.length, playable: manifest.variants.length, quarantinedProblems: quarantine.length, unvalidatedCandidates: missing.length }, null, 2));
  if (quarantine.length > 0 || missing.length > 0) process.exitCode = 1;
}
