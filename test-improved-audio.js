const SystemAudioService = require('./src/services/SystemAudioService');

async function testImprovedSystemAudio() {
    console.log('🎵 Testing Improved MockMate System Audio to Text functionality...\n');
    
    try {
        // Test 1: Initialize SystemAudioService
        console.log('1. Creating SystemAudioService instance...');
        const systemAudioService = new SystemAudioService();
        console.log('   ✅ SystemAudioService created successfully');
        console.log('   Initial Status:', systemAudioService.getStatus());
        
        // Test 2: Initialize transcription model
        console.log('\n2. Initializing Whisper transcription model...');
        try {
            await systemAudioService.initTranscription();
            console.log('   ✅ Whisper model loaded successfully');
            console.log('   Updated Status:', systemAudioService.getStatus());
        } catch (error) {
            console.log('   ❌ Failed to load Whisper model:', error.message);
            console.log('   💡 This might be due to network issues or model downloading');
            console.log('   💡 The model will be downloaded on first use (~40-150MB)');
        }
        
        // Test 3: Test transcription initialization
        console.log('\n3. Testing transcription service...');
        const testResult = await systemAudioService.testTranscription();
        console.log('   Test Result:', testResult);
        
        // Test 4: Set up transcription callback
        console.log('\n4. Setting up transcription callback...');
        systemAudioService.setTranscriptionCallback((result) => {
            if (result.error) {
                console.log('   ❌ Transcription Error:', result.error);
            } else {
                console.log('   🎤 Live Transcription:', result.text);
                console.log('   📅 Timestamp:', result.timestamp);
            }
        });
        console.log('   ✅ Transcription callback set up');
        
        // Test 5: Check recording capabilities (don't actually start)
        console.log('\n5. Checking audio recording capabilities...');
        try {
            const record = require('node-record-lpcm16');
            console.log('   ✅ node-record-lpcm16 available');
            
            // Check if SOX is available (needed for Windows audio recording)
            const { exec } = require('child_process');
            exec('sox --version', (error, stdout, stderr) => {
                if (error) {
                    console.log('   ⚠️  SOX not found - you may need to install it for audio recording');
                    console.log('   💡 Download SOX from: http://sox.sourceforge.net/');
                } else {
                    console.log('   ✅ SOX available:', stdout.split('\\n')[0]);
                }
            });
        } catch (error) {
            console.log('   ❌ Audio recording library error:', error.message);
        }
        
        console.log('\\n🏁 Improved System Audio Test completed!');
        
        console.log('\\n📋 FUNCTIONALITY SUMMARY:');
        const status = systemAudioService.getStatus();
        console.log(`   SystemAudioService Initialized: ${status.isInitialized ? '✅' : '❌'}`);
        console.log(`   Whisper Model Loaded: ${status.hasRecognizer ? '✅' : '❌'}`);
        console.log(`   Currently Transcribing: ${status.isTranscribing ? '🔴 Yes' : '⚫ No'}`);
        console.log(`   Audio Buffer Size: ${status.bufferSize} chunks`);
        
        console.log('\\n🎯 HOW TO USE IN YOUR APP:');
        console.log('   1. Start your main app: npm start');
        console.log('   2. Press Ctrl+T to start live transcription');
        console.log('   3. Speak into your microphone or play audio');
        console.log('   4. Watch the console for transcriptions');
        console.log('   5. Press Ctrl+Shift+T to stop transcription');
        
        console.log('\\n⚙️  INTEGRATION NOTES:');
        console.log('   • The improved service uses chunked processing (3-second chunks)');
        console.log('   • Transcriptions are delivered via callback functions');
        console.log('   • Multiple Whisper models are tried (tiny, small, base)');
        console.log('   • Better error handling and status reporting');
        console.log('   • Audio buffer management for real-time processing');
        
        console.log('\\n🔧 WINDOWS SETUP REQUIREMENTS:');
        console.log('   • Install SOX: http://sox.sourceforge.net/');
        console.log('   • Enable "Stereo Mix" in Sound Settings for system audio');
        console.log('   • Ensure microphone permissions are granted');
        console.log('   • Run as administrator if needed for audio access');
        
        console.log('\\n🌐 MODEL DOWNLOAD:');
        console.log('   • Models are downloaded from Hugging Face automatically');
        console.log('   • whisper-tiny: ~40MB (fastest, lower accuracy)');
        console.log('   • whisper-small: ~150MB (balanced speed/accuracy)');
        console.log('   • whisper-base: ~300MB (slower, higher accuracy)');
        
        // Test 6: Demonstrate start/stop (without actually recording)
        console.log('\\n6. Demonstrating start/stop functionality...');
        console.log('   (Not actually starting recording in test mode)');
        console.log('   Status before start:', systemAudioService.getStatus());
        
        // Simulate what would happen
        if (systemAudioService.getStatus().isInitialized) {
            console.log('   ✅ Service is ready for live transcription');
            console.log('   📝 To test live: uncomment the actual start/stop calls in this script');
        } else {
            console.log('   ⚠️  Service needs initialization before live transcription');
        }
        
    } catch (error) {
        console.error('\\n❌ Test failed:', error);
        console.log('\\n🔧 TROUBLESHOOTING:');
        console.log('   1. Ensure all dependencies: npm install');
        console.log('   2. Check internet connection (for model download)');
        console.log('   3. Install SOX for Windows audio recording');
        console.log('   4. Enable microphone permissions');
        console.log('   5. Try running as administrator if needed');
        console.log('   6. Check antivirus isn\'t blocking model downloads');
    }
}

// Uncomment the lines below to test actual live transcription
// WARNING: This will start actual audio recording
async function testLiveTranscription() {
    console.log('\\n🔴 TESTING LIVE TRANSCRIPTION (5 seconds)...');
    
    const systemAudioService = new SystemAudioService();
    
    systemAudioService.setTranscriptionCallback((result) => {
        if (result.error) {
            console.log('❌ Error:', result.error);
        } else {
            console.log('🎤 LIVE:', result.text);
        }
    });
    
    try {
        await systemAudioService.startContinuousTranscription();
        console.log('Recording for 5 seconds... speak now!');
        
        setTimeout(() => {
            systemAudioService.stopContinuousTranscription();
            console.log('Recording stopped.');
            process.exit(0);
        }, 5000);
        
    } catch (error) {
        console.error('Live test failed:', error);
        process.exit(1);
    }
}

// Run the main test
testImprovedSystemAudio().catch(console.error);

// Uncomment the line below to test live transcription
// testLiveTranscription().catch(console.error);
