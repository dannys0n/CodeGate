import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const gateLanguages = ['java', 'python', 'cpp', 'csharp', 'rust', 'go', 'typescript'];
const programmingLanguages = [...gateLanguages, 'plaintext', 'markdown'];
const solutionDifficulties = ['0', '25', '50', '75', '99', '100'];
const leetcodeDifficulties = ['Easy', 'Medium', 'Hard'];

export const defaultDesktopSettings = Object.freeze({
  preferredLanguage: 'java',
  playgroundPreferredLanguage: 'java',
  editorFontSize: 14,
  theme: 'dark',
  vimMode: 'off',
  isSidebarOpen: true,
  activePanel: 'explorer',
  codegateLanguage: 'python',
  solutionDifficulty: '99',
  leetcodeDifficulties: [...leetcodeDifficulties],
  leftPaneWidth: 50,
  execPaneHeight: 50
});

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function boundedNumber(value, minimum, maximum, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function normalizeDesktopSettings(input = {}) {
  const selectedLeetcodeDifficulties = Array.isArray(input.leetcodeDifficulties)
    ? leetcodeDifficulties.filter((value) => input.leetcodeDifficulties.includes(value))
    : [];

  return {
    preferredLanguage: oneOf(input.preferredLanguage, programmingLanguages, defaultDesktopSettings.preferredLanguage),
    playgroundPreferredLanguage: oneOf(input.playgroundPreferredLanguage, programmingLanguages, defaultDesktopSettings.playgroundPreferredLanguage),
    editorFontSize: boundedNumber(input.editorFontSize, 12, 24, defaultDesktopSettings.editorFontSize),
    theme: oneOf(input.theme, ['dark', 'light'], defaultDesktopSettings.theme),
    vimMode: oneOf(input.vimMode, ['off', 'on'], defaultDesktopSettings.vimMode),
    isSidebarOpen: typeof input.isSidebarOpen === 'boolean' ? input.isSidebarOpen : defaultDesktopSettings.isSidebarOpen,
    activePanel: oneOf(input.activePanel, ['explorer', 'search', null], defaultDesktopSettings.activePanel),
    codegateLanguage: oneOf(input.codegateLanguage, gateLanguages, defaultDesktopSettings.codegateLanguage),
    solutionDifficulty: oneOf(input.solutionDifficulty, solutionDifficulties, defaultDesktopSettings.solutionDifficulty),
    leetcodeDifficulties: selectedLeetcodeDifficulties.length
      ? selectedLeetcodeDifficulties
      : [...defaultDesktopSettings.leetcodeDifficulties],
    leftPaneWidth: boundedNumber(input.leftPaneWidth, 0, 90, defaultDesktopSettings.leftPaneWidth),
    execPaneHeight: boundedNumber(input.execPaneHeight, 0, 100, defaultDesktopSettings.execPaneHeight)
  };
}

export async function loadDesktopSettings(file) {
  try {
    return normalizeDesktopSettings(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    return normalizeDesktopSettings();
  }
}

export async function saveDesktopSettings(file, settings) {
  const normalized = normalizeDesktopSettings(settings);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
  return normalized;
}
