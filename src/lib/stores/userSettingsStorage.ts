import { browser } from '$app/environment';
import type { ProgrammingLanguage } from '$lib/utils/util';
import { leetcodeDifficultyLevels, type DifficultyLevel, type GateLanguage, type LeetcodeDifficulty } from '$lib/codegate/types';
import { writable } from 'svelte/store';

export type ThemeChoice = 'dark' | 'light';

export type ActivePanel = 'explorer' | 'search' | null;

export interface UserSettings {
    preferredLanguage: ProgrammingLanguage;
    playgroundPreferredLanguage: ProgrammingLanguage;
    editorFontSize: number;
    theme: ThemeChoice;
    vimMode: 'off' | 'on';
    isSidebarOpen: boolean;
    activePanel: ActivePanel;
    codegateLanguage: GateLanguage;
    solutionDifficulty: DifficultyLevel;
    leetcodeDifficulties: LeetcodeDifficulty[];
    aiEnabled: boolean;
}

const STORAGE_KEY = 'user-settings';

const defaultSettings: UserSettings = {
    preferredLanguage: 'java',
    playgroundPreferredLanguage: 'java',
    editorFontSize: 14,
    theme: 'dark',
    vimMode: 'off',
    isSidebarOpen: true,
    activePanel: 'explorer',
    codegateLanguage: 'python',
    solutionDifficulty: '99',
    leetcodeDifficulties: [...leetcodeDifficultyLevels],
    aiEnabled: false,
};

function normalizeSettings(input: any): UserSettings {
    const preferredLanguage = (input?.preferredLanguage ?? defaultSettings.preferredLanguage) as ProgrammingLanguage;
    const playgroundPreferredLanguage = (input?.playgroundPreferredLanguage ?? defaultSettings.playgroundPreferredLanguage) as ProgrammingLanguage;
    const rawSize = input?.editorFontSize;
    const size = typeof rawSize === 'number' ? rawSize : defaultSettings.editorFontSize;
    const editorFontSize = Math.min(24, Math.max(12, size));
    const rawTheme = (input?.theme ?? defaultSettings.theme) as ThemeChoice;
    const theme: ThemeChoice = rawTheme === 'light' ? 'light' : 'dark';
    const vimMode = input?.vimMode === 'on' ? 'on' : 'off';
    const isSidebarOpen = typeof input?.isSidebarOpen === 'boolean' ? input.isSidebarOpen : defaultSettings.isSidebarOpen;
    const validPanels: ActivePanel[] = ['explorer', 'search', null];
    const activePanel = validPanels.includes(input?.activePanel as ActivePanel) ? input.activePanel as ActivePanel : defaultSettings.activePanel;
    const gateLanguages: GateLanguage[] = ['java', 'python', 'cpp', 'csharp', 'rust', 'go', 'typescript'];
    const difficultyLevels: DifficultyLevel[] = ['0', '25', '50', '75', '99', '100'];
    const codegateLanguage = gateLanguages.includes(input?.codegateLanguage) ? input.codegateLanguage as GateLanguage : defaultSettings.codegateLanguage;
    const solutionDifficulty = difficultyLevels.includes(input?.solutionDifficulty) ? input.solutionDifficulty as DifficultyLevel : defaultSettings.solutionDifficulty;
    const selectedLeetcodeDifficulties = Array.isArray(input?.leetcodeDifficulties)
        ? leetcodeDifficultyLevels.filter((value) => input.leetcodeDifficulties.includes(value))
        : [];
    const leetcodeDifficulties = selectedLeetcodeDifficulties.length ? selectedLeetcodeDifficulties : [...defaultSettings.leetcodeDifficulties];
    const aiEnabled = typeof input?.aiEnabled === 'boolean' ? input.aiEnabled : defaultSettings.aiEnabled;
    return { preferredLanguage, playgroundPreferredLanguage, editorFontSize, theme, vimMode, isSidebarOpen, activePanel, codegateLanguage, solutionDifficulty, leetcodeDifficulties, aiEnabled };
}

// Packaged Electron uses its user-data settings file. A missing file falls back
// to the legacy localStorage value once so it can be migrated.
const initialSettings: UserSettings = browser
    ? normalizeSettings(window.codegateDesktop?.settingsSnapshot?.desktopSettingsPresent === false
        ? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        : window.codegateDesktop?.settingsSnapshot ?? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
    : defaultSettings;

const userSettingsStorage = writable<UserSettings>(initialSettings);

function applyTheme(theme: ThemeChoice) {
    const root = document.documentElement;
    root.dataset.theme = theme;
}

if (browser) {
    applyTheme(initialSettings.theme);
    userSettingsStorage.subscribe((value) => {
        if (window.codegateDesktop) {
            void window.codegateDesktop.saveSettings(value).then(() => {
                localStorage.removeItem(STORAGE_KEY);
            }).catch((error) => {
                console.error('Unable to save desktop settings', error);
            });
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        }
        applyTheme(value.theme);
    });
}

export default userSettingsStorage;
