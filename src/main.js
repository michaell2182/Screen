const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

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

// Update the get-video-sources handler
ipcMain.handle('get-video-sources', async (event, sourceType) => {
  try {
    let types = ['screen', 'window'];
    if (sourceType === 'screen') {
      types = ['screen'];
    } else if (sourceType === 'window') {
      types = ['window'];
    }
    // Note: 'area' selection is typically handled on the renderer side,
    // so we'll return all sources for 'area' type

    const sources = await desktopCapturer.getSources({
      types: types,
      thumbnailSize: { width: 150, height: 150 },
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
