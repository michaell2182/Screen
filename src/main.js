const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableWebRTC: true,
    },
    transparent: true,
    frame: false,
    titleBarStyle: 'hidden',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    hasShadow: true,
    backgroundColor: '#00000000', // Fully transparent
    trafficLightPosition: { x: 15, y: 15 },
  });

  // Load the HTML file
  win.loadFile(path.join(__dirname, 'index.html'));

  // Make the entire window draggable
  win.webContents.on('dom-ready', () => {
    win.webContents.insertCSS(`
      body {
        -webkit-app-region: drag;
      }
      button, select, input {
        -webkit-app-region: no-drag;
      }
    `);
  });

  return win;
}

// Enhanced app ready handler
app.whenReady().then(() => {
  // Enable backdrop filters for transparent effects
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  
  const mainWindow = createWindow();

  // Handle activation
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
});

// Improved window management
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Enhanced video saving with error handling
ipcMain.handle('save-video', async (event, buffer) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      buttonLabel: 'Save Recording',
      defaultPath: `screen-recording-${new Date().toISOString()}.webm`,
      properties: ['createDirectory', 'showOverwriteConfirmation'],
      filters: [
        { name: 'WebM Video', extensions: ['webm'] }
      ]
    });

    if (canceled || !filePath) {
      return null;
    }

    await fs.promises.writeFile(filePath, Buffer.from(buffer));
    return filePath;
  } catch (error) {
    console.error('Error saving video:', error);
    throw error;
  }
});

// Improved video source capture
ipcMain.handle('get-video-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1280, height: 720 },
      fetchWindowIcons: true
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      display_id: source.display_id,
      appIcon: source.appIcon?.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting video sources:', error);
    return [];
  }
});
