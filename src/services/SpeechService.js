
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const AIService = require('./AIService');

class SpeechService extends EventEmitter {
    constructor() {
        super();
        this.aiService = new AIService();
        // Get STT model from environment variable, default to 'openai-audio'
        const sttModel = process.env.STT_MODEL || 'openai-audio';
        console.log(`SpeechService: Using STT model: ${sttModel}`);
        this.aiService.setModel(sttModel);
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
