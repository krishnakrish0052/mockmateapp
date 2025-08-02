
const { ipcRenderer } = require('electron');

let mediaRecorder = null;
let audioChunks = [];

// Start sound recording
ipcRenderer.on('start-sound-recording', async () => {
    try {
        console.log('Sound capture window: Starting recording...');
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                sampleRate: 44100
            },
            video: false
        });

        mediaRecorder = new MediaRecorder(stream, { 
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        });
        
        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const arrayBuffer = await event.data.arrayBuffer();
                ipcRenderer.invoke('sound-audio-data', arrayBuffer);
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('Sound capture window: Recording stopped');
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(1000); // Capture data every 1 second
        console.log('Sound capture window: Recording started');
    } catch (error) {
        console.error('Sound capture window: Error starting recording:', error);
    }
});

// Stop sound recording
ipcRenderer.on('stop-sound-recording', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    console.log('Sound capture window: Stop recording signal received');
});

// Auto-start recording when window loads
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        ipcRenderer.emit('start-sound-recording');
    }, 500);
});
