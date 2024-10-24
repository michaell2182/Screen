const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableWebRTC: true,
    },
    // Styling for transparent window
    transparent: true,
    frame: false,
    titleBarStyle: 'hidden',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    hasShadow: true,
    // Center window by default
    center: true,
    // Make window draggable
    movable: true,
    // Minimum dimensions
    minWidth: 600,
    minHeight: 450,
    // Modern macOS styling
    roundedCorners: true,
    backgroundColor: '#00ffffff', // Transparent background
    // Show in all workspaces
    focusable: true,
    // Enable backdrop filters
    maximizable: false,
    resizable: false
  });

  // Hide the menu bar
  win.setMenuBarVisibility(false);

  // Make specific regions draggable
  win.webContents.on('dom-ready', () => {
    win.webContents.insertCSS(`
      .draggable {
        -webkit-app-region: drag;
      }
      .non-draggable {
        -webkit-app-region: no-drag;
      }
    `);
  });

  // Add permission handling with enhanced security
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      console.log(`Blocked permission request: ${permission}`);
      callback(false);
    }
  });

  // Enhanced permission check handling
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media'];
    return allowedPermissions.includes(permission);
  });

  // Prevent new windows from being created
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Load the HTML file
  win.loadFile(path.join(__dirname, 'index.html'));

  // Handle window controls (minimize, close)
  ipcMain.handle('window-controls', (event, action) => {
    switch (action) {
      case 'minimize':
        win.minimize();
        break;
      case 'close':
        win.close();
        break;
    }
  });

  // Keep window on top while recording
  ipcMain.handle('set-always-on-top', (event, value) => {
    win.setAlwaysOnTop(value, 'floating');
    win.setVisibleOnAllWorkspaces(value);
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