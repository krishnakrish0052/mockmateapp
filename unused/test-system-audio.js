const SystemAudioService = require('./src/services/SystemAudioService');
const SpeechService = require('./src/services/SpeechService');

async function testSystemAudio() {
    console.log('🔊 Testing System Audio functionality...\n');
    
    // Test 1: Initialize SystemAudioService
    console.log('1. Initializing SystemAudioService...');
    const systemAudioService = new SystemAudioService();
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Check FFmpeg availability
    console.log('\n2. Checking FFmpeg availability...');
    const status = systemAudioService.getStatus();
    console.log(`   FFmpeg available: ${status.ffmpegAvailable ? '✅' : '❌'}`);
    console.log(`   Selected device: ${status.selectedDevice ? status.selectedDevice.name : 'None'}`);
    console.log(`   Audio devices found: ${status.audioDevices.length}`);
    
    if (status.audioDevices.length > 0) {
        console.log('\n   Available audio devices:');
        status.audioDevices.forEach((device, index) => {
            console.log(`     ${index + 1}. ${device.name} ${device.isSystem ? '(System Audio)' : '(Microphone)'} [Priority: ${device.priority}]`);
        });
    }
    
    // Test 3: Check Speech Service
    console.log('\n3. Checking Speech Service...');
    const speechService = new SpeechService();
    const speechHealth = await speechService.healthCheck();
    console.log('   Speech providers:');
    Object.entries(speechHealth.providers).forEach(([provider, available]) => {
        console.log(`     ${provider}: ${available ? '✅' : '❌'}`);
    });
    console.log(`   Preferred provider: ${speechHealth.preferredProvider}`);
    
    // Test 4: Check environment variables
    console.log('\n4. Checking Speech API environment variables...');
    console.log(`   AZURE_SPEECH_KEY: ${process.env.AZURE_SPEECH_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AZURE_REGION: ${process.env.AZURE_REGION ? '✅ Set' : '❌ Not set'}`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Not set'}`);
    
    // Test 5: Test system audio device detection
    console.log('\n5. Testing system audio device detection...');
    const systemDevices = status.audioDevices.filter(device => device.isSystem);
    if (systemDevices.length > 0) {
        console.log(`   ✅ Found ${systemDevices.length} system audio device(s):`);
        systemDevices.forEach(device => {
            console.log(`     - ${device.name} (Priority: ${device.priority})`);
        });
    } else {
        console.log('   ❌ No system audio devices found');
        console.log('   💡 To fix this:');
        console.log('     1. Enable "Stereo Mix" in Windows Sound settings');
        console.log('     2. Go to Sound > Recording tab > Right-click > Show Disabled Devices');
        console.log('     3. Enable "Stereo Mix" or "What U Hear"');
    }
    
    if (!status.ffmpegAvailable) {
        console.log('\n❌ FFmpeg is not available. System audio capture cannot work.');
        console.log('💡 Solutions:');
        console.log('  1. Install FFmpeg and add it to your system PATH');
        console.log('  2. Download FFmpeg to the project bin folder');
        console.log('  3. The app will attempt to auto-download FFmpeg on first use');
    }
    
    if (!speechHealth.providers.azure && !speechHealth.providers.openai) {
        console.log('\n⚠️ No cloud speech recognition services configured.');
        console.log('💡 For better transcription accuracy, configure:');
        console.log('  - Azure Speech Services (recommended)');
        console.log('  - OpenAI Whisper API');
    }
    
    // Test 6: Quick audio settings test
    console.log('\n6. Testing audio configuration...');
    console.log('   Audio settings:', JSON.stringify(status.settings, null, 2));
    console.log(`   Recording chunk duration: ${status.chunkDuration} seconds`);
    
    // Test 7: Attempt to detect Stereo Mix specifically
    console.log('\n7. Looking for Stereo Mix specifically...');
    const stereoMixDevices = status.audioDevices.filter(device => 
        device.name.toLowerCase().includes('stereo mix') ||
        device.name.toLowerCase().includes('what u hear') ||
        device.name.toLowerCase().includes('wave out mix')
    );
    
    if (stereoMixDevices.length > 0) {
        console.log('   ✅ Found Stereo Mix type devices:');
        stereoMixDevices.forEach(device => {
            console.log(`     - ${device.name}`);
        });
    } else {
        console.log('   ❌ No Stereo Mix devices found');
        console.log('   💡 This is the most common issue with system audio capture');
    }
    
    console.log('\n🏁 System Audio test completed!');
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   FFmpeg: ${status.ffmpegAvailable ? '✅ Working' : '❌ Missing'}`);
    console.log(`   System Audio Devices: ${systemDevices.length > 0 ? '✅ Found' : '❌ None'}`);
    console.log(`   Speech Recognition: ${speechHealth.providers.azure || speechHealth.providers.openai ? '✅ Configured' : '⚠️ Web API only'}`);
    
    if (status.ffmpegAvailable && systemDevices.length > 0 && (speechHealth.providers.azure || speechHealth.providers.openai)) {
        console.log('\n🎉 System audio capture should work perfectly!');
    } else if (status.ffmpegAvailable && systemDevices.length > 0) {
        console.log('\n⚠️ System audio capture will work but may have lower transcription accuracy (Web Speech API only)');
    } else {
        console.log('\n❌ System audio capture needs configuration to work properly');
    }
}

// Run the test
testSystemAudio().catch(console.error);
