
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
            
            // Instead of throwing the error, emit it and return a fallback response
            this.emit('error', error);
            
            // Return a graceful fallback response
            const fallbackResponse = {
                response: "I'm sorry, I couldn't transcribe the audio. Please try typing your question instead.",
                text: "I'm sorry, I couldn't transcribe the audio. Please try typing your question instead.",
                model: 'fallback-speech-service',
                timestamp: new Date().toISOString(),
                confidence: 0,
                error: 'Audio transcription failed'
            };
            
            this.emit('transcription', fallbackResponse);
            return fallbackResponse;
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
