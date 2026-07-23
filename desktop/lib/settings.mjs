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
  problemNumberMin: null,
  problemNumberMax: null,
  extraProblemFeaturesEnabled: true,
  intellisenseEnabled: false,
  aiEnabled: false,
  aiDockerEnabled: true,
  aiEndpoint: '',
  syntaxDrillLearning: {},
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

function optionalProblemNumber(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeSyntaxDrillLearning(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const language of gateLanguages) {
    const rawLanguage = value[language];
    if (!rawLanguage || typeof rawLanguage !== 'object' || Array.isArray(rawLanguage)) continue;
    const concepts = {};
    if (rawLanguage.concepts && typeof rawLanguage.concepts === 'object' && !Array.isArray(rawLanguage.concepts)) {
      for (const [id, rawProgress] of Object.entries(rawLanguage.concepts).slice(0, 256)) {
        if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id) || !rawProgress || typeof rawProgress !== 'object' || Array.isArray(rawProgress)) continue;
        const seen = Number.isSafeInteger(rawProgress.seen) ? Math.min(999, Math.max(0, rawProgress.seen)) : 0;
        const passed = Number.isSafeInteger(rawProgress.passed) ? Math.min(seen, Math.max(0, rawProgress.passed)) : 0;
        concepts[id] = { seen, passed };
      }
    }
    const recent = Array.isArray(rawLanguage.recent)
      ? rawLanguage.recent.filter((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(id)).slice(-12)
      : [];
    normalized[language] = { concepts, recent };
  }
  return normalized;
}

export function normalizeDesktopSettings(input = {}) {
  const selectedLeetcodeDifficulties = Array.isArray(input.leetcodeDifficulties)
    ? leetcodeDifficulties.filter((value) => input.leetcodeDifficulties.includes(value))
    : [];
  let problemNumberMin = optionalProblemNumber(input.problemNumberMin);
  let problemNumberMax = optionalProblemNumber(input.problemNumberMax);
  if (problemNumberMin !== null && problemNumberMax !== null && problemNumberMin > problemNumberMax) {
    [problemNumberMin, problemNumberMax] = [problemNumberMax, problemNumberMin];
  }

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
    problemNumberMin,
    problemNumberMax,
    extraProblemFeaturesEnabled: typeof input.extraProblemFeaturesEnabled === 'boolean'
      ? input.extraProblemFeaturesEnabled
      : defaultDesktopSettings.extraProblemFeaturesEnabled,
    intellisenseEnabled: typeof input.intellisenseEnabled === 'boolean'
      ? input.intellisenseEnabled
      : defaultDesktopSettings.intellisenseEnabled,
    aiEnabled: typeof input.aiEnabled === 'boolean' ? input.aiEnabled : defaultDesktopSettings.aiEnabled,
    aiDockerEnabled: typeof input.aiDockerEnabled === 'boolean' ? input.aiDockerEnabled : defaultDesktopSettings.aiDockerEnabled,
    aiEndpoint: typeof input.aiEndpoint === 'string' ? input.aiEndpoint.trim().slice(0, 2048) : defaultDesktopSettings.aiEndpoint,
    syntaxDrillLearning: normalizeSyntaxDrillLearning(input.syntaxDrillLearning),
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
