const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Snip Draw Tool',
    backgroundColor: '#1a1a2e',
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Load Project',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) => (win || mainWindow)?.webContents.send('menu:load-project'),
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: (_item, win) => (win || mainWindow)?.webContents.send('menu:save-project'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('project:save', async (event, data) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || mainWindow;
  try {
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Project',
      defaultPath: 'snip-draw-project.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, path: result.filePath };
  } catch (err) {
    dialog.showErrorBox('Save failed', String(err.message || err));
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('project:load', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || mainWindow;
  try {
    const result = await dialog.showOpenDialog(win, {
      title: 'Load Project',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    const content = await fs.readFile(result.filePaths[0], 'utf8');
    // Validate JSON early to give a clear error
    JSON.parse(content);
    return { ok: true, path: result.filePaths[0], content };
  } catch (err) {
    dialog.showErrorBox('Load failed', String(err.message || err));
    return { ok: false, error: String(err.message || err) };
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMenu();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
