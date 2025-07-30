
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const AIService = require('./AIService');

class SpeechService extends EventEmitter {
    constructor() {
        super();
        this.aiService = new AIService();
        this.aiService.setModel('openai-audio');
    }

    async transcribe(audioData) {
        try {
            const transcription = await this.aiService.transcribeAudio(audioData);
            this.emit('transcription', transcription);
            return transcription;
        } catch (error) {
            console.error('Error during transcription:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async transcribeFile(filePath) {
        try {
            const audioData = fs.readFileSync(filePath);
            return await this.transcribe(audioData);
        } catch (error) {
            console.error(`Error reading file for transcription: ${filePath}`, error);
            this.emit('error', error);
            throw error;
        }
    }
}

module.exports = SpeechService;
