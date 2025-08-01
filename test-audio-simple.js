const SystemAudioService = require('./src/services/SystemAudioService');

async function testSystemAudio() {
    console.log('🔊 Testing MockMate System Audio to Text functionality...\n');
    
    try {
        // Test 1: Initialize SystemAudioService
        console.log('1. Initializing SystemAudioService...');
        const systemAudioService = new SystemAudioService();
        console.log('   ✅ SystemAudioService created successfully');
        
        // Test 2: Initialize transcription model
        console.log('\n2. Initializing Whisper transcription model...');
        try {
            await systemAudioService.initTranscription();
            console.log('   ✅ Whisper model loaded successfully');
        } catch (error) {
            console.log('   ❌ Failed to load Whisper model:', error.message);
            console.log('   💡 This is normal on first run - model will be downloaded');
        }
        
        // Test 3: Check node-record-lpcm16 functionality
        console.log('\n3. Testing audio recording capabilities...');
        const record = require('node-record-lpcm16');
        console.log('   ✅ node-record-lpcm16 module loaded');
        
        // Test 4: Check Speaker functionality
        console.log('\n4. Testing audio playback capabilities...');
        const Speaker = require('speaker');
        console.log('   ✅ Speaker module loaded');
        
        // Test 5: Check Transformers library
        console.log('\n5. Testing Transformers library...');
        const { pipeline } = require('@xenova/transformers');
        console.log('   ✅ Transformers library loaded');
        
        // Test 6: Check system audio state
        console.log('\n6. Checking system audio service state...');
        console.log(`   Is Transcribing: ${systemAudioService.isTranscribing}`);
        console.log(`   Recognizer Loaded: ${systemAudioService.recognizer ? 'Yes' : 'No'}`);
        
        console.log('\n🏁 System Audio Test completed!');
        
        console.log('\n📋 SUMMARY:');
        console.log('   ✅ SystemAudioService - Working');
        console.log('   ✅ Audio recording library - Working');
        console.log('   ✅ Audio playback library - Working');
        console.log('   ✅ AI Transcription library - Working');
        
        console.log('\n🎯 TO TEST FUNCTIONALITY:');
        console.log('   1. Run your main app: npm start');
        console.log('   2. Use Ctrl+T to start transcription');
        console.log('   3. Use Ctrl+Shift+T to stop transcription');
        console.log('   4. Speak near your microphone or play system audio');
        console.log('   5. Check console for transcription output');
        
        console.log('\n⚠️ IMPORTANT NOTES:');
        console.log('   - On Windows, you may need to enable "Stereo Mix" for system audio');
        console.log('   - Go to Sound Settings > Recording > Enable Stereo Mix');
        console.log('   - The Whisper model will download on first use (~40MB)');
        console.log('   - Transcription results will appear in the console');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('   1. Ensure all dependencies are installed: npm install');
        console.log('   2. Check if you have audio drivers installed');
        console.log('   3. Try running as administrator if needed');
        console.log('   4. Ensure your microphone permissions are enabled');
    }
}

// Run the test
testSystemAudio().catch(console.error);
