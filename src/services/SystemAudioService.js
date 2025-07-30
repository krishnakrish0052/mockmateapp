const { EventEmitter } = require('events');
const { desktopCapturer } = require('electron');

class SystemAudioService extends EventEmitter {
    constructor() {
        super();
        this.isRecording = false;
        this.controlWindow = null;
    }

    setControlWindow(controlWindow) {
        this.controlWindow = controlWindow;
    }

    async startSystemAudioCapture() {
        if (this.isRecording) {
            console.log('System audio capture is already in progress.');
            return;
        }

        console.log('Main: Starting system audio capture...');
        try {
            if (!this.controlWindow || !this.controlWindow.webContents) {
                throw new Error('Control window is not available to start audio capture.');
            }

            const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
            
            // Find the "Entire screen" source, which is required for system audio on some platforms
            let screenSource = sources.find(source => source.name === 'Entire Screen' || source.name === 'Screen 1');

            if (!screenSource) {
                // Fallback for when "Entire Screen" is not found
                if(sources.length > 0) {
                    console.log("Could not find 'Entire Screen' source, using the first available screen source as a fallback.");
                    screenSource = sources[0];
                } else {
                     throw new Error('No screen sources found for system audio capture.');
                }
            }

            console.log(`Main: Found screen source: ${screenSource.name} (${screenSource.id})`);
            
            // Send the source ID to the renderer process, which will handle the stream
            this.controlWindow.webContents.send('start-system-audio-capture', screenSource.id);
            this.isRecording = true;
            this.emit('start');

        } catch (error) {
            console.error('Main: Failed to start system audio capture:', error);
            this.emit('error', error);
        }
    }

    stopSystemAudioCapture() {
        if (!this.isRecording) {
            console.log('Main: System audio capture is not running.');
            return;
        }
        console.log('Main: Stopping system audio capture...');
        if (this.controlWindow && this.controlWindow.webContents) {
            this.controlWindow.webContents.send('stop-system-audio-capture');
        }
        this.isRecording = false;
        this.emit('stop');
    }

    handleAudioData(audioData) {
        // Forward data from renderer to any listeners (e.g., speech-to-text)
        this.emit('data', audioData);
    }

    handleAudioError(error) {
        console.error('Main: Received audio error from renderer:', error);
        this.isRecording = false;
        this.emit('error', error);
    }

    getStatus() {
        return {
            isRecording: this.isRecording,
        };
    }
}

module.exports = SystemAudioService;
