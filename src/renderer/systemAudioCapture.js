// System Audio Capture for Renderer Process
class SystemAudioCapture {
    constructor() {
        this.isCapturing = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.stream = null;
        this.onTranscriptionCallback = null;
    }

    setTranscriptionCallback(callback) {
        this.onTranscriptionCallback = callback;
    }

    async startSystemAudioCapture() {
        if (this.isCapturing) {
            console.log('⚠️ System audio capture already running');
            return;
        }

        try {
            console.log('🎵 Starting system audio capture...');
            
            // Request system audio capture via desktopCapturer
            const sources = await window.electronAPI.getDesktopSources(['audio']);
            
            if (sources.length === 0) {
                throw new Error('No audio sources available');
            }

            // Try to get system audio (loopback)
            let selectedSource = sources.find(source => 
                source.name.toLowerCase().includes('system') ||
                source.name.toLowerCase().includes('loopback') ||
                source.name.toLowerCase().includes('stereo mix') ||
                source.name.toLowerCase().includes('what u hear')
            ) || sources[0];

            console.log('🔊 Selected audio source:', selectedSource.name);

            // Request audio stream with the selected source
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id
                    }
                },
                video: false
            });

            // Create audio context for processing
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // Create MediaRecorder for audio chunks
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0 && this.isCapturing) {
                    await this.processAudioChunk(event.data);
                }
            };

            this.mediaRecorder.onerror = (error) => {
                console.error('❌ MediaRecorder error:', error);
            };

            // Start recording in 3-second chunks
            this.mediaRecorder.start(3000);
            this.isCapturing = true;
            
            console.log('✅ System audio capture started');
            return { success: true, source: selectedSource.name };

        } catch (error) {
            console.error('❌ Failed to start system audio capture:', error);
            
            if (error.name === 'NotAllowedError') {
                console.log('🔧 Audio access denied. Please enable system audio permissions.');
            }
            
            return { success: false, error: error.message };
        }
    }

    async processAudioChunk(blob) {
        try {
            // Convert blob to audio buffer
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Extract PCM data (mono channel)
            const pcmData = audioBuffer.getChannelData(0);
            
            // Send to main process for transcription
            const result = await window.electronAPI.transcribeAudio(pcmData);
            
            if (result.text && result.text.trim()) {
                console.log('🎤 System Audio Transcription:', result.text);
                
                if (this.onTranscriptionCallback) {
                    this.onTranscriptionCallback({
                        text: result.text,
                        timestamp: new Date().toISOString(),
                        source: 'system-audio'
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error processing audio chunk:', error);
        }
    }

    stopSystemAudioCapture() {
        if (!this.isCapturing) {
            console.log('⚠️ System audio capture not running');
            return;
        }

        console.log('🛑 Stopping system audio capture...');
        this.isCapturing = false;

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('✅ System audio capture stopped');
    }

    getStatus() {
        return {
            isCapturing: this.isCapturing,
            hasStream: !!this.stream,
            hasMediaRecorder: !!this.mediaRecorder,
            hasAudioContext: !!this.audioContext
        };
    }
}

// Export for use in main renderer
window.systemAudioCapture = new SystemAudioCapture();
