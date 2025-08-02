const { BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const FFmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');

// Set FFmpeg path
FFmpeg.setFfmpegPath(ffmpegPath);

class SystemAudioCaptureService {
    constructor() {
        this.isCapturing = false;
        this.apiEndpoint = 'https://text.pollinations.ai/openai';
        this.transcriptionCallback = null;
        this.captureWindow = null;
        this.autoSaveAudio = true; // Enable auto-save by default
        this.saveDirectory = path.join(__dirname, '..', '..', 'audio_output'); // Dedicated audio output directory
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioStream = null;
        
        console.log('SystemAudioCaptureService: Constructor called, service initialized.');
        console.log('SystemAudioCaptureService: Auto-save enabled, directory:', this.saveDirectory);
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
            // Set up display media request handler for system audio loopback
            console.log('SystemAudioCaptureService: Setting up display media request handler for loopback audio...');
            session.defaultSession.setDisplayMediaRequestHandler((_, callback) => {
                desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                    console.log('SystemAudioCaptureService: Desktop sources obtained:', sources.length);
                    callback({
                        video: sources[0],   // required placeholder
                        audio: 'loopback'    // Windows system audio
                    });
                    console.log('SystemAudioCaptureService: Display media request handler callback completed');
                }).catch(error => {
                    console.error('SystemAudioCaptureService: Error in display media request handler:', error);
                    callback({ video: null, audio: null });
                });
            });

            // Use the existing control window to handle audio capture
            this.setupControlWindowCapture();
            
            console.log('SystemAudioCaptureService: Audio capture setup complete');
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
            // Stop capture in the window first
            if (this.captureWindow && !this.captureWindow.isDestroyed()) {
                this.captureWindow.webContents.send('stop-capture');
                setTimeout(() => {
                    if (this.captureWindow && !this.captureWindow.isDestroyed()) {
                        this.captureWindow.close();
                        this.captureWindow = null;
                        console.log('SystemAudioCaptureService: Capture window closed.');
                    }
                }, 100);
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

    
    
    async processRealAudio(audioData) {
        const timestamp = new Date().toISOString();
        const dataSize = Buffer.isBuffer(audioData) ? audioData.length : (audioData?.size || 0);
        
        console.log(`[${timestamp}] SystemAudioCaptureService: ============ AUDIO PROCESSING START ============`);
        console.log(`[${timestamp}] SystemAudioCaptureService: Received audio data - Size: ${dataSize} bytes, Type: ${Buffer.isBuffer(audioData) ? 'Buffer' : typeof audioData}`);
        
        if (!audioData || dataSize === 0) {
            console.warn(`[${timestamp}] SystemAudioCaptureService: ❌ No audio data to process - aborting`);
            return;
        }
        
        let tempWebmPath = null;
        let tempWavPath = null;
        
        try {
            // Step 1: Save WebM data to temporary file
            console.log(`[${timestamp}] SystemAudioCaptureService: 📁 Step 1/6 - Creating temporary files...`);
            const tempDir = os.tmpdir();
            const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
            tempWebmPath = path.join(tempDir, `audio_${uniqueId}.webm`);
            tempWavPath = path.join(tempDir, `audio_${uniqueId}.wav`);
            
            console.log(`[${timestamp}] SystemAudioCaptureService: 💾 Writing WebM buffer to: ${tempWebmPath}`);
            fs.writeFileSync(tempWebmPath, audioData);
            console.log(`[${timestamp}] SystemAudioCaptureService: ✅ WebM file written successfully - Size: ${fs.statSync(tempWebmPath).size} bytes`);
            
            // Step 2: Convert WebM to WAV using FFmpeg
            console.log(`[${timestamp}] SystemAudioCaptureService: 🔄 Step 2/6 - Converting WebM to WAV using FFmpeg...`);
            await this.convertWebmToWav(tempWebmPath, tempWavPath, timestamp);
            
            // Step 2.5: Auto-save WAV file if enabled
            if (this.autoSaveAudio) {
                await this.saveWavFile(tempWavPath, timestamp);
            }
            
            // Step 3: Read WAV file and convert to base64
            console.log(`[${timestamp}] SystemAudioCaptureService: 📖 Step 3/6 - Reading converted WAV file...`);
            const wavBuffer = fs.readFileSync(tempWavPath);
            const wavStats = fs.statSync(tempWavPath);
            console.log(`[${timestamp}] SystemAudioCaptureService: ✅ WAV file read successfully - Size: ${wavStats.size} bytes`);
            
            const base64Audio = wavBuffer.toString('base64');
            console.log(`[${timestamp}] SystemAudioCaptureService: 🔤 Base64 conversion completed - Length: ${base64Audio.length} characters`);
            
            // Step 4: Prepare API payload
            console.log(`[${timestamp}] SystemAudioCaptureService: 📦 Step 4/6 - Preparing STT API payload...`);
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
                                    format: 'wav' // Now using WAV format instead of WebM
                                }
                            }
                        ]
                    }
                ]
            };
            
            console.log(`[${timestamp}] SystemAudioCaptureService: 📡 Step 5/6 - Sending POST request to STT API...`);
            console.log(`[${timestamp}] SystemAudioCaptureService: 🌐 API Endpoint: ${this.apiEndpoint}`);
            console.log(`[${timestamp}] SystemAudioCaptureService: 🎵 Audio Format: WAV, Model: openai-audio`);
            
            const response = await axios.post(this.apiEndpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'MockMate-Desktop/1.0',
                    'Authorization': `Bearer ${process.env.POLLINATIONS_API_KEY}`,
                    'Referer': process.env.POLLINATIONS_API_HEADER || 'mockmate'
                }
            });
            
            console.log(`[${timestamp}] SystemAudioCaptureService: 📨 STT API Response - Status: ${response.status} ${response.statusText}`);
            
            if (response.status !== 200) {
                console.error(`[${timestamp}] SystemAudioCaptureService: ❌ API Error Response:`, response.data);
                throw new Error(`STT API error: ${response.status} ${response.statusText} - ${JSON.stringify(response.data)}`);
            }
            
            const data = response.data;
            console.log(`[${timestamp}] SystemAudioCaptureService: 📄 STT API Response Data:`, JSON.stringify(data, null, 2));
            
            // Step 6: Extract and process transcription
            console.log(`[${timestamp}] SystemAudioCaptureService: 🔍 Step 6/6 - Extracting transcription from response...`);
            const transcriptionText = data.choices?.[0]?.message?.content;
            console.log(`[${timestamp}] SystemAudioCaptureService: 📝 Extracted transcription text: "${transcriptionText}"`);
            
            if (transcriptionText && transcriptionText.trim()) {
                const transcriptionResult = {
                    text: transcriptionText.trim(),
                    confidence: 0.9, // Pollinations doesn't return confidence, use default
                    timestamp: Date.now(),
                    audioSize: dataSize,
                    processingTime: Date.now() - new Date(timestamp).getTime()
                };
                
                console.log(`[${timestamp}] SystemAudioCaptureService: ✅ TRANSCRIPTION SUCCESS!`);
                console.log(`[${timestamp}] SystemAudioCaptureService: 📋 Final Result:`, JSON.stringify(transcriptionResult, null, 2));
                
                // Call the callback
                if (this.transcriptionCallback) {
                    console.log(`[${timestamp}] SystemAudioCaptureService: 📞 Calling transcription callback...`);
                    this.transcriptionCallback(transcriptionResult);
                    console.log(`[${timestamp}] SystemAudioCaptureService: ✅ Callback executed successfully`);
                } else {
                    console.warn(`[${timestamp}] SystemAudioCaptureService: ⚠️ No transcription callback available`);
                }
                
                // Send to main process for UI update
                console.log(`[${timestamp}] SystemAudioCaptureService: 📡 Sending transcription to main process for UI update...`);
                const mainWindows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
                console.log(`[${timestamp}] SystemAudioCaptureService: 🖥️ Found ${mainWindows.length} active windows`);
                
                mainWindows.forEach((window, index) => {
                    try {
                        window.webContents.send('transcription-from-system-audio', transcriptionResult);
                        console.log(`[${timestamp}] SystemAudioCaptureService: ✅ Sent to window ${index + 1}`);
                    } catch (windowError) {
                        console.error(`[${timestamp}] SystemAudioCaptureService: ❌ Failed to send to window ${index + 1}:`, windowError.message);
                    }
                });
                
            } else {
                console.warn(`[${timestamp}] SystemAudioCaptureService: ⚠️ No transcription text extracted from API response`);
                console.warn(`[${timestamp}] SystemAudioCaptureService: 🔍 Response structure check - choices: ${!!data.choices}, length: ${data.choices?.length}`);
                if (data.choices && data.choices[0]) {
                    console.warn(`[${timestamp}] SystemAudioCaptureService: 🔍 First choice - message: ${!!data.choices[0].message}, content: ${data.choices[0].message?.content}`);
                }
            }
            
        } catch (error) {
            const errorTimestamp = new Date().toISOString();
            console.error(`[${errorTimestamp}] SystemAudioCaptureService: ❌ PROCESSING ERROR:`, error.message);
            console.error(`[${errorTimestamp}] SystemAudioCaptureService: 📊 Error Stack:`, error.stack);
            
            // Send error callback
            if (this.transcriptionCallback) {
                const errorResult = {
                    text: '[Audio processing error]',
                    confidence: 0,
                    timestamp: Date.now(),
                    error: error.message,
                    audioSize: dataSize
                };
                
                console.log(`[${errorTimestamp}] SystemAudioCaptureService: 📞 Sending error callback...`);
                this.transcriptionCallback(errorResult);
            }
        } finally {
            // Cleanup temporary files
            const cleanupTimestamp = new Date().toISOString();
            console.log(`[${cleanupTimestamp}] SystemAudioCaptureService: 🧹 Cleaning up temporary files...`);
            
            try {
                if (tempWebmPath && fs.existsSync(tempWebmPath)) {
                    fs.unlinkSync(tempWebmPath);
                    console.log(`[${cleanupTimestamp}] SystemAudioCaptureService: 🗑️ Deleted WebM temp file: ${tempWebmPath}`);
                }
                if (tempWavPath && fs.existsSync(tempWavPath)) {
                    fs.unlinkSync(tempWavPath);
                    console.log(`[${cleanupTimestamp}] SystemAudioCaptureService: 🗑️ Deleted WAV temp file: ${tempWavPath}`);
                }
            } catch (cleanupError) {
                console.error(`[${cleanupTimestamp}] SystemAudioCaptureService: ⚠️ Cleanup error:`, cleanupError.message);
            }
            
            console.log(`[${cleanupTimestamp}] SystemAudioCaptureService: ============ AUDIO PROCESSING END ============`);
        }
    }
    
    async convertWebmToWav(inputPath, outputPath, timestamp) {
        return new Promise((resolve, reject) => {
            console.log(`[${timestamp}] SystemAudioCaptureService: 🔧 FFmpeg conversion started...`);
            console.log(`[${timestamp}] SystemAudioCaptureService: 📁 Input: ${inputPath}`);
            console.log(`[${timestamp}] SystemAudioCaptureService: 📁 Output: ${outputPath}`);
            
            FFmpeg(inputPath)
                .toFormat('wav')
                .audioFrequency(16000) // 16kHz sample rate for better STT compatibility
                .audioChannels(1)      // Mono channel
                .audioBitrate('128k')  // Standard bitrate
                .on('start', (commandLine) => {
                    console.log(`[${timestamp}] SystemAudioCaptureService: 🚀 FFmpeg command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    console.log(`[${timestamp}] SystemAudioCaptureService: ⏳ Conversion progress: ${Math.round(progress.percent || 0)}%`);
                })
                .on('end', () => {
                    console.log(`[${timestamp}] SystemAudioCaptureService: ✅ FFmpeg conversion completed successfully`);
                    console.log(`[${timestamp}] SystemAudioCaptureService: 📊 Output file size: ${fs.statSync(outputPath).size} bytes`);
                    resolve();
                })
                .on('error', (error) => {
                    console.error(`[${timestamp}] SystemAudioCaptureService: ❌ FFmpeg conversion failed:`, error.message);
                    reject(error);
                })
                .save(outputPath);
        });
    }

    async saveWavFile(wavPath, timestamp) {
        try {
            // Ensure the save directory exists
            if (!fs.existsSync(this.saveDirectory)) {
                fs.mkdirSync(this.saveDirectory, { recursive: true });
                console.log(`SystemAudioCaptureService: Created save directory: ${this.saveDirectory}`);
            }

            const fileName = `audio_${timestamp.replace(/[:.-]/g, '_')}.wav`;
            const destPath = path.join(this.saveDirectory, fileName);
            fs.copyFileSync(wavPath, destPath);
            console.log(`SystemAudioCaptureService: 🗃️ WAV file saved to: ${destPath}`);
        } catch (error) {
            console.error('SystemAudioCaptureService: ❌ Error saving WAV file:', error);
            throw error;
        }
    }
    
    setupControlWindowCapture() {
        console.log('SystemAudioCaptureService: Setting up control window for audio capture...');
        
        // Get the main control window
        const mainWindows = BrowserWindow.getAllWindows();
        const controlWindow = mainWindows.find(window => !window.isDestroyed());
        
        if (controlWindow) {
            this.captureWindow = controlWindow;
            console.log('SystemAudioCaptureService: Using existing control window for audio capture');
            
            // Send start capture signal to the control window
            controlWindow.webContents.send('start-system-audio-capture');
        } else {
            console.error('SystemAudioCaptureService: No control window found for audio capture');
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
