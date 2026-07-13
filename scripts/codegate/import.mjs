import path from 'node:path';
import { runImport } from './importer/core.mjs';

const args = process.argv.slice(2);
const configIndex = args.indexOf('--config');
if (configIndex < 0 || !args[configIndex + 1]) throw new Error('Usage: codegate:import --config <local-config.json> --offline');
if (!args.includes('--offline')) throw new Error('The importer is offline-only; pass --offline explicitly');
const report = await runImport(path.resolve(args[configIndex + 1]));
console.log(JSON.stringify({ accepted: report.accepted.length, skipped: report.skipped.length, failed: report.failed.length }, null, 2));
if (report.accepted.length === 0) process.exitCode = 1;
