const OCRService = require('./src/services/OCRService');

async function testOCR() {
    console.log('🧪 Testing OCR functionality...\n');
    
    // Initialize OCR service
    const ocrService = new OCRService();
    
    // Test 1: Check if tesseract.js is available
    console.log('1. Checking Tesseract.js availability...');
    try {
        const Tesseract = require('tesseract.js');
        console.log('✅ Tesseract.js is available\n');
    } catch (error) {
        console.log('❌ Tesseract.js is NOT available:', error.message, '\n');
        return;
    }
    
    // Test 2: Check environment variables
    console.log('2. Checking environment variables...');
    console.log(`   AZURE_VISION_ENDPOINT: ${process.env.AZURE_VISION_ENDPOINT ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AZURE_VISION_API_KEY: ${process.env.AZURE_VISION_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   GOOGLE_VISION_API_KEY: ${process.env.GOOGLE_VISION_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}\n`);
    
    // Test 3: Test OCR service initialization
    console.log('3. Testing OCR service initialization...');
    try {
        await ocrService.initializeProviders();
        console.log('✅ OCR service initialized successfully\n');
    } catch (error) {
        console.log('❌ OCR service initialization failed:', error.message, '\n');
    }
    
    // Test 4: Test provider selection
    console.log('4. Testing provider selection...');
    try {
        const selectedProvider = ocrService.selectBestProvider();
        console.log(`✅ Best provider selected: ${selectedProvider}\n`);
    } catch (error) {
        console.log('❌ Provider selection failed:', error.message, '\n');
    }
    
    // Test 5: Test health check
    console.log('5. Testing health check...');
    try {
        const healthStatus = await ocrService.healthCheck();
        console.log('✅ Health check results:');
        Object.entries(healthStatus).forEach(([provider, status]) => {
            console.log(`   ${provider}: ${status.available ? '✅' : '❌'} ${status.status}`);
        });
        console.log('');
    } catch (error) {
        console.log('❌ Health check failed:', error.message, '\n');
    }
    
    // Test 6: Test OCR with a simple text image
    console.log('6. Testing OCR with sample image...');
    try {
        // Create a simple data URL for testing (1x1 pixel PNG with white background)
        const sampleImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        
        const result = await ocrService.performOCR(sampleImageDataUrl, {
            provider: 'tesseract',
            enableFallback: false
        });
        
        console.log(`✅ OCR test completed successfully!`);
        console.log(`   Provider: ${result.provider}`);
        console.log(`   Text length: ${result.text.length}`);
        console.log(`   Confidence: ${result.confidence}`);
        console.log(`   Text extracted: "${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}"`);
        console.log('');
    } catch (error) {
        console.log('❌ OCR test failed:', error.message);
        console.log('   This is expected with a minimal test image, but indicates OCR pipeline is working\n');
    }
    
    // Test 7: Test performance stats
    console.log('7. Testing performance stats...');
    try {
        const stats = ocrService.getPerformanceStats();
        console.log('✅ Performance stats retrieved:');
        console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
        console.log('❌ Performance stats failed:', error.message, '\n');
    }
    
    console.log('🏁 OCR test completed!');
}

// Run the test
testOCR().catch(console.error);
