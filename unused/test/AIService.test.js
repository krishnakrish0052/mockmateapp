const AIService = require('../src/services/AIService');

describe('AIService', () => {
    it('should return a response from the API', async () => {
        const aiService = new AIService();
        const response = await aiService.generateResponse({
            question: 'What is the capital of France?'
        });
        expect(response.response).toBe('Paris');
    });
});