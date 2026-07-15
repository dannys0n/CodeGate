const { contextBridge, ipcRenderer } = require('electron');

const settingsSnapshot = ipcRenderer.sendSync('codegate:settings-snapshot');

contextBridge.exposeInMainWorld('codegateDesktop', Object.freeze({
  settingsSnapshot: Object.freeze(settingsSnapshot),
  saveSettings: (settings) => ipcRenderer.invoke('codegate:settings-save', settings),
  release: (outcome) => ipcRenderer.invoke('codegate:release', outcome),
  startupStatus: () => ipcRenderer.invoke('codegate:startup-status'),
  startupEventsStatus: () => ipcRenderer.invoke('codegate:startup-events-status'),
  setStartupEvents: (events) => ipcRenderer.invoke('codegate:set-startup-events', events)
}));
