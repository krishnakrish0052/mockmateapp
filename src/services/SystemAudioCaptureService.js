const fetch = require('node-fetch');
const FormData = require('form-data');
const { BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

class SystemAudioCaptureService {
    constructor() {
        this.isCapturing = false;
        this.apiEndpoint = 'https://text.pollinations.ai/openai';
        this.transcriptionCallback = null;
        this.captureWindow = null;
        this.ipcHandlerSetup = false;
        
        console.log('SystemAudioCaptureService: Constructor called, service initialized.');
        this.setupIpcHandlers();
    }
    
    setupIpcHandlers() {
        if (this.ipcHandlerSetup) return;
        
        // Handle audio data from renderer process
        ipcMain.handle('send-audio-data', async (event, arrayBuffer) => {
            console.log('SystemAudioCaptureService: Received audio data from renderer, size:', arrayBuffer?.byteLength || 0);
            if (this.isCapturing && arrayBuffer && arrayBuffer.byteLength > 0) {
                const buffer = Buffer.from(arrayBuffer);
                await this.processRealAudio(buffer);
            }
        });
        
        this.ipcHandlerSetup = true;
        console.log('SystemAudioCaptureService: IPC handlers setup completed.');
    }

    async startCapture(transcriptionCallback) {
        console.log('SystemAudioCaptureService: startCapture called with callback:', !!transcriptionCallback);
        
        if (this.isCapturing) {
            console.warn('SystemAudioCaptureService: Already capturing, ignoring start request.');
            return { success: false, message: 'Already capturing' };
        }
        
        this.audioChunks = [];
        this.transcriptionCallback = transcriptionCallback;
        this.isCapturing = true;
        console.log('SystemAudioCaptureService: Starting real audio capture process...');

        try {
            // Set up desktop capturer for system audio loopback
            console.log('SystemAudioCaptureService: Setting up display media request handler for loopback audio...');
            session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
                try {
                    const sources = await desktopCapturer.getSources({ types: ['screen'] });
                    console.log('SystemAudioCaptureService: Desktop sources obtained:', sources.length);
                    
                    callback({
                        video: sources[0],   // required placeholder
                        audio: 'loopback'    // Windows system audio
                    });
                    console.log('SystemAudioCaptureService: Display media request handler callback completed');
                } catch (error) {
                    console.error('SystemAudioCaptureService: Error in display media request handler:', error);
                    callback({ video: null, audio: null });
                }
            });

            // Create a hidden renderer window to handle audio capture with preload script
            console.log('SystemAudioCaptureService: Creating hidden capture window...');
            this.captureWindow = new BrowserWindow({
                width: 1,
                height: 1,
                show: false,
                webPreferences: {
                    preload: path.join(__dirname, 'audio-capture-preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: false
                }
            });

            // Load HTML content that will handle audio capture
            const captureHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8"/>
                </head>
                <body>
                    <script>
                        let mediaRecorder;
                        let chunks = [];
                        let processInterval;
                        
                        async function startCapture() {
                            try {
                                const stream = await navigator.mediaDevices.getDisplayMedia({
                                    audio: true,
                                    video: false
                                });
                                
                                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
                                
                                mediaRecorder.ondataavailable = e => {
                                    if (e.data.size > 0) {
                                        chunks.push(e.data);
                                    }
                                };
                                
                                mediaRecorder.onerror = event => {
                                    console.error('Recording error:', event.error);
                                };
                                
                                // Start recording with timeslice for real-time processing
                                mediaRecorder.start(5000); // 5-second chunks
                                
                                // Process chunks periodically
                                processInterval = setInterval(async () => {
                                    if (chunks.length > 0) {
                                        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                                        chunks = [];
                                        
                                        // Convert to ArrayBuffer and send to main process via IPC
                                        const arrayBuffer = await audioBlob.arrayBuffer();
                                        if (window.electronAPI && window.electronAPI.sendAudioData) {
                                            await window.electronAPI.sendAudioData(arrayBuffer);
                                        }
                                    }
                                }, 5000);
                                
                                console.log('Audio capture started successfully');
                            } catch (error) {
                                console.error('Failed to start capture:', error);
                            }
                        }
                        
                        // Clean up function
                        function stopCapture() {
                            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                                mediaRecorder.stop();
                                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                            }
                            if (processInterval) {
                                clearInterval(processInterval);
                            }
                        }
                        
                        // Start capture when page loads
                        window.addEventListener('DOMContentLoaded', startCapture);
                        window.addEventListener('beforeunload', stopCapture);
                    </script>
                </body>
                </html>
            `;

            // Load the HTML content
            await this.captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(captureHTML)}`);
            
            console.log('SystemAudioCaptureService: Real audio capture setup completed successfully.');
            return { success: true, message: 'Audio capture started' };
        } catch (error) {
            console.error('SystemAudioCaptureService: Failed to start real audio capture:', error);
            this.isCapturing = false;
            if (this.captureWindow) {
                this.captureWindow.close();
                this.captureWindow = null;
            }
            return { success: false, message: error.message };
        }
    }

    // Removed simulateAudioCapture as it is no longer needed
    // Removed processSimulatedAudio as it is no longer needed

    async stopCapture() {
        console.log('SystemAudioCaptureService: stopCapture called.');
        
        if (!this.isCapturing) {
            console.warn('SystemAudioCaptureService: Not currently capturing, ignoring stop request.');
            return { success: false, message: 'Not currently capturing' };
        }
        
        this.isCapturing = false;
        console.log('SystemAudioCaptureService: Stopping audio capture...');

        try {
            // Close capture window
            if (this.captureWindow && !this.captureWindow.isDestroyed()) {
                this.captureWindow.close();
                this.captureWindow = null;
                console.log('SystemAudioCaptureService: Capture window closed.');
            }
            
            // Clear chunk processing interval
            if (this.chunkInterval) {
                clearInterval(this.chunkInterval);
                this.chunkInterval = null;
                console.log('SystemAudioCaptureService: Chunk processing interval cleared.');
            }
            
            // Clean up resources
            this.transcriptionCallback = null;
            this.audioChunks = [];
            this.mediaRecorder = null;
            this.stream = null;
            
            console.log('SystemAudioCaptureService: Audio capture stopped successfully.');
            return { success: true, message: 'Audio capture stopped' };
            
        } catch (error) {
            console.error('SystemAudioCaptureService: Error stopping audio capture:', error);
            return { success: false, message: error.message };
        }
    }

    // Method to receive audio data from renderer process
    receiveAudioData(arrayBuffer) {
        console.log('SystemAudioCaptureService: receiveAudioData called with ArrayBuffer size:', arrayBuffer?.byteLength || 0);
        
        if (this.isCapturing && arrayBuffer && arrayBuffer.byteLength > 0) {
            // Convert ArrayBuffer to Buffer for Node.js compatibility
            const buffer = Buffer.from(arrayBuffer);
            
            // Process the audio immediately instead of storing chunks
            this.processRealAudio(buffer);
            console.log('SystemAudioCaptureService: Audio data processed directly from renderer');
        }
    }
    
    async processRealAudio(audioData) {
        const dataSize = Buffer.isBuffer(audioData) ? audioData.length : (audioData?.size || 0);
        console.log('SystemAudioCaptureService: processRealAudio called with data size:', dataSize);
        
        if (!audioData || dataSize === 0) {
            console.warn('SystemAudioCaptureService: No audio data to process.');
            return;
        }
        
        try {
            console.log('SystemAudioCaptureService: Preparing to send audio to STT API...');

            const base64Audio = audioData.toString('base64'); // Convert Buffer to base64 string
            const payload = {
                model: 'openai-audio',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Transcribe this audio:' },
                            {
                                type: 'input_audio',
                                input_audio: {
                                    data: base64Audio,
                                    format: 'webm'
                                }
                            }
                        ]
                    }
                ]
            };

            console.log('SystemAudioCaptureService: Sending POST request to STT API:', this.apiEndpoint);

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            console.log('SystemAudioCaptureService: STT API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`STT API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('SystemAudioCaptureService: STT API response data:', data);
            
            // Extract transcription from OpenAI-style response
            const transcriptionText = data.choices?.[0]?.message?.content;
            console.log('SystemAudioCaptureService: Extracted transcription text:', transcriptionText);
            
            if (transcriptionText && transcriptionText.trim() && this.transcriptionCallback) {
                const transcriptionResult = {
                    text: transcriptionText.trim(),
                    confidence: 0.9, // Pollinations doesn't return confidence, use default
                    timestamp: Date.now()
                };
                
                console.log('SystemAudioCaptureService: Calling transcription callback with result:', transcriptionResult);
                this.transcriptionCallback(transcriptionResult);
                
                // Also send transcription to main process via IPC for integration with app state
                const { ipcMain } = require('electron');
                const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
                if (mainWindow) {
                    mainWindow.webContents.send('transcription-from-system-audio', transcriptionResult);
                }
            } else {
                console.warn('SystemAudioCaptureService: No transcription text in STT response or no callback available.');
            }
            
        } catch (error) {
            console.error('SystemAudioCaptureService: STT API error:', error);
            
            // Still call callback with error info
            if (this.transcriptionCallback) {
                this.transcriptionCallback({
                    text: '[Audio processing error]',
                    confidence: 0,
                    timestamp: Date.now(),
                    error: error.message
                });
            }
        }
    }
    
    getStatus() {
        const status = {
            isCapturing: this.isCapturing,
            hasCallback: !!this.transcriptionCallback,
            chunkInterval: !!this.chunkInterval,
            audioChunksCount: this.audioChunks.length
        };
        
        console.log('SystemAudioCaptureService: Current status:', status);
        return status;
    }
}

module.exports = SystemAudioCaptureService;
