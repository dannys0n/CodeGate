import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const cli = path.join(root, 'bin', 'cojudge');
const cases = [
  ['wrong-answer', 'two-sum.incorrect.py', /FAILED/],
  ['compile-error', 'two-sum.compile-error.py', /SyntaxError/],
  ['runtime-error', 'two-sum.runtime-error.py', /RuntimeError/],
  ['timeout', 'two-sum.timeout.py', /timed out/i]
];

for (const [name, fixture, expected] of cases) {
  const result = spawnSync(process.execPath, [cli, 'submit', 'two-sum', path.join(root, 'tests', 'fixtures', 'submissions', fixture)], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: '1' }
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '');
  if (result.status === 0 || !expected.test(output)) {
    throw new Error(`${name} did not produce its expected rejected outcome:\n${output}`);
  }
  process.stdout.write(`${name}: rejected as expected\n`);
}
