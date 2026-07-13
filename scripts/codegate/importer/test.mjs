import { spawnSync } from 'node:child_process';
import path from 'node:path';

if (!process.argv.slice(2).includes('--offline')) throw new Error('Importer tests require --offline');
const vitest = path.join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', 'scripts/codegate/importer'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, CODEGATE_OFFLINE: '1' }
});
process.exit(result.status ?? 1);
