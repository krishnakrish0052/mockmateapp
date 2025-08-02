const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  writeWebm: async (arrayBuffer) => {
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(arrayBuffer);
    return ipcRenderer.invoke('write-webm', buffer);
  }
});