const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Make sure to set the path to the ffmpeg binaries
const ffmpegPath = require('ffmpeg-static').path;
const ffprobePath = require('ffprobe-static').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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
      defaultPath: `screen-recording-${new Date().toISOString()}.mp4`,
      properties: ['createDirectory', 'showOverwriteConfirmation'],
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] }
      ]
    });

    if (canceled || !filePath) {
      return null;
    }

    // Save the buffer as a temporary file
    const tempInputPath = path.join(app.getPath('temp'), 'temp_recording_input');
    await fs.promises.writeFile(tempInputPath, Buffer.from(buffer));

    // Convert to MP4 using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart'
        ])
        .toFormat('mp4')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(filePath);
    });

    // Delete the temporary input file
    await fs.promises.unlink(tempInputPath);

    return filePath;
  } catch (error) {
    console.error('Error saving video:', error);
    throw error;
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
