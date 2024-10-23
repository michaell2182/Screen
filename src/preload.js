const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Fetches video sources (screens and windows) for recording
  getVideoSources: () => ipcRenderer.invoke('get-video-sources'),

  // Save recorded video using IPC
  saveVideo: (blob) => ipcRenderer.invoke('save-video', blob)
});
