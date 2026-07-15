import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDesktopSettings, normalizeDesktopSettings, saveDesktopSettings } from './settings.mjs';

describe('desktop settings', () => {
  it('normalizes invalid values without persisting a problem identifier', () => {
    const settings = normalizeDesktopSettings({
      codegateLanguage: 'python',
      solutionDifficulty: '100',
      leetcodeDifficulties: ['Hard', 'invalid'],
      editorFontSize: 99,
      problemId: 'must-not-persist'
    });

    expect(settings.codegateLanguage).toBe('python');
    expect(settings.solutionDifficulty).toBe('100');
    expect(settings.leetcodeDifficulties).toEqual(['Hard']);
    expect(settings.editorFontSize).toBe(24);
    expect(settings).not.toHaveProperty('problemId');
  });

  it('round trips the allow-listed settings file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'codegate-settings-'));
    const file = path.join(root, 'settings.json');
    await saveDesktopSettings(file, { theme: 'light', leftPaneWidth: 37, codegateLanguage: 'cpp' });

    await expect(loadDesktopSettings(file)).resolves.toMatchObject({
      theme: 'light',
      leftPaneWidth: 37,
      codegateLanguage: 'cpp'
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).not.toHaveProperty('problemId');
  });
});
