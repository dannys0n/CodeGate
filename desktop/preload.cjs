const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codegateDesktop', Object.freeze({
  release: (outcome) => ipcRenderer.invoke('codegate:release', outcome),
  startupStatus: () => ipcRenderer.invoke('codegate:startup-status'),
  startupEventsStatus: () => ipcRenderer.invoke('codegate:startup-events-status'),
  setStartupEvents: (events) => ipcRenderer.invoke('codegate:set-startup-events', events)
}));
