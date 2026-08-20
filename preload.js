const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  loadProject: () => ipcRenderer.invoke('project:load'),
  onSaveRequest: (cb) => ipcRenderer.on('menu:save-project', () => cb()),
  onLoadRequest: (cb) => ipcRenderer.on('menu:load-project', () => cb()),
});