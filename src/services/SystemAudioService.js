const { ipcMain } = require('electron');
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
const path = require('path');

class SystemAudioService {
    constructor() {
        this.isTranscribing = false;
        this.recognizer = null;
        this.audioBuffer = [];
        this.transcriptionCallback = null;
        this.chunkDuration = 3; // seconds
        this.sampleRate = 16000;
        this.isInitialized = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
    }

    async initTranscription(userApproval = false) {
        if (!userApproval) {
            console.log('⚠️ Whisper model initialization requires user approval');
            console.log('💡 Call initTranscription(true) to download and initialize models');
            return { requiresDownload: true, message: 'User approval required for model download' };
        }

        try {
            console.log('🎤 Initializing Whisper ASR pipeline with user approval...');
            
            // Try different Whisper models in order of preference
            const modelOptions = [
                'Xenova/whisper-tiny.en',
                'Xenova/whisper-small.en',
                'Xenova/whisper-base.en',
                'Xenova/whisper-tiny',
                'Xenova/whisper-small',
                'Xenova/whisper-base'
            ];
            
            let modelLoaded = false;
            for (const model of modelOptions) {
                try {
                    console.log(`🔄 Attempting to load model: ${model}`);
                    this.recognizer = await pipeline('automatic-speech-recognition', model, {
                        quantized: false,
                        progress_callback: (progress) => {
                            if (progress.status === 'progress') {
                                console.log(`📥 Downloading ${model}: ${Math.round(progress.progress * 100)}%`);
                                // Send progress to UI if callback is set
                                if (this.transcriptionCallback) {
                                    this.transcriptionCallback({ 
                                        type: 'download-progress',
                                        model: model,
                                        progress: Math.round(progress.progress * 100)
                                    });
                                }
                            }
                        }
                    });
                    console.log(`✅ Successfully loaded model: ${model}`);
                    modelLoaded = true;
                    break;
                } catch (error) {
                    console.log(`❌ Failed to load ${model}:`, error.message);
                    continue;
                }
            }
            
            if (!modelLoaded) {
                throw new Error('❌ Failed to load any Whisper model');
            }
            
            this.isInitialized = true;
            console.log('✅ SystemAudioService initialized successfully');
            return { success: true, message: 'Whisper model loaded successfully' };
            
        } catch (error) {
            console.error('❌ Failed to initialize SystemAudioService:', error);
            throw error;
        }
    }

    setTranscriptionCallback(callback) {
        this.transcriptionCallback = callback;
    }

    async startContinuousTranscription() {
        if (this.isTranscribing) {
            console.log('⚠️ Transcription already running');
            return;
        }

        if (!this.isInitialized) {
            console.log('🔄 Initializing transcription service...');
            await this.initTranscription();
        }

        console.log('🎬 Starting continuous transcription...');
        this.isTranscribing = true;
        this.audioChunks = [];

        await this.startAudioCapture();
    }

    async startAudioCapture() {
        try {
            // Check if we're in main process or renderer process
            if (typeof window !== 'undefined') {
                // Renderer process - use Web APIs
                await this.startWebAudioCapture();
            } else {
                // Main process - request from renderer
                console.log('🔄 Requesting audio capture from renderer process...');
                // This will be handled by IPC calls to the renderer
            }
        } catch (error) {
            console.error('❌ Failed to start audio capture:', error);
            this.isTranscribing = false;
            throw error;
        }
    }

    async startWebAudioCapture() {
        try {
            console.log('🎙️ Starting web audio capture...');
            
            // Request microphone access (this will capture system audio if configured properly)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: this.sampleRate,
                    sampleSize: 16,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            // Create media recorder for chunks
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.isTranscribing) {
                    this.audioChunks.push(event.data);
                    this.processAudioBlob(event.data);
                }
            };

            this.mediaRecorder.onerror = (error) => {
                console.error('❌ MediaRecorder error:', error);
                if (this.transcriptionCallback) {
                    this.transcriptionCallback({ error: error.message });
                }
            };

            // Start recording in chunks
            this.mediaRecorder.start(this.chunkDuration * 1000); // Convert to milliseconds
            console.log('✅ Audio recording started successfully');

        } catch (error) {
            console.error('❌ Failed to start web audio capture:', error);
            if (error.name === 'NotAllowedError') {
                console.log('🔧 Microphone access denied. Please allow microphone access.');
            }
            throw error;
        }
    }

    async processAudioBlob(blob) {
        try {
            // Convert blob to array buffer
            const arrayBuffer = await blob.arrayBuffer();
            
            // Create a simple way to convert webm to PCM (this is simplified)
            // In a real implementation, you might want to use a library like ffmpeg.js
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Extract PCM data
            const pcmData = audioBuffer.getChannelData(0); // Get first channel
            
            console.log(`🔄 Processing audio chunk: ${pcmData.length} samples`);
            
            // Transcribe with Whisper
            const result = await this.recognizer(pcmData);
            const transcription = result.text || '';
            
            if (transcription.trim()) {
                console.log('🎤 Live Transcription:', transcription);
                
                if (this.transcriptionCallback) {
                    this.transcriptionCallback({ 
                        text: transcription,
                        timestamp: new Date().toISOString(),
                        confidence: result.confidence || 0.0
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Transcription error:', error);
            if (this.transcriptionCallback) {
                this.transcriptionCallback({ error: error.message });
            }
        }
    }

    stopContinuousTranscription() {
        if (!this.isTranscribing) {
            console.log('⚠️ Transcription not running');
            return;
        }

        console.log('🛑 Stopping continuous transcription...');
        this.isTranscribing = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try {
                this.mediaRecorder.stop();
                console.log('✅ MediaRecorder stopped');
            } catch (error) {
                console.error('❌ Error stopping MediaRecorder:', error);
            }
        }
        
        if (this.audioContext) {
            try {
                this.audioContext.close();
                this.audioContext = null;
                console.log('✅ AudioContext closed');
            } catch (error) {
                console.error('❌ Error closing AudioContext:', error);
            }
        }
        
        // Clear audio chunks
        this.audioChunks = [];
    }

    getStatus() {
        return {
            isTranscribing: this.isTranscribing,
            isInitialized: this.isInitialized,
            hasRecognizer: !!this.recognizer,
            audioChunksCount: this.audioChunks.length,
            sampleRate: this.sampleRate,
            chunkDuration: this.chunkDuration
        };
    }

    // Test transcription functionality
    async testTranscription() {
        try {
            if (!this.isInitialized) {
                await this.initTranscription();
            }

            console.log('🧪 Testing transcription initialization...');
            return { 
                success: true, 
                message: 'Transcription service ready',
                status: this.getStatus()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Helper method to setup IPC handlers for renderer communication
    setupIPCHandlers() {
        // Handle start transcription from renderer
        ipcMain.handle('system-audio-start', async () => {
            try {
                await this.startContinuousTranscription();
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // Handle stop transcription from renderer
        ipcMain.handle('system-audio-stop', () => {
            this.stopContinuousTranscription();
            return { success: true };
        });

        // Handle get status from renderer
        ipcMain.handle('system-audio-status', () => {
            return this.getStatus();
        });

        console.log('✅ SystemAudioService IPC handlers registered');
    }
}

module.exports = SystemAudioService;
