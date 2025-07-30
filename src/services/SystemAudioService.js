const { EventEmitter } = require('events');

class SystemAudioService extends EventEmitter {
    constructor() {
        super();
        this.isRecording = false;
        this.controlWindow = null; // Will be set by main process
    }

    setControlWindow(controlWindow) {
        this.controlWindow = controlWindow;
    }

    async startSystemAudioCapture() {
        if (this.isRecording) {
            console.log('System audio capture is already in progress.');
            return;
        }

        console.log('Starting system audio capture using desktopCapturer...');

        try {
            // Send message to renderer to start audio capture
            if (this.controlWindow && this.controlWindow.webContents) {
                this.controlWindow.webContents.send('start-system-audio-capture');
                this.isRecording = true;
                this.emit('start');
            } else {
                throw new Error('Control window not available for audio capture');
            }
        } catch (error) {
            console.error('Failed to start system audio capture:', error);
            this.emit('error', error);
            throw error;
        }
    }

    stopSystemAudioCapture() {
        if (!this.isRecording) {
            console.log('System audio capture is not running.');
            return;
        }

        console.log('Stopping system audio capture...');
        
        // Send message to renderer to stop audio capture
        if (this.controlWindow && this.controlWindow.webContents) {
            this.controlWindow.webContents.send('stop-system-audio-capture');
        }
        
        this.isRecording = false;
        this.emit('stop');
    }

    // Called from main process when audio data is received from renderer
    handleAudioData(audioData) {
        this.emit('data', audioData);
    }

    // Called from main process when audio capture encounters an error
    handleAudioError(error) {
        this.isRecording = false;
        this.emit('error', error);
    }

    getStatus() {
        return {
            isRecording: this.isRecording
        };
    }
}

module.exports = SystemAudioService;
