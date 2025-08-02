const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendAudioData: async (arrayBuffer) => {
    // Send ArrayBuffer directly - Electron handles the conversion
    return ipcRenderer.invoke('send-audio-data', arrayBuffer);
  }
});
