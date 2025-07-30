// AUDIO FUNCTIONALITY COMPLETELY REMOVED
// This is a stub implementation with no audio capabilities

class AudioService {
    constructor() {
        console.log('⚠️ AudioService: All audio functionality has been disabled');
        this.isRecordingMic = false;
        this.isRecordingSystem = false;
    }

    async startMicrophoneRecording(onTranscription) {
        console.log('❌ Microphone functionality has been completely removed');
        throw new Error('Audio functionality disabled');
    }

    async startSystemAudioCapture(onTranscription) {
        console.log('❌ System audio functionality has been completely removed');
        throw new Error('Audio functionality disabled');
    }

    async startFileBasedRecording(source, onTranscription) {
        console.log('❌ File-based recording functionality has been completely removed');
        throw new Error('Audio functionality disabled');
    }

    async startWASAPIMicrophoneRecording(onTranscription) {
        console.log('❌ WASAPI recording functionality has been completely removed');
        throw new Error('Audio functionality disabled');
    }

    async processAccumulatedSpeech(audioBuffers, onTranscription) {
        console.log('❌ Speech processing functionality has been completely removed');
        return;
    }

    async processMicrophoneAudioBuffers(audioBuffers, onTranscription) {
        console.log('❌ Audio buffer processing functionality has been completely removed');
        return;
    }

    async startWindowsSystemAudioCapture(onTranscription) {
        console.log('❌ Windows system audio capture functionality has been completely removed');
        throw new Error('Audio functionality disabled');
    }

    async transcribeAudioBuffer(buffer, onTranscription) {
        console.log('❌ Audio transcription functionality has been completely removed');
        return;
    }

    async transcribeAudioFile(filePath, onTranscription) {
        console.log('❌ Audio file transcription functionality has been completely removed');
        return;
    }

    calculateAudioAmplitude(audioBuffer) {
        return 0;
    }

    createOptimizedWavBuffer(pcmBuffer) {
        return Buffer.alloc(0);
    }

    createWavBuffer(pcmBuffer) {
        return Buffer.alloc(0);
    }

    stopMicrophoneRecording() {
        this.isRecordingMic = false;
        console.log('✅ Microphone recording stopped (was already disabled)');
    }

    stopSystemAudioCapture() {
        this.isRecordingSystem = false;
        console.log('✅ System audio capture stopped (was already disabled)');
    }

    handleWebSpeechResult(transcript) {
        console.log('❌ Web speech functionality has been completely removed');
        return '';
    }

    cleanupTempFiles() {
        console.log('✅ No temp files to cleanup (audio functionality removed)');
    }

    async getAudioDevices() {
        return {
            microphones: [],
            speakers: []
        };
    }
}

module.exports = AudioService;
