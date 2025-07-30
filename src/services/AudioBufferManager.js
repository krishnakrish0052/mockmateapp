const { EventEmitter } = require('events');

class AudioBufferManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.sampleRate = options.sampleRate || 16000;
        this.bufferDurationMs = options.bufferDurationMs || 3000; // 3 seconds
        this.silenceThreshold = options.silenceThreshold || 0.01;
        this.minSpeechDurationMs = options.minSpeechDurationMs || 500; // 500ms minimum
        this.maxSilenceDurationMs = options.maxSilenceDurationMs || 1500; // 1.5s of silence triggers send
        
        // State
        this.audioBuffer = [];
        this.lastSpeechTime = 0;
        this.lastSilenceTime = 0;
        this.isSpeechActive = false;
        this.bufferStartTime = 0;
        this.pendingTranscription = false;
        
        console.log('AudioBufferManager initialized with config:', {
            bufferDurationMs: this.bufferDurationMs,
            silenceThreshold: this.silenceThreshold,
            minSpeechDurationMs: this.minSpeechDurationMs,
            maxSilenceDurationMs: this.maxSilenceDurationMs
        });
    }
    
    addAudioChunk(audioData) {
        const now = Date.now();
        
        // Initialize buffer start time if this is the first chunk
        if (this.audioBuffer.length === 0) {
            this.bufferStartTime = now;
        }
        
        // Add audio data to buffer
        this.audioBuffer = this.audioBuffer.concat(audioData);
        
        // Calculate RMS (Root Mean Square) for volume detection
        const rms = this.calculateRMS(audioData);
        const isSpeech = rms > this.silenceThreshold;
        
        if (isSpeech) {
            this.lastSpeechTime = now;
            if (!this.isSpeechActive) {
                this.isSpeechActive = true;
                console.log('Speech detected, starting buffer...');
                this.emit('speech-start');
            }
        } else {
            this.lastSilenceTime = now;
        }
        
        // Emit real-time audio level for debugging
        this.emit('audio-level', { rms, timestamp: now, isSpeech });
        
        // Check if we should send the buffer for transcription
        this.checkSendConditions(now);
    }
    
    checkSendConditions(now) {
        const bufferDuration = now - this.bufferStartTime;
        const timeSinceLastSpeech = now - this.lastSpeechTime;
        const speechDuration = this.lastSpeechTime - this.bufferStartTime;
        
        let shouldSend = false;
        let reason = '';
        
        // Condition 1: Buffer is getting too long (max duration reached)
        if (bufferDuration >= this.bufferDurationMs) {
            shouldSend = true;
            reason = `max duration reached (${bufferDuration}ms)`;
        }
        
        // Condition 2: Silence after speech (end of sentence/phrase)
        else if (this.isSpeechActive && 
                 timeSinceLastSpeech >= this.maxSilenceDurationMs && 
                 speechDuration >= this.minSpeechDurationMs) {
            shouldSend = true;
            reason = `silence after speech (${timeSinceLastSpeech}ms silence, ${speechDuration}ms speech)`;
        }
        
        // Send buffer if conditions are met and we're not already processing
        if (shouldSend && this.audioBuffer.length > 0 && !this.pendingTranscription) {
            this.sendBufferForTranscription(reason);
        }
    }
    
    sendBufferForTranscription(reason) {
        if (this.audioBuffer.length === 0 || this.pendingTranscription) {
            return;
        }
        
        console.log(`Sending audio buffer for transcription: ${reason}`);
        console.log(`Buffer stats: ${this.audioBuffer.length} samples, ${(this.audioBuffer.length / this.sampleRate * 1000).toFixed(0)}ms duration`);
        
        // Convert to WAV format
        const wavBuffer = this.createWavBuffer(this.audioBuffer);
        
        // Set pending flag to prevent multiple simultaneous transcriptions
        this.pendingTranscription = true;
        
        // Emit transcription request
        this.emit('transcription-request', {
            audioBuffer: wavBuffer,
            metadata: {
                sampleCount: this.audioBuffer.length,
                durationMs: (this.audioBuffer.length / this.sampleRate * 1000),
                reason: reason,
                timestamp: Date.now()
            }
        });
        
        // Clear buffer and reset state
        this.clearBuffer();
    }
    
    clearBuffer() {
        this.audioBuffer = [];
        this.isSpeechActive = false;
        this.bufferStartTime = 0;
        this.lastSpeechTime = 0;
        this.lastSilenceTime = 0;
    }
    
    onTranscriptionComplete() {
        // Reset the pending flag when transcription is done
        this.pendingTranscription = false;
        console.log('Transcription completed, ready for next buffer');
    }
    
    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }
    
    createWavBuffer(pcmData) {
        const length = pcmData.length;
        const buffer = Buffer.alloc(44 + length * 2);
        
        // WAV header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + length * 2, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20);
        buffer.writeUInt16LE(1, 22);
        buffer.writeUInt32LE(this.sampleRate, 24);
        buffer.writeUInt32LE(this.sampleRate * 2, 28);
        buffer.writeUInt16LE(2, 32);
        buffer.writeUInt16LE(16, 34);
        buffer.write('data', 36);
        buffer.writeUInt32LE(length * 2, 40);
        
        // Convert float samples to 16-bit PCM
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, pcmData[i]));
            buffer.writeInt16LE(sample * 0x7FFF, 44 + i * 2);
        }
        
        return buffer;
    }
    
    // Force send current buffer (useful for manual triggering)
    forceFlush() {
        if (this.audioBuffer.length > 0) {
            this.sendBufferForTranscription('manual flush');
        }
    }
    
    // Get current buffer status
    getStatus() {
        const now = Date.now();
        return {
            bufferLength: this.audioBuffer.length,
            bufferDurationMs: this.bufferStartTime ? now - this.bufferStartTime : 0,
            isSpeechActive: this.isSpeechActive,
            timeSinceLastSpeech: this.lastSpeechTime ? now - this.lastSpeechTime : 0,
            pendingTranscription: this.pendingTranscription
        };
    }
}

module.exports = AudioBufferManager;
