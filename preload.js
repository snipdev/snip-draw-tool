const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  loadProject: () => ipcRenderer.invoke('project:load'),
  onSaveRequest: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('menu:save-project', handler);
    return () => ipcRenderer.removeListener('menu:save-project', handler);
  },
  onLoadRequest: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('menu:load-project', handler);
    return () => ipcRenderer.removeListener('menu:load-project', handler);
  },
});
