const { app, BrowserWindow, ipcMain, dialog, desktopCapturer } = require('electron');
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
      enableWebRTC: true
    }
  });

  // Add permission handling
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Add permission check handling
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media'];
    return allowedPermissions.includes(permission);
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

// Handle app ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save video file when recording is stopped
ipcMain.handle('save-video', async (event, buffer) => {
  const { filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `recording.webm`,  // Use .webm extension
    filters: [
      { name: 'WebM Video', extensions: ['webm'] }  // Save as WebM
    ]
  });

  if (filePath) {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  }
});

// Add functionality to get video sources (windows/screens)
ipcMain.handle('get-video-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1280, height: 720 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting video sources:', error);
    return [];
  }
});
