const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => ipcRenderer.send(channel, data),
        on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
        once: (channel, func) => ipcRenderer.once(channel, (event, ...args) => func(event, ...args)),
        invoke: (channel, data) => ipcRenderer.invoke(channel, data)
    },
    audio: {
        getBufferStats: () => ipcRenderer.invoke('get-audio-buffer-stats'),
        getRecentSegment: (durationMs) => ipcRenderer.invoke('get-recent-audio-segment', durationMs),
        clearBuffer: () => ipcRenderer.invoke('clear-audio-buffer'),
        getBufferHealth: () => ipcRenderer.invoke('get-audio-buffer-health'),
        searchAudioPatterns: (options) => ipcRenderer.invoke('search-audio-patterns', options),
    }
});
