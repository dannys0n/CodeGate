import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLeetcodeBundle } from './adapters/leetcode-bundle.mjs';

const args = process.argv.slice(2);
const configIndex = args.indexOf('--config');
const configured = configIndex >= 0 ? args[configIndex + 1] : 'codegate/import-leetcode.json';
if (!args.includes('--offline')) throw new Error('Source audit is offline-only; pass --offline');
const configPath = path.resolve(configured);
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const source = config.sources?.find((candidate) => candidate.adapter === 'leetcode-bundle');
if (!source) throw new Error('config has no leetcode-bundle source');
const records = await loadLeetcodeBundle(source, { repositoryRoot: process.cwd(), configDirectory: path.dirname(configPath) });
const failures = new Map();
for (const record of records.filter((candidate) => candidate.adapterError)) {
  failures.set(record.adapterError, (failures.get(record.adapterError) ?? 0) + 1);
}
const summary = {
  schemaVersion: 1,
  revision: source.revision,
  records: records.length,
  adapterErrors: records.filter((record) => record.adapterError).length,
  newPackReady: records.filter((record) => record.pack).length,
  existingPackOnly: records.filter((record) => !record.pack && !record.adapterError).length,
  languageCandidates: {
    python: records.filter((record) => record.languages?.python).length,
    cpp: records.filter((record) => record.languages?.cpp).length,
    both: records.filter((record) => record.languages?.python && record.languages?.cpp).length
  },
  topAdapterErrors: [...failures.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([reason, count]) => ({ reason, count }))
};
console.log(JSON.stringify(summary, null, 2));
