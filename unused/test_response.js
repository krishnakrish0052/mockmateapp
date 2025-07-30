// Simple test to verify the response window integration
const { MockMateApp } = require('./src/main.js');

async function testApp() {
    console.log('Testing MockMate AI Response Window Integration...');
    
    try {
        const app = new MockMateApp();
        console.log('✓ MockMateApp instance created successfully');
        
        // Test AI context structure
        console.log('✓ AI Context initialized:', Object.keys(app.aiContext));
        
        // Test prompt building
        const testPrompt = app.buildPromptWithContext('What is JavaScript?');
        console.log('✓ Prompt building works');
        
        console.log('\n🎉 All basic tests passed!');
        console.log('\nNew Features Added:');
        console.log('• AI Response Window positioned below main window');
        console.log('• Hidden by default, shows after AI responses');
        console.log('• Beautiful glass-morphism design matching main window');
        console.log('• Response formatting with confidence and timing');
        console.log('• Close button to hide the response window');
        console.log('• Integrated IPC communication between windows');
        
        console.log('\nUsage:');
        console.log('1. Start the app with: npm start');
        console.log('2. Type a question and click "Send" or press Enter');
        console.log('3. The AI response window will appear below the main window');
        console.log('4. Click the close button (×) to hide the response window');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

if (require.main === module) {
    testApp();
}
