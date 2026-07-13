import fs from 'node:fs/promises';
import path from 'node:path';

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function loadLocalJsonSource(source, context) {
  if (typeof source.path !== 'string' || !source.path || path.isAbsolute(source.path)) {
    throw new Error('local-json source path must be a non-empty relative path');
  }
  const sourcePath = path.resolve(context.configDirectory, source.path);
  if (!inside(context.repositoryRoot, sourcePath)) throw new Error('local-json source path escapes the repository');
  const realSourcePath = await fs.realpath(sourcePath);
  if (!inside(context.repositoryRoot, realSourcePath)) throw new Error('local-json source resolves outside the repository');
  const records = JSON.parse(await fs.readFile(realSourcePath, 'utf8'));
  if (!Array.isArray(records)) throw new Error('local-json source must contain an array');
  return records.map((record, index) => ({
    ...record,
    source: { name: source.name, revision: source.revision },
    sourceDirectory: path.dirname(realSourcePath),
    sourceRecord: `${path.relative(context.repositoryRoot, realSourcePath).replaceAll(path.sep, '/') }#${index}`
  }));
}
