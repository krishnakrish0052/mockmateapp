const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendAudioData: async (arrayBuffer) => {
    // Convert ArrayBuffer to Buffer for IPC transmission
    const buffer = Buffer.from(arrayBuffer);
    return ipcRenderer.invoke('send-audio-data', buffer);
  }
});
