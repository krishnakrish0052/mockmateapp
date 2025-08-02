/**
 * AudioCaptureRenderer - Browser-based audio capture service
 * This runs in the renderer process where we have access to navigator.mediaDevices
 */

class AudioCaptureRenderer {
    constructor() {
        this.mediaRecorder = null;
        this.isCapturing = false;
        this.audioChunks = [];
        this.stream = null;
        this.sttApiEndpoint = 'https://text.pollinations.ai/openai';
        this.chunkDurationMs = 3000; // Process chunks every 3 seconds
        this.recordingInterval = null;
        this.onTranscriptionCallback = null;
        this.audioContext = null;
        this.workletNode = null;
        this.logCount = 0;
        
        this.log('AudioCaptureRenderer constructor started');
        this.log('AudioCaptureRenderer: Initialized in renderer process');
    }

    async startCapture(onTranscription) {
        console.log('AudioCaptureRenderer: Starting audio capture...');
        
        if (this.isCapturing) {
            return { success: false, message: 'Already capturing' };
        }

        this.onTranscriptionCallback = onTranscription;

        try {
            // Simple approach like soundservice - direct getDisplayMedia call
            let stream;
            try {
                console.log('AudioCaptureRenderer: Requesting media stream with audio...');
                stream = await navigator.mediaDevices.getDisplayMedia({
                    audio: true,
                    video: false
                });
                console.log('AudioCaptureRenderer: Media stream obtained successfully.');
            } catch (error) {
                console.error('AudioCaptureRenderer: Failed to obtain media stream:', error);
                throw error;
            }

            try {
                console.log('AudioCaptureRenderer: Initializing MediaRecorder...');
                this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
                console.log('AudioCaptureRenderer: MediaRecorder initialized successfully.');
            } catch (recorderError) {
                console.error('AudioCaptureRenderer: Failed to initialize MediaRecorder:', recorderError);
                throw recorderError;
            }
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };
            
            this.mediaRecorder.onerror = event => {
                console.error('Recording error:', event.error);
            };
            
            // Start recording with 5-second chunks like soundservice
            this.mediaRecorder.start(5000);
            
            // Process chunks periodically
            this.recordingInterval = setInterval(async () => {
                if (this.audioChunks.length > 0) {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    this.audioChunks = [];
                    
                    // Convert to ArrayBuffer and send to main process via IPC
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    if (window.electronAPI && window.electronAPI.sendAudioData) {
                        await window.electronAPI.sendAudioData(arrayBuffer);
                    }
                }
            }, 5000);
            
            this.isCapturing = true;
            console.log('AudioCaptureRenderer: Audio capture started successfully');
            
            return { success: true, message: 'Audio capture started' };
            
        } catch (error) {
            console.error('AudioCaptureRenderer: Failed to start capture:', error);
            this.isCapturing = false;
            return { success: false, message: error.message };
        }
    }

    setupMediaRecorder() {
        this.log('SETUP MEDIA RECORDER - Starting MediaRecorder setup');
        
        // Check supported mime types - prioritize WebM for system audio
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];
        
        this.log('CHECKING MIME TYPES - Testing supported formats', mimeTypes);
        
        let selectedMimeType = null;
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                this.log('MIME TYPE SELECTED - Using format: ' + mimeType);
                break;
            }
        }

        if (!selectedMimeType) {
            this.log('MIME TYPE ERROR - No supported audio mime type found');
            throw new Error('No supported audio mime type found');
        }

        this.log('CREATING MEDIA RECORDER - With selected mime type and optimized settings');
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: selectedMimeType,
            audioBitsPerSecond: 128000
        });

        // Handle data availability
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.log(`AUDIO CHUNK RECEIVED - Size: ${event.data.size} bytes`);
                this.audioChunks.push(event.data);
                this.log(`AUDIO CHUNKS TOTAL - Now have ${this.audioChunks.length} chunks in buffer`);
            } else {
                this.log('AUDIO CHUNK EMPTY - Received empty or zero-size data');
            }
        };

        // Handle recording stop
        this.mediaRecorder.onstop = () => {
            this.log('MEDIA RECORDER STOPPED - Processing accumulated chunks');
            this.processAudioChunks();
        };

        // Start recording with time slices
        this.log(`STARTING MEDIA RECORDER - With ${this.chunkDurationMs}ms time slices`);
        this.mediaRecorder.start(this.chunkDurationMs);
        this.log('MEDIA RECORDER STATE - ' + this.mediaRecorder.state);

        // Set up interval to process chunks periodically
        this.log('SETTING UP INTERVAL - For periodic chunk processing');
        this.recordingInterval = setInterval(() => {
            if (this.isCapturing && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.log('INTERVAL TICK - Requesting data from MediaRecorder');
                this.mediaRecorder.requestData();
            } else {
                this.log(`INTERVAL TICK - Skipping (capturing: ${this.isCapturing}, state: ${this.mediaRecorder?.state})`);
            }
        }, this.chunkDurationMs);
        
        this.log('MEDIA RECORDER SETUP COMPLETE - Ready for audio capture');
    }

    async processAudioChunks() {
        this.log('PROCESS AUDIO CHUNKS - Entry point');
        
        if (this.audioChunks.length === 0) {
            this.log('NO AUDIO CHUNKS - Buffer is empty, nothing to process');
            return;
        }

        this.log(`PROCESSING CHUNKS - Found ${this.audioChunks.length} audio chunks to process`);
        
        // Combine all chunks into a single blob
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.log(`AUDIO BLOB CREATED - Size: ${audioBlob.size} bytes, Type: audio/webm`);
        
        // Clear chunks for next batch
        const processedChunkCount = this.audioChunks.length;
        this.audioChunks = [];
        this.log(`CHUNKS CLEARED - Processed ${processedChunkCount} chunks, buffer now empty`);

        // Skip processing if blob is too small (likely silence)
        if (audioBlob.size < 1000) {
            this.log(`SKIPPING SMALL CHUNK - Size ${audioBlob.size} bytes is below 1000 byte threshold (likely silence)`);
            return;
        }

        this.log('SENDING TO STT API - Audio blob meets size requirements');
        try {
            await this.sendToSTTAPI(audioBlob);
            this.log('STT API CALL COMPLETE - Processing finished successfully');
        } catch (error) {
            this.log('STT API ERROR - Failed to process audio chunks: ' + error.message);
        }
    }

    async sendToSTTAPI(audioBlob) {
        this.log(`STT API START - Sending audio blob (${audioBlob.size} bytes) to STT API`);
        this.log('STT API ENDPOINT - ' + this.sttApiEndpoint);

        try {
            // Convert audio blob to base64
            this.log('BASE64 CONVERSION - Converting audio blob to base64');
            const base64Audio = await this.blobToBase64(audioBlob);
            this.log(`BASE64 COMPLETE - Converted to base64 string (${base64Audio.length} characters)`);
            
            // Try different formats since Pollinations might be picky about WebM
            const formats = ['wav', 'mp3', 'webm'];
            this.log('FORMAT TESTING - Will try formats in order:', formats);
            let lastError = null;
            
            for (const format of formats) {
                try {
                    this.log(`FORMAT ATTEMPT - Trying format: ${format}`);
                    
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
                                            format: format
                                        }
                                    }
                                ]
                            }
                        ]
                    };

                    this.log(`API REQUEST - Making POST request to ${this.sttApiEndpoint}`);
                    this.log(`REQUEST PAYLOAD - Model: ${payload.model}, Format: ${format}`);
                    
                    const response = await fetch(this.sttApiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    this.log(`API RESPONSE - Status: ${response.status} ${response.statusText}`);

                    if (!response.ok) {
                        const errorText = await response.text();
                        this.log(`API ERROR - Format ${format} failed with status ${response.status}:`, errorText);
                        lastError = new Error(`STT API error (${format}): ${response.status} ${response.statusText}`);
                        continue; // Try next format
                    }

                    this.log('JSON PARSING - Parsing API response');
                    const result = await response.json();
                    this.log('API RESULT - Received response:', result);

                    // Extract transcription from OpenAI-style response
                    const transcriptionText = result.choices?.[0]?.message?.content;
                    this.log(`TRANSCRIPTION EXTRACTION - Text: '${transcriptionText}'`);
                    
                    if (transcriptionText && transcriptionText.trim()) {
                        const transcription = {
                            text: transcriptionText.trim(),
                            confidence: 0.9, // Pollinations doesn't return confidence, use default
                            timestamp: Date.now()
                        };

                        this.log(`STT SUCCESS - Format ${format} worked! Transcription:`, transcription);
                        
                        if (this.onTranscriptionCallback) {
                            this.log('CALLBACK INVOKE - Calling onTranscriptionCallback with result');
                            this.onTranscriptionCallback(transcription);
                            this.log('CALLBACK COMPLETE - Transcription sent to callback');
                        } else {
                            this.log('CALLBACK MISSING - No onTranscriptionCallback set');
                        }
                        return; // Success, exit function
                    } else {
                        this.log(`NO TRANSCRIPTION - Format ${format} returned empty/null text`);
                        lastError = new Error(`No transcription text returned for ${format}`);
                        continue; // Try next format
                    }
                    
                } catch (formatError) {
                    this.log(`FORMAT ERROR - Format ${format} threw exception:`, formatError.message);
                    lastError = formatError;
                    continue; // Try next format
                }
            }
            
            // If we get here, all formats failed
            this.log('ALL FORMATS FAILED - No format worked, throwing error');
            throw lastError || new Error('All audio formats failed');

        } catch (error) {
            this.log('STT API FATAL ERROR - Unhandled error:', error.message);
            
            // Send a simulation for testing while we debug the real API
            if (this.onTranscriptionCallback) {
                this.log('SENDING TEST TRANSCRIPTION - For debugging purposes');
                const testTranscription = {
                    text: `[TEST] Audio captured at ${new Date().toLocaleTimeString()} - Real STT API failed: ${error.message}`,
                    confidence: 0.5,
                    timestamp: Date.now(),
                    error: error.message
                };
                
                this.log('TEST TRANSCRIPTION - Sending fallback test result:', testTranscription);
                this.onTranscriptionCallback(testTranscription);
                this.log('TEST TRANSCRIPTION SENT - Fallback completed');
            } else {
                this.log('NO CALLBACK - Cannot send test transcription, no callback set');
            }
        }
    }

    // Helper method to convert blob to base64
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove the data URL prefix (data:audio/webm;base64,)
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async stopCapture() {
        console.log('AudioCaptureRenderer: Stopping audio capture...');
        
        if (!this.isCapturing) {
            return { success: false, message: 'Not capturing' };
        }

        this.isCapturing = false;

        try {
            // Clear interval
            if (this.recordingInterval) {
                clearInterval(this.recordingInterval);
                this.recordingInterval = null;
            }

            // Stop media recorder
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }

            // Clear remaining chunks
            this.audioChunks = [];
            this.onTranscriptionCallback = null;
            this.mediaRecorder = null;

            console.log('AudioCaptureRenderer: Audio capture stopped');
            return { success: true, message: 'Audio capture stopped' };

        } catch (error) {
            console.error('AudioCaptureRenderer: Error stopping audio capture:', error);
            return { success: false, message: error.message };
        }
    }

    getStatus() {
        return {
            isCapturing: this.isCapturing,
            hasStream: !!this.stream,
            hasMediaRecorder: !!this.mediaRecorder,
            mediaRecorderState: this.mediaRecorder?.state || 'inactive',
            audioChunksCount: this.audioChunks.length,
            hasCallback: !!this.onTranscriptionCallback
        };
    }
    
    log(message, data = null) {
        this.logCount++;
        const timestamp = new Date().toISOString();
        const formattedMessage = `[AUDIO-${this.logCount.toString().padStart(3, '0')}] [${timestamp}] ${message}`;
        
        if (data) {
            console.log(formattedMessage, data);
        } else {
            console.log(formattedMessage);
        }
    }
}

// Export for use in renderer
window.AudioCaptureRenderer = AudioCaptureRenderer;
