import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendSessionHistory } from './history.mjs';

let tempPath: string | undefined;
afterEach(async () => { if (tempPath) await fs.rm(tempPath, { recursive: true, force: true }); });

describe('desktop session history', () => {
  it('appends outcomes and keeps valid JSON', async () => {
    tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codegate-history-'));
    await appendSessionHistory(tempPath, { outcome: 'accepted' });
    await appendSessionHistory(tempPath, { outcome: 'given-up' });
    const value = JSON.parse(await fs.readFile(path.join(tempPath, 'session-history.json'), 'utf8'));
    expect(value.map((entry: any) => entry.outcome)).toEqual(['accepted', 'given-up']);
  });
});
