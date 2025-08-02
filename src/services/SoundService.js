const fs = require('fs');
const path = require('path');
const { ipcMain, BrowserWindow, session, desktopCapturer } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class SoundService {
    constructor() {
        this.isCapturing = false;
        this.audioChunks = [];
        this.saveDirectory = path.join(__dirname, '../../recordings'); // Recordings directory
        this.captureWindow = null;
        this.autoSaveEnabled = true;
        this.keepWebMFile = false; // Option to keep original WebM file
        this.recordingSession = null;
        this.ensureDirectoryExists();
        this.setupIpcHandlers();
    }

    setupIpcHandlers() {
        // Handle sound capture start/stop from renderer
        ipcMain.handle('start-sound-capture', () => this.startCapture());
        ipcMain.handle('stop-sound-capture', () => this.stopCapture());
        
        // Handle audio data from capture window
        ipcMain.handle('sound-audio-data', async (event, audioBuffer) => {
            if (this.isCapturing && audioBuffer) {
                this.audioChunks.push(Buffer.from(audioBuffer));
                console.log('SoundService: Received audio chunk, size:', audioBuffer.byteLength);
            }
        });
    }

    async startCapture() {
        if (this.isCapturing) {
            console.log('SoundService: Already capturing');
            return { success: false, message: 'Already capturing' };
        }

        console.log('SoundService: Starting capture...');
        this.isCapturing = true;
        this.audioChunks = [];
        
        try {
            // Set up display media request handler for audio capture
            session.defaultSession.setDisplayMediaRequestHandler((_, callback) => {
                desktopCapturer.getSources({ types: ['screen', 'window'] }).then(sources => {
                    console.log('SoundService: Desktop sources obtained:', sources.length);
                    callback({
                        video: sources[0],
                        audio: 'loopback' // System audio
                    });
                }).catch(error => {
                    console.error('SoundService: Error in display media request handler:', error);
                    callback({ video: null, audio: null });
                });
            });

            // Create capture window for audio recording
            await this.createCaptureWindow();
            
            console.log('SoundService: Audio capture started successfully');
            return { success: true, message: 'Audio capture started' };
        } catch (error) {
            console.error('SoundService: Failed to start capture:', error);
            this.isCapturing = false;
            return { success: false, message: error.message };
        }
    }

    async stopCapture() {
        if (!this.isCapturing) {
            console.log('SoundService: Not currently capturing');
            return { success: false, message: 'Not currently capturing' };
        }

        console.log('SoundService: Stopping capture...');
        this.isCapturing = false;
        
        try {
            // Stop capture in the window
            if (this.captureWindow && !this.captureWindow.isDestroyed()) {
                this.captureWindow.webContents.send('stop-sound-recording');
                setTimeout(() => {
                    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
                        this.captureWindow.close();
                        this.captureWindow = null;
                    }
                }, 100);
            }
            
            // Auto-save the recorded audio if enabled
            if (this.autoSaveEnabled && this.audioChunks.length > 0) {
                await this.saveAudioFile();
            }
            
            console.log('SoundService: Audio capture stopped successfully');
            return { success: true, message: 'Audio capture stopped and file saved' };
        } catch (error) {
            console.error('SoundService: Error stopping capture:', error);
            return { success: false, message: error.message };
        }
    }

    async createCaptureWindow() {
        if (this.captureWindow && !this.captureWindow.isDestroyed()) {
            console.log('SoundService: Capture window already exists');
            return;
        }

        console.log('SoundService: Creating sound capture window...');
        this.captureWindow = new BrowserWindow({
            width: 1,
            height: 1,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'sound-capture-preload.js')
            }
        });

        // Create the preload script for sound capture
        const preloadContent = `
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
`;

        // Write the preload script
        const preloadPath = path.join(__dirname, 'sound-capture-preload.js');
        fs.writeFileSync(preloadPath, preloadContent);

        // Load a minimal HTML page
        const htmlContent = `<!DOCTYPE html><html><head><title>Sound Capture</title></head><body><script>console.log('Sound capture window loaded');</script></body></html>`;
        const htmlPath = path.join(__dirname, 'sound-capture.html');
        fs.writeFileSync(htmlPath, htmlContent);
        
        this.captureWindow.loadFile(htmlPath);
        
        this.captureWindow.webContents.once('did-finish-load', () => {
            console.log('SoundService: Capture window loaded, starting recording...');
            this.captureWindow.webContents.send('start-sound-recording');
        });

        this.captureWindow.on('closed', () => {
            this.captureWindow = null;
            console.log('SoundService: Capture window closed');
        });
    }

    ensureDirectoryExists() {
        try {
            if (!fs.existsSync(this.saveDirectory)) {
                fs.mkdirSync(this.saveDirectory, { recursive: true });
                console.log('SoundService: Created recordings directory:', this.saveDirectory);
            }
        } catch (error) {
            console.error('SoundService: Error creating directory:', error);
        }
    }

    async saveAudioFile() {
        if (this.audioChunks.length === 0) {
            console.log('SoundService: No audio data to save');
            return;
        }

        console.log('SoundService: Saving audio file...');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        const fileName = `sound_recording_${timestamp}.webm`;
        const filePath = path.join(this.saveDirectory, fileName);
        
        try {
            const audioBuffer = Buffer.concat(this.audioChunks);
            await fs.promises.writeFile(filePath, audioBuffer);
            console.log('SoundService: Audio file saved to:', filePath);

            // Convert WebM to WAV
            const wavFilePath = filePath.replace('.webm', '.wav');

            await new Promise((resolve, reject) => {
                ffmpeg(filePath)
                    .toFormat('wav')
                    .on('end', () => {
                        console.log('SoundService: Audio converted to WAV:', wavFilePath);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('SoundService: Error converting to WAV:', err);
                        reject(err);
                    })
                    .save(wavFilePath);
            });

            // Clear chunks after saving
            this.audioChunks = [];

            return wavFilePath;
        } catch (err) {
            console.error('SoundService: Error saving audio file:', err);
            throw err;
        }
    }

    setAutoSave(enabled) {
        this.autoSaveEnabled = enabled;
        console.log('SoundService: Auto-save', enabled ? 'enabled' : 'disabled');
    }

    getStatus() {
        return {
            isCapturing: this.isCapturing,
            autoSaveEnabled: this.autoSaveEnabled,
            chunksCount: this.audioChunks.length,
            saveDirectory: this.saveDirectory
        };
    }
}

module.exports = SoundService;

