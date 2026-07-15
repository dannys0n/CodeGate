import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const LEFT_PANEL_WIDTH_STORAGE_KEY = 'pane-width';
const defaultLeftPanelWidth = 50;
const useDesktopSnapshot = browser && window.codegateDesktop?.settingsSnapshot?.desktopSettingsPresent !== false;
const initialLeftPanelWidth = browser
    ? (useDesktopSnapshot && typeof window.codegateDesktop?.settingsSnapshot?.leftPaneWidth === 'number'
        ? window.codegateDesktop.settingsSnapshot.leftPaneWidth
        : (JSON.parse(localStorage.getItem(LEFT_PANEL_WIDTH_STORAGE_KEY) || 'null') ?? defaultLeftPanelWidth))
    : defaultLeftPanelWidth;
export const leftPaneWidthStore = writable<number>(initialLeftPanelWidth);

const EXEC_PANEL_HEIGHT_STORAGE_KEY = 'exec-pane-height';
const defaultExecPanelHeight = 50;
const initialExecPanelHeight = browser
    ? (useDesktopSnapshot && typeof window.codegateDesktop?.settingsSnapshot?.execPaneHeight === 'number'
        ? window.codegateDesktop.settingsSnapshot.execPaneHeight
        : (JSON.parse(localStorage.getItem(EXEC_PANEL_HEIGHT_STORAGE_KEY) || 'null') ?? defaultExecPanelHeight))
    : defaultExecPanelHeight;
export const execPaneHeightStore = writable<number>(initialExecPanelHeight);

if (browser) {
    leftPaneWidthStore.subscribe((value) => {
        if (window.codegateDesktop) {
            void window.codegateDesktop.saveSettings({ leftPaneWidth: value }).then(() => {
                localStorage.removeItem(LEFT_PANEL_WIDTH_STORAGE_KEY);
            }).catch((error) => {
                console.error('Unable to save desktop layout', error);
            });
        } else {
            localStorage.setItem(LEFT_PANEL_WIDTH_STORAGE_KEY, JSON.stringify(value));
        }
    });

    execPaneHeightStore.subscribe((value) => {
        if (window.codegateDesktop) {
            void window.codegateDesktop.saveSettings({ execPaneHeight: value }).then(() => {
                localStorage.removeItem(EXEC_PANEL_HEIGHT_STORAGE_KEY);
            }).catch((error) => {
                console.error('Unable to save desktop layout', error);
            });
        } else {
            localStorage.setItem(EXEC_PANEL_HEIGHT_STORAGE_KEY, JSON.stringify(value));
        }
    });
}
