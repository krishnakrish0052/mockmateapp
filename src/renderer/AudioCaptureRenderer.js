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
        this.log('STARTING AUDIO CAPTURE - Entry point');
        
        if (this.isCapturing) {
            this.log('ALREADY CAPTURING - Returning false');
            return { success: false, message: 'Already capturing' };
        }

        this.onTranscriptionCallback = onTranscription;
        this.log('CALLBACK SET - onTranscription callback registered');

        try {
            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Screen capture with audio is not supported in this browser');
            }

            this.log('MEDIA DEVICES SUPPORTED - Requesting display media with system audio');
            
            // Use system audio loopback approach (similar to soundservice)
            let stream = null;
            
            try {
                this.log('ATTEMPTING SYSTEM AUDIO LOOPBACK - getDisplayMedia with system audio');
                
                // Request display media with system audio loopback
                // The main process should have already set up the display media request handler
                stream = await navigator.mediaDevices.getDisplayMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        sampleRate: 44100,
                        channelCount: 2,
                        autoGainControl: false
                    },
                    video: {
                        width: 1,
                        height: 1,
                        frameRate: 1
                    } // Minimal video as placeholder for audio capture
                });
                
                this.log('SYSTEM AUDIO CAPTURE SUCCESS - Stream obtained with loopback');
                
                // Check if we got audio tracks
                const audioTracks = stream.getAudioTracks();
                this.log(`AUDIO TRACKS CHECK - Found ${audioTracks.length} audio tracks`);
                
                if (audioTracks.length === 0) {
                    stream.getTracks().forEach(track => track.stop());
                    throw new Error('No system audio tracks available from loopback capture');
                }
                
                this.log('SYSTEM AUDIO TRACKS VALIDATED - Loopback capture has audio');
                
                // Log audio track details
                audioTracks.forEach((track, index) => {
                    this.log(`AUDIO TRACK ${index} - Label: ${track.label}, Kind: ${track.kind}, ReadyState: ${track.readyState}`);
                });
                
            } catch (loopbackError) {
                this.log('SYSTEM AUDIO LOOPBACK FAILED - Error: ' + loopbackError.message);
                throw new Error(`System audio loopback capture failed: ${loopbackError.message}`);
            }
            
            this.stream = stream;
            this.log('STREAM ASSIGNED - Audio stream ready');
            this.log(`STREAM DETAILS - Audio tracks: ${this.stream.getAudioTracks().length}`);

            // Set up MediaRecorder for continuous recording
            this.log('SETTING UP MEDIA RECORDER - Calling setupMediaRecorder()');
            this.setupMediaRecorder();
            
            this.isCapturing = true;
            this.log('AUDIO CAPTURE STARTED - isCapturing = true');
            
            return { success: true, message: 'Audio capture started' };

        } catch (error) {
            this.log('AUDIO CAPTURE FAILED - Error: ' + error.message);
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
            console.log('AudioCaptureRenderer: Not currently capturing');
            return { success: false, message: 'Not capturing' };
        }

        this.isCapturing = false;

        try {
            // Clear interval
            if (this.recordingInterval) {
                clearInterval(this.recordingInterval);
                this.recordingInterval = null;
                console.log('AudioCaptureRenderer: Recording interval cleared');
            }

            // Stop media recorder
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
                console.log('AudioCaptureRenderer: MediaRecorder stopped');
            }

            // Stop all tracks in the stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('AudioCaptureRenderer: Stopped track:', track.kind);
                });
                this.stream = null;
            }

            // Clear remaining chunks
            this.audioChunks = [];
            this.onTranscriptionCallback = null;

            console.log('AudioCaptureRenderer: Audio capture stopped successfully');
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
