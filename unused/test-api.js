// Enhanced Test script for Pollination API integration
require('dotenv').config();
const axios = require('axios');

async function testPollinationAPI() {
    console.log('🧪 Testing Enhanced Pollination API Integration...\n');
    
    // Check if API key is loaded
    if (!process.env.POLLINATION_API_KEY) {
        console.error('❌ API Key not found in environment variables');
        console.log('Please ensure .env file contains: POLLINATION_API_KEY=your_key_here');
        return;
    }
    
    console.log('✅ API Key loaded:', process.env.POLLINATION_API_KEY.substring(0, 8) + '...');
    
    // Test current working models (anonymous tier compatible)
    const models = ['openai', 'mistral', 'qwen-coder', 'phi', 'llamascout'];
    
    for (const model of models) {
        console.log(`\n🔄 Testing ${model} with OpenAI-compatible endpoint...`);
        
        try {
            const response = await axios.post('https://text.pollinations.ai/openai', {
                model: model,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful interview assistant. Provide concise answers."
                    },
                    {
                        role: "user", 
                        content: "What is the time complexity of binary search? Keep it under 50 words."
                    }
                ],
                temperature: 0.7,
                seed: 42,
                private: true
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.POLLINATION_API_KEY}`,
                    'User-Agent': 'MockMate-AI-Test/1.0.4'
                },
                timeout: 15000
            });
            
            console.log(`✅ ${model} Response:`, response.status);
            
            // Parse response
            let content = '';
            if (typeof response.data === 'string') {
                content = response.data;
            } else if (response.data.choices && response.data.choices[0]) {
                content = response.data.choices[0].message?.content || response.data.choices[0].text;
            } else if (response.data.content) {
                content = response.data.content;
            } else {
                content = JSON.stringify(response.data);
            }
            
            console.log(`📝 Content Preview: ${content.substring(0, 100)}...`);
            
        } catch (error) {
            console.error(`❌ ${model} Failed:`, error.response?.status, error.response?.statusText);
            if (error.response?.data) {
                console.error('Error details:', error.response.data);
            }
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🏁 API Test Complete!');
}

// Test context building
function testContextService() {
    console.log('\n🧪 Testing Context Service...\n');
    
    const ContextService = require('./src/services/ContextService');
    const contextService = new ContextService();
    
    // Test context building
    const sampleQuestion = "How do you handle state management in React?";
    const contextPrompt = contextService.buildContextForAI(sampleQuestion);
    
    console.log('📋 Generated Context Prompt:');
    console.log(contextPrompt);
    console.log('\n✅ Context Service working correctly');
}

// Test AI Service
async function testAIService() {
    console.log('\n🧪 Testing AI Service...\n');
    
    const AIService = require('./src/services/AIService');
    const aiService = new AIService();
    
    try {
        const context = {
            company: "Google",
            jobDescription: "Software Engineer position requiring React and Node.js experience",
            question: "What is the difference between useState and useEffect in React?"
        };
        
        console.log('🔄 Generating AI response...');
        const response = await aiService.generateResponse(context);
        
        console.log('✅ AI Service Response:');
        console.log('Model:', response.model);
        console.log('Confidence:', response.confidence + '%');
        console.log('Content Preview:', response.content.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('❌ AI Service Error:', error.message);
    }
}

// Test Enhanced AI Service Features
async function testEnhancedAIFeatures() {
    console.log('\n🧪 Testing Enhanced AI Features...\n');
    
    const AIService = require('./src/services/AIService');
    const aiService = new AIService();
    
    // Test 1: Health Check
    console.log('🔄 Testing API Health Check...');
    try {
        const health = await aiService.healthCheck();
        console.log('✅ Health Check:', health.status);
        console.log('Models Available:', health.modelsAvailable);
    } catch (error) {
        console.error('❌ Health Check Failed:', error.message);
    }
    
    // Test 2: Fetch Available Models
    console.log('\n🔄 Testing Dynamic Model Fetching...');
    try {
        const models = await aiService.fetchAvailableModels();
        console.log('✅ Models fetched:', Array.isArray(models) ? models.length : 'N/A');
        if (Array.isArray(models) && models.length > 0) {
            console.log('Sample models:', models.slice(0, 3).map(m => m.name || m).join(', '));
        }
    } catch (error) {
        console.error('❌ Model Fetching Failed:', error.message);
    }
    
    // Test 3: Image Generation
    console.log('\n🔄 Testing Image Generation...');
    try {
        const imageResult = await aiService.generateImage('A professional headshot for LinkedIn');
        console.log('✅ Image Generation URL:', imageResult.url.substring(0, 80) + '...');
    } catch (error) {
        console.error('❌ Image Generation Failed:', error.message);
    }
    
    // Test 4: Text-to-Speech
    console.log('\n🔄 Testing Text-to-Speech...');
    try {
        const speechResult = await aiService.generateSpeech('Hello, this is a test message', 'nova');
        console.log('✅ Speech Generation URL:', speechResult.url.substring(0, 80) + '...');
        console.log('Voice:', speechResult.voice, 'Format:', speechResult.format);
    } catch (error) {
        console.error('❌ Speech Generation Failed:', error.message);
    }
    
    // Test 5: Question Extraction
    console.log('\n🔄 Testing Question Extraction...');
    try {
        const sampleText = "Hi there! Tell me about your experience with React. What frameworks have you used?";
        const extractedQuestion = await aiService.extractQuestion(sampleText);
        console.log('✅ Extracted Question:', extractedQuestion);
    } catch (error) {
        console.error('❌ Question Extraction Failed:', error.message);
    }
}

// Test Image Generation API
async function testImageAPI() {
    console.log('\n🧪 Testing Image Generation API...\n');
    
    const prompts = [
        'A professional software developer workspace',
        'Modern tech company office environment'
    ];
    
    for (const prompt of prompts) {
        console.log(`🔄 Generating image: "${prompt}"...`);
        
        try {
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&model=flux&private=true`;
            console.log('✅ Image URL Generated:', imageUrl.substring(0, 80) + '...');
            
            // Test if image URL is accessible (just check if we get a response)
            const axios = require('axios');
            const response = await axios.head(imageUrl, { timeout: 10000 });
            console.log('✅ Image accessible, Content-Type:', response.headers['content-type']);
            
        } catch (error) {
            console.error(`❌ Image generation failed:`, error.response?.status || error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 MockMate AI - Comprehensive Testing\n');
    console.log('=' .repeat(50));
    
    await testPollinationAPI();
    testContextService();
    await testAIService();
    await testEnhancedAIFeatures();
    await testImageAPI();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests completed!');
    console.log('\nTo run the main application:');
    console.log('npm start');
}

// Execute tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testPollinationAPI,
    testContextService,
    testAIService
};
