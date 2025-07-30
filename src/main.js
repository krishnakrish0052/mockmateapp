const { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, clipboard } = require('electron');

// Enable live reload for Electron only in development - optimized for performance
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: require(`${__dirname}/../node_modules/electron`),
            hardResetMethod: 'exit'
        });
    } catch (error) {
        console.log('electron-reload not available in production mode');
    }
}
const path = require('path');

// Load environment variables
require('dotenv').config();

// Lazy-load services for better startup performance - services are imported when first needed
// This significantly reduces the initial loading time of the application

class MockMateApp {
    constructor() {
        this.controlWindow = null;
        this.responseWindow = null;
        this.isResponseWindowVisible = false;
        this.responseWindowReady = false;
        this.pendingStreamChunks = [];
        this.currentPosition = { x: 0, y: 0 };
        this.currentSize = { width: 900, height: 180 };
        this.responsePosition = { x: 0, y: 200 };
        this.responseSize = { width: 900, height: 300 };
        this.isInitialized = false;
        
        // Services - will be lazy-loaded via getters when first accessed
        // No need to initialize these as properties since we use getters
        this._aiService = null;
        this._systemAudioService = null;
        this._screenCaptureService = null;
        this._ocrService = null;
        this._questionDetectionService = null;
        this._documentIntelligenceService = null;
        this._speechService = null;
        // App state
        this.appState = {
            isListening: false,
            isMicEnabled: false,
            isSystemSoundEnabled: false,
            isAIWorking: false,
            currentQuestion: '',
            companyName: '',
            jobDescription: '',
            selectedModel: 'openai'
        };
    }

    // Lazy loading getters for services - services are loaded only when accessed
    get aiService() {
        if (!this._aiService) {
            const AIService = require('./services/AIService');
            this._aiService = new AIService();
            console.log('AIService lazy-loaded successfully');
        }
        return this._aiService;
    }

    get systemAudioService() {
        if (!this._systemAudioService) {
            const SystemAudioService = require('./services/SystemAudioService');
            this._systemAudioService = new SystemAudioService();
            // Set the control window reference for communication with renderer
            if (this.controlWindow) {
                this._systemAudioService.setControlWindow(this.controlWindow);
            }
            console.log('SystemAudioService lazy-loaded successfully');
        }
        return this._systemAudioService;
    }

    get screenCaptureService() {
        if (!this._screenCaptureService) {
            const ScreenCaptureService = require('./services/ScreenCaptureService');
            this._screenCaptureService = new ScreenCaptureService();
            console.log('ScreenCaptureService lazy-loaded successfully');
        }
        return this._screenCaptureService;
    }

    get ocrService() {
        if (!this._ocrService) {
            const OCRService = require('./services/OCRService');
            this._ocrService = new OCRService();
            console.log('OCRService lazy-loaded successfully');
        }
        return this._ocrService;
    }

    get questionDetectionService() {
        if (!this._questionDetectionService) {
            const QuestionDetectionService = require('./services/QuestionDetectionService');
            this._questionDetectionService = new QuestionDetectionService(this.aiService, this.ocrService);
            console.log('QuestionDetectionService lazy-loaded successfully');
        }
        return this._questionDetectionService;
    }

    get documentIntelligenceService() {
        if (!this._documentIntelligenceService) {
            const DocumentIntelligenceService = require('./services/DocumentIntelligenceService');
            this._documentIntelligenceService = new DocumentIntelligenceService(this.aiService, this.ocrService);
            console.log('DocumentIntelligenceService lazy-loaded successfully');
        }
        return this._documentIntelligenceService;
    }

    get speechService() {
        if (!this._speechService) {
            const SpeechService = require('./services/SpeechService');
            this._speechService = new SpeechService();
            console.log('SpeechService lazy-loaded successfully');
        }
        return this._speechService;
    }

    async initialize() {
        await app.whenReady();

        // Create windows immediately for faster startup
        this.createControlWindow();
        this.createResponseWindow();

        // Setup global shortcuts
        this.setupGlobalShortcuts();

        // Setup IPC handlers
        this.setupIPCHandlers();

        // Setup model-related IPC handlers
        this.setupModelIPCHandlers();

        this.isInitialized = true;
        console.log('MockMate AI initialized successfully (services will be loaded on demand)');
    }

    createControlWindow() {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        
        // Calculate center position for top-center alignment
        const windowX = Math.floor((width - this.currentSize.width) / 2);
        const windowY = 0; // Top of screen
        
        this.controlWindow = new BrowserWindow({
            width: this.currentSize.width,
            height: this.currentSize.height,
            x: windowX,
            y: windowY,
            frame: false,
            transparent: true,
            backgroundColor: '#0000008C', // Black with 55% opacity
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: true,
            movable: true,
            hasShadow: false, // Remove window shadow
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                backgroundThrottling: false,
                preload: path.join(__dirname, 'preload.js')
            },
            show: true
        });

        console.log('Loading control panel HTML...');
        this.controlWindow.loadFile(path.join(__dirname, '../mockmate-control-panel.html'));
        
        // Update system audio service with control window reference if it's already loaded
        if (this._systemAudioService) {
            this._systemAudioService.setControlWindow(this.controlWindow);
        }
        
        

        // Window events
        // Platform-specific settings for stealth
        if (process.platform === 'darwin') {
            this.controlWindow.once('ready-to-show', () => {
                this.controlWindow.show();
                this.controlWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                this.controlWindow.setWindowButtonVisibility(false);
                app.dock.hide();
                this.controlWindow.setContentProtection(true);
                // Force window redraw for content protection to take effect
                const bounds = this.controlWindow.getBounds();
                this.controlWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width + 1, height: bounds.height });
                setTimeout(() => {
                    this.controlWindow.setBounds(bounds);
                    this.controlWindow.setVibrancy('popover');
                    setTimeout(() => {
                        this.controlWindow.setVibrancy(null);
                    }, 50);
                }, 10);
            });
        } else if (process.platform === 'win32') {
            this.controlWindow.once('ready-to-show', () => {
                this.controlWindow.show();
                this.controlWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                this.controlWindow.setSkipTaskbar(true);
                this.controlWindow.setContentProtection(true);
                // Force window redraw for content protection to take effect
                const bounds = this.controlWindow.getBounds();
                this.controlWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width + 1, height: bounds.height });
                setTimeout(() => {
                    this.controlWindow.setBounds(bounds);
                }, 10);
            });
        }
        console.log('Control window creation complete.');

        this.controlWindow.on('closed', () => {
            this.controlWindow = null;
        });

        // Make window click-through when needed
        this.controlWindow.setIgnoreMouseEvents(false);
    }

    createResponseWindow() {
        console.log('createResponseWindow called');
        if (this.responseWindow) {
            return;
        }

        const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
        
        const minHeight = 200;
        
        const controlWindowBounds = this.controlWindow.getBounds();
        const responseX = controlWindowBounds.x;
        const responseY = controlWindowBounds.y + controlWindowBounds.height + 10;
        
        this.responseWindow = new BrowserWindow({
            width: this.currentSize.width,
            height: 1, // Set initial height to a minimal value
            x: responseX,
            y: responseY,
            frame: false,
            transparent: true,
            backgroundColor: '#0000008C',
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: true,
            movable: true,
            hasShadow: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                backgroundThrottling: false,
                preload: path.join(__dirname, 'preload.js')
            },
            show: false
        });

        console.log('Loading response window HTML...');
        this.responseWindow.loadFile(path.join(__dirname, '../mockmate-response-window.html'));

        this.responseWindow.once('ready-to-show', () => {
            this.responseWindowReady = true;
            // Platform-specific settings for stealth
            if (process.platform === 'darwin') {
                this.responseWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                this.responseWindow.setWindowButtonVisibility(false);
                app.dock.hide();
                this.responseWindow.setContentProtection(true);
                // Force window redraw for content protection to take effect
                const bounds = this.responseWindow.getBounds();
                this.responseWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width + 1, height: bounds.height });
                setTimeout(() => {
                    this.responseWindow.setBounds(bounds);
                    this.responseWindow.setVibrancy('popover');
                    setTimeout(() => {
                        this.responseWindow.setVibrancy(null);
                    }, 50);
                }, 10);
            } else if (process.platform === 'win32') {
                this.responseWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                this.responseWindow.setSkipTaskbar(true);
                this.responseWindow.setContentProtection(true);
                // Force window redraw for content protection to take effect
                const bounds = this.responseWindow.getBounds();
                this.responseWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width + 1, height: bounds.height });
                setTimeout(() => {
                    this.responseWindow.setBounds(bounds);
                }, 10);
            }
        });

        this.responseWindow.on('closed', () => {
            this.responseWindow = null;
            this.responseWindowReady = false;
            this.isResponseWindowVisible = false;
        });

        console.log('Response window creation complete.');
    }

    showResponseWindow(question = '', isLoading = true) {
        if (!this.responseWindow) {
            this.createResponseWindow();
        }

        // Reset window height for new response
        const bounds = this.responseWindow.getBounds();
        this.responseWindow.setBounds({ height: 1, x: bounds.x, y: bounds.y, width: bounds.width });

        this.responseWindow.show();

        if (this.responseWindow && this.responseWindow.webContents) {
            this.responseWindow.webContents.send('display-response', {
                question: question || this.appState.currentQuestion,
                model: this.appState.selectedModel,
                timestamp: new Date().toISOString(),
                isLoading: isLoading,
            });
        }
    }

    showLoadingResponse(question = '') {
        console.log('showLoadingResponse called with question:', question);
        const loadingData = {
            response: 'Generating AI response...',
            question: question || this.appState.currentQuestion,
            model: this.appState.selectedModel
        };
        
        this.showResponseWindow(loadingData, true);
    }

    streamResponseUpdate(chunkData) {
        if (!this.responseWindowReady) {
            this.pendingStreamChunks.push(chunkData);
            return;
        }

        if (this.responseWindow && this.responseWindow.webContents) {
            this.responseWindow.webContents.send('stream-response-chunk', chunkData);
        }
    }

    updateResponseWindow(responseData) {
        if (this.responseWindow && this.responseWindow.webContents) {
            this.responseWindow.webContents.send('display-response', {
                response: responseData.response || 'No response generated',
                question: responseData.question,
                model: responseData.model,
                timestamp: new Date().toISOString(),
                isLoading: false,
            });
        }
    }

    hideResponseWindow() {
        if (this.responseWindow) {
            this.responseWindow.close();
        }
    }



    setupGlobalShortcuts() {
        // 1. System Sound Enable/Disable: Shift+S
        globalShortcut.register('Shift+S', () => {
            this.toggleSystemSound();
        });

        // 2. AI Answer Trigger: Ctrl+Z
        globalShortcut.register('CommandOrControl+Z', () => {
            this.triggerAIAnswer();
        });

        

        // 4. Mic Enable/Disable: Ctrl+Q
        globalShortcut.register('CommandOrControl+Q', () => {
            this.toggleMicrophone();
        });

        // 5. Analyze Screen: Ctrl+A
        globalShortcut.register('CommandOrControl+A', () => {
            this.analyzeScreen();
        });

        // 6. Manual Question Entry: Ctrl+I
        globalShortcut.register('CommandOrControl+I', () => {
            this.focusQuestionInput();
        });

        // 7. Submit Question: Enter (handled in renderer)
        // This is handled in the HTML/JS for the input field

        // 8. Clear Listening Area: Ctrl+Shift+C
        globalShortcut.register('CommandOrControl+Shift+C', () => {
            this.clearListeningArea();
        });


        // 10. Positioning and Resizing:
        // Move Left: Ctrl+Shift+.
        globalShortcut.register('CommandOrControl+Shift+.', () => {
            this.moveWindowLeft();
        });

        // Move Right: Ctrl+Shift+,
        globalShortcut.register('CommandOrControl+Shift+,', () => {
            this.moveWindowRight();
        });

        // Decrease Size: Ctrl+-
        globalShortcut.register('CommandOrControl+-', () => {
            this.decreaseWindowSize();
        });

        // Increase Size: Ctrl++
        globalShortcut.register('CommandOrControl+=', () => {
            this.increaseWindowSize();
        });

        // NEW HOTKEYS FOR DRAGGING:
        // Drag window up: Ctrl+PageUp
        globalShortcut.register('CommandOrControl+PageUp', () => {
            this.moveWindowUp();
        });

        // Drag window down: Ctrl+PageDown
        globalShortcut.register('CommandOrControl+PageDown', () => {
            this.moveWindowDown();
        });

        // Reset position and size: Ctrl+6
        globalShortcut.register('CommandOrControl+6', () => {
            this.resetWindowPositionAndSize();
        });

        console.log('Global shortcuts registered successfully');
    }

    setupIPCHandlers() {
        // Handle AI generation requests
        ipcMain.handle('generate-ai-response', async (event, context) => {
            try {
                console.log('Main: Handling AI response generation for:', context.question);
                
                // Store current question
                this.appState.currentQuestion = context.question;
                
                // Show loading response window first
                this.showLoadingResponse(context.question);
                
                // Generate response with streaming callback
                const response = await this.aiService.generateResponse(context, (chunk) => {
                    // Handle streaming chunks
                    console.log('Main: Received streaming chunk:', chunk.content);
                    this.streamResponseUpdate({
                        content: chunk.content,
                        question: context.question,
                        model: chunk.model,
                        timestamp: chunk.timestamp,
                        isStreaming: true
                    });
                });
                
                console.log('Main: Final response received:', response);
                
                // Update with final response
                this.updateResponseWindow({
                    response: response.response,
                    question: context.question,
                    model: response.model,
                    timestamp: response.timestamp
                });
                
                return response;
            } catch (error) {
                console.error('AI generation failed:', error);
                
                // Show error in response window
                this.updateResponseWindow({
                    response: `Error: ${error.message}`,
                    question: context.question || 'Unknown question',
                    model: this.appState.selectedModel,
                    timestamp: new Date().toISOString()
                });
                
                return { error: error.message };
            }
        });

        // Handle model selection
        ipcMain.handle('set-model', (event, model) => {
            this.aiService.setModel(model);
            this.appState.selectedModel = model;
        });

        // Handle get available models
        ipcMain.handle('get-models', async () => {
            return await this.aiService.getAvailableModels();
        });

        // Handle file dialog for resume upload
        ipcMain.handle('open-file-dialog', async (event, options) => {
            const { dialog } = require('electron');
            try {
                const result = await dialog.showOpenDialog(this.controlWindow, options);
                return result;
            } catch (error) {
                console.error('File dialog error:', error);
                return { canceled: true, error: error.message };
            }
        });

        // Handle resume processing
        ipcMain.handle('process-resume', async (event, filePath) => {
            try {
                console.log('Processing resume:', filePath);
                
                const fs = require('fs');
                const path = require('path');
                
                // Get file extension
                const fileExt = path.extname(filePath).toLowerCase();
                
                let extractedText = '';
                
                if (fileExt === '.pdf') {
                    // Use pdf-parse for PDF files
                    const pdfParse = require('pdf-parse');
                    const dataBuffer = fs.readFileSync(filePath);
                    const pdfData = await pdfParse(dataBuffer);
                    extractedText = pdfData.text;
                } else if (fileExt === '.docx') {
                    // Use mammoth for DOCX files
                    const mammoth = require('mammoth');
                    const result = await mammoth.extractRawText({ path: filePath });
                    extractedText = result.value;
                } else if (fileExt === '.doc') {
                    // For .doc files, you might need a different library or conversion
                    throw new Error('DOC files not fully supported yet. Please use DOCX or PDF.');
                } else if (fileExt === '.txt') {
                    // Simple text file
                    extractedText = fs.readFileSync(filePath, 'utf8');
                } else {
                    throw new Error('Unsupported file format');
                }
                
                // Extract skills and experience from resume text
                const analysis = this.analyzeResumeContent(extractedText);
                
                return {
                    success: true,
                    filePath: filePath,
                    extractedText: extractedText,
                    skills: analysis.skills,
                    experience: analysis.experience,
                    education: analysis.education,
                    summary: analysis.summary
                };
                
            } catch (error) {
                console.error('Resume processing error:', error);
                return { error: error.message };
            }
        });

        // Enhanced screen capture handlers
        ipcMain.handle('capture-screen', async () => {
            try {
                const result = await this.screenCaptureService.captureFullScreen();
                if (result.error) {
                    return { error: result.error };
                }
                
                return {
                    success: true,
                    thumbnail: result.imageData,
                    id: result.sourceId,
                    dimensions: result.dimensions,
                    captureType: result.captureType
                };
            } catch (error) {
                console.error('Screen capture error:', error);
                return { error: error.message };
            }
        });
        
        // Capture specific window
        ipcMain.handle('capture-window', async (event, windowTitle) => {
            try {
                return await this.screenCaptureService.captureSpecificWindow(windowTitle);
            } catch (error) {
                console.error('Window capture error:', error);
                return { error: error.message };
            }
        });
        
        // Capture region
        ipcMain.handle('capture-region', async (event, region) => {
            try {
                return await this.screenCaptureService.captureRegion(region);
            } catch (error) {
                console.error('Region capture error:', error);
                return { error: error.message };
            }
        });
        
        // Get display information
        ipcMain.handle('get-display-info', async () => {
            try {
                return await this.screenCaptureService.getDisplayInfo();
            } catch (error) {
                console.error('Display info error:', error);
                return { error: error.message };
            }
        });
        
        // Detect interview platforms
        ipcMain.handle('detect-interview-platforms', async () => {
            try {
                return await this.screenCaptureService.detectInterviewPlatforms();
            } catch (error) {
                console.error('Platform detection error:', error);
                return { error: error.message };
            }
        });

        // Enhanced screen content analysis with new services
        ipcMain.handle('analyze-screen-content', async (event, screenData) => {
            try {
                console.log('🔍 Starting enhanced screen analysis...');
                
                // Use our new QuestionDetectionService which integrates OCR and AI
                const analysisResult = await this.questionDetectionService.detectQuestions(
                    screenData.thumbnail,
                    {
                        useAI: true,
                        confidenceThreshold: 0.5,
                        ocrOptions: {
                            provider: 'tesseract', // Will fallback to cloud providers if available
                            extractQuestions: true,
                            applyCorrections: true
                        }
                    }
                );
                
                if (analysisResult.success) {
                    console.log(`✅ Found ${analysisResult.questions.length} questions in ${analysisResult.processingTime}ms`);
                    
                    // Update app state with the best question found
                    if (analysisResult.questions.length > 0) {
                        const bestQuestion = analysisResult.questions[0];
                        this.appState.currentQuestion = bestQuestion.text;
                        
                        // Notify control window about detected question
                        if (this.controlWindow) {
                            this.controlWindow.webContents.send('question-detected', {
                                question: bestQuestion.text,
                                type: bestQuestion.type,
                                confidence: bestQuestion.confidence
                            });
                        }
                    }
                    
                    return {
                        success: true,
                        extractedText: analysisResult.metadata?.extractedText || '',
                        questions: analysisResult.questions.map(q => q.text),
                        detailedQuestions: analysisResult.questions,
                        confidence: analysisResult.questions.length > 0 ? 
                            analysisResult.questions[0].confidence : 0.1,
                        processingTime: analysisResult.processingTime,
                        metadata: analysisResult.metadata
                    };
                } else {
                    console.error('❌ Screen analysis failed:', analysisResult.error);
                    return { error: analysisResult.error };
                }
                
            } catch (error) {
                console.error('❌ Enhanced screen analysis error:', error);
                return { error: error.message };
            }
        });
        // Handle system sound toggle from renderer
        ipcMain.on('toggle-system-sound', (event, isEnabled) => {
            this.toggleSystemSound();
        });
        
        // Handle system audio data from renderer
        ipcMain.on('system-audio-data', (event, audioData) => {
            console.log('Main: Received system audio data:', audioData.data.length, 'samples');
            // Pass the audio data to the system audio service for processing
            if (this._systemAudioService) {
                this._systemAudioService.handleAudioData(audioData);
            }
        });
        
        // Handle system audio started event from renderer
        ipcMain.on('system-audio-started', (event) => {
            console.log('Main: System audio capture started successfully');
            // Emit start event through system audio service
            if (this._systemAudioService) {
                this._systemAudioService.emit('start');
            }
        });
        
        // Handle system audio stopped event from renderer
        ipcMain.on('system-audio-stopped', (event) => {
            console.log('Main: System audio capture stopped');
            // Emit stop event through system audio service
            if (this._systemAudioService) {
                this._systemAudioService.emit('stop');
            }
        });
        
        // Handle system audio error from renderer
        ipcMain.on('system-audio-error', (event, errorMessage) => {
            console.error('Main: System audio error from renderer:', errorMessage);
            // Pass error to system audio service
            if (this._systemAudioService) {
                this._systemAudioService.handleAudioError(new Error(errorMessage));
            }
        });

        // Handle request for desktop audio sources
        ipcMain.handle('get-desktop-audio-sources', async () => {
            try {
                const sources = await desktopCapturer.getSources({ types: ['screen', 'window', 'audio'] });
                return { success: true, sources: sources };
            } catch (error) {
                console.error('Failed to get desktop audio sources:', error);
                return { success: false, error: error.message };
            }
        });
        
        // Handle request for audio sources (legacy compatibility)
        ipcMain.handle('get-audio-sources', async () => {
            try {
                const sources = await desktopCapturer.getSources({ types: ['screen', 'window', 'audio'] });
                console.log('Main: Available audio sources:', sources.map(s => ({ id: s.id, name: s.name })));
                return sources;
            } catch (error) {
                console.error('Failed to get audio sources:', error);
                return [];
            }
        });
        
        // Handle system audio stream request
        ipcMain.handle('get-system-audio-stream', async () => {
            try {
                console.log('Main: Getting system audio stream...');
                
                // Get available desktop sources
                const sources = await desktopCapturer.getSources({ types: ['screen', 'window', 'audio'] });
                console.log('Main: Available sources:', sources.map(s => ({ id: s.id, name: s.name })));
                
                // Look for audio sources or use the first screen source
                const audioSource = sources.find(source => 
                    source.name.toLowerCase().includes('system audio') ||
                    source.name.toLowerCase().includes('stereo mix') ||
                    source.name.toLowerCase().includes('what u hear') ||
                    source.name.toLowerCase().includes('speakers') ||
                    source.name.toLowerCase().includes('headphones')
                ) || sources.find(source => source.id.startsWith('screen'));
                
                if (!audioSource) {
                    throw new Error('No suitable audio source found. Available sources: ' + sources.map(s => s.name).join(', '));
                }
                
                console.log('Main: Selected audio source:', audioSource.name);
                
                return {
                    success: true,
                    sourceId: audioSource.id,
                    sourceName: audioSource.name
                };
                
            } catch (error) {
                console.error('Main: Failed to get system audio stream:', error);
                return { success: false, error: error.message };
            }
        });

        // Handle microphone toggle from renderer (AUDIO FUNCTIONALITY DISABLED)
        ipcMain.on('toggle-microphone', async (event, isEnabled) => {
            console.log('⚠️ Microphone functionality has been completely disabled');
            
            // Always keep it disabled
            this.appState.isMicEnabled = false;
            
            // Send feedback to UI
            if (this.controlWindow) {
                this.controlWindow.webContents.send('microphone-toggled', false);
                this.controlWindow.webContents.send('display-transcription', '❌ Microphone functionality has been permanently disabled');
            }
        });

        // Handle model selection from main window dropdown
        ipcMain.handle('get-current-model', () => {
            return this.appState.selectedModel;
        });

        ipcMain.handle('set-model-from-window', (event, model) => {
            this.appState.selectedModel = model;
            this.aiService.setModel(model);
            
            console.log(`Model changed to: ${model}`);
            return true;
        });

        // New OCR and Question Detection handlers
        
        // Perform OCR on image/screen
        ipcMain.handle('perform-ocr', async (event, imageData, options = {}) => {
            try {
                return await this.ocrService.performOCR(imageData, options);
            } catch (error) {
                console.error('OCR service error:', error);
                return { error: error.message };
            }
        });
        
        // Detect questions from text or image
        ipcMain.handle('detect-questions', async (event, input, options = {}) => {
            try {
                return await this.questionDetectionService.detectQuestions(input, options);
            } catch (error) {
                console.error('Question detection error:', error);
                return { error: error.message };
            }
        });
        
        // Get OCR service stats
        ipcMain.handle('get-ocr-stats', async () => {
            try {
                return this.ocrService.getPerformanceStats();
            } catch (error) {
                return { error: error.message };
            }
        });
        
        // Get question detection stats
        ipcMain.handle('get-question-detection-stats', async () => {
            try {
                return this.questionDetectionService.getStats();
            } catch (error) {
                return { error: error.message };
            }
        });
        
        // Health check for services
        ipcMain.handle('health-check', async () => {
            try {
                const results = {
                    ocr: await this.ocrService.healthCheck(),
                    questionDetection: await this.questionDetectionService.healthCheck(),
                    documentIntelligence: await this.documentIntelligenceService.healthCheck(),
                    screenCapture: { status: 'healthy', timestamp: new Date().toISOString() }
                };
                return results;
            } catch (error) {
                return { error: error.message };
            }
        });

        // Document Intelligence Service handlers
        
        // Analyze resume from file path
        ipcMain.handle('analyze-resume-file', async (event, filePath, options = {}) => {
            try {
                return await this.documentIntelligenceService.analyzeResumeFile(filePath, options);
            } catch (error) {
                console.error('Resume file analysis error:', error);
                return { error: error.message };
            }
        });
        
        // Analyze resume from text content
        ipcMain.handle('analyze-resume-text', async (event, resumeText, options = {}) => {
            try {
                return await this.documentIntelligenceService.analyzeResumeText(resumeText, options);
            } catch (error) {
                console.error('Resume text analysis error:', error);
                return { error: error.message };
            }
        });
        
        // Analyze job description
        ipcMain.handle('analyze-job-description', async (event, jobDescription, options = {}) => {
            try {
                return await this.documentIntelligenceService.analyzeJobDescription(jobDescription, options);
            } catch (error) {
                console.error('Job description analysis error:', error);
                return { error: error.message };
            }
        });
        
        // Calculate resume-job match score
        ipcMain.handle('calculate-match-score', async (event, resumeData, jobData, weights = {}) => {
            try {
                return await this.documentIntelligenceService.calculateMatchScore(resumeData, jobData, weights);
            } catch (error) {
                console.error('Match score calculation error:', error);
                return { error: error.message };
            }
        });
        
        // Generate AI-powered resume insights
        ipcMain.handle('generate-resume-insights', async (event, resumeData, options = {}) => {
            try {
                return await this.documentIntelligenceService.generateResumeInsights(resumeData, options);
            } catch (error) {
                console.error('Resume insights generation error:', error);
                return { error: error.message };
            }
        });
        
        // Generate AI-powered job insights
        ipcMain.handle('generate-job-insights', async (event, jobData, options = {}) => {
            try {
                return await this.documentIntelligenceService.generateJobInsights(jobData, options);
            } catch (error) {
                console.error('Job insights generation error:', error);
                return { error: error.message };
            }
        });
        
        // Generate interview questions based on job and resume
        ipcMain.handle('generate-interview-questions', async (event, resumeData, jobData, options = {}) => {
            try {
                return await this.documentIntelligenceService.generateInterviewQuestions(resumeData, jobData, options);
            } catch (error) {
                console.error('Interview questions generation error:', error);
                return { error: error.message };
            }
        });
        
        // Get document intelligence performance stats
        ipcMain.handle('get-document-intelligence-stats', async () => {
            try {
                return this.documentIntelligenceService.getPerformanceStats();
            } catch (error) {
                return { error: error.message };
            }
        });
        
        // Batch analyze multiple resumes
        ipcMain.handle('batch-analyze-resumes', async (event, filePaths, options = {}) => {
            try {
                const results = [];
                for (const filePath of filePaths) {
                    const result = await this.documentIntelligenceService.analyzeResumeFile(filePath, options);
                    results.push({ filePath, ...result });
                }
                return { success: true, results };
            } catch (error) {
                console.error('Batch resume analysis error:', error);
                return { error: error.message };
            }
        });
        
        // Enhanced resume processing with DocumentIntelligenceService
        ipcMain.handle('process-resume-advanced', async (event, filePath, options = {}) => {
            try {
                console.log('Processing resume with advanced intelligence:', filePath);
                
                // Use the new DocumentIntelligenceService for comprehensive analysis
                const analysisResult = await this.documentIntelligenceService.analyzeResumeFile(filePath, {
                    includeInsights: true,
                    extractProjects: true,
                    extractCertifications: true,
                    detectIndustry: true,
                    scoreExperience: true,
                    ...options
                });
                
                if (analysisResult.success) {
                    // Update app state with resume data for better interview responses
                    this.appState.resumeData = analysisResult.data;
                    
                    // Notify control window about successful resume analysis
                    if (this.controlWindow) {
                        this.controlWindow.webContents.send('resume-analyzed', {
                            skills: analysisResult.data.skills,
                            experience: analysisResult.data.experience,
                            summary: analysisResult.data.summary,
                            insights: analysisResult.insights
                        });
                    }
                    
                    return {
                        success: true,
                        filePath: filePath,
                        data: analysisResult.data,
                        insights: analysisResult.insights,
                        processingTime: analysisResult.processingTime
                    };
                } else {
                    return { error: analysisResult.error };
                }
                
            } catch (error) {
                console.error('Advanced resume processing error:', error);
                return { error: error.message };
            }
        });

        // Handle end session
        ipcMain.on('end-session', () => {
            console.log('Session ended by user');
            app.quit();
        });

        // Handle close response window - just close the response window
        ipcMain.on('close-response-window', () => {
            console.log('Close response window requested');
            if (this.responseWindow) {
                this.responseWindow.close();
            }
        });

        // Handle clear response window - clear content but keep window open
        ipcMain.on('clear-response-window', () => {
            console.log('Clear response window requested');
            if (this.responseWindow && this.responseWindow.webContents) {
                this.responseWindow.webContents.send('clear-response');
            }
        });

        // Handle response window resize requests from renderer
        ipcMain.on('resize-response-window', (event, newHeight) => {
            console.log('Response window resize requested, new height:', newHeight);
            if (this.responseWindow && !this.responseWindow.isDestroyed()) {
                try {
                    const bounds = this.responseWindow.getBounds();
                    // Add some padding and enforce min/max bounds
                    const minHeight = 200;
                    const maxHeight = 800;
                    const finalHeight = Math.min(maxHeight, newHeight + 20);
                    
                    this.responseWindow.setBounds({
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: finalHeight
                    });
                    
                    console.log(`Response window resized to height: ${finalHeight}`);
                } catch (error) {
                    console.error('Error resizing response window:', error);
                }
            } else {
                console.log('Response window not available for resizing');
            }
        });
    }

    

    setupModelIPCHandlers() {
        // Get available models from AI service
        ipcMain.handle('get-available-models', async () => {
            try {
                const models = await this.aiService.getAvailableModels();
                return models;
            } catch (error) {
                console.error('Get available models error:', error);
                return [];
            }
        });

        

        console.log('Model IPC handlers setup completed');
    }

    toggleWindowVisibility() {
        if (this.controlWindow) {
            if (this.controlWindow.isVisible()) {
                this.controlWindow.hide();
            } else {
                this.controlWindow.show();
            }
        }
        console.log(`Control window visibility toggled.`);
    }

    toggleWindowVisibility() {
        if (this.controlWindow) {
            if (this.controlWindow.isVisible()) {
                this.controlWindow.hide();
            } else {
                this.controlWindow.show();
            }
        }
        console.log(`Control window visibility toggled.`);
    }

    toggleWindowVisibility() {
        if (this.controlWindow) {
            if (this.controlWindow.isVisible()) {
                this.controlWindow.hide();
            } else {
                this.controlWindow.show();
            }
        }
        console.log(`Control window visibility toggled.`);
    }

    toggleWindowVisibility() {
        if (this.controlWindow) {
            if (this.controlWindow.isVisible()) {
                this.controlWindow.hide();
            } else {
                this.controlWindow.show();
            }
        }
        console.log(`Control window visibility toggled.`);
    }

    toggleWindowVisibility() {
        if (this.controlWindow) {
            if (this.controlWindow.isVisible()) {
                this.controlWindow.hide();
            } else {
                this.controlWindow.show();
            }
        }
        console.log(`Control window visibility toggled.`);
    }

    async triggerAIAnswer() {
        if (this.appState.isAIWorking) return;
        
        this.appState.isAIWorking = true;
        
        // Show loading state immediately
        this.showLoadingResponse();
        
        try {
            const context = {
                company: this.appState.companyName,
                jobDescription: this.appState.jobDescription,
                question: this.appState.currentQuestion || 'Please provide a general interview response.',
                model: this.appState.selectedModel
            };
            
            const onChunk = (chunk) => {
                if (this.responseWindow) {
                    this.responseWindow.webContents.send('stream-response-chunk', {
                        content: chunk.content,
                        model: chunk.model,
                        timestamp: chunk.timestamp,
                        isFinal: false // Indicate it's a chunk, not final
                    });
                }
            };

            try {
                const finalResponse = await this.aiService.generateResponse(context, onChunk);
                
                // Send final signal with the complete response
                if (this.responseWindow) {
                    this.responseWindow.webContents.send('stream-response-chunk', {
                        content: '', // No new content, just a signal
                        model: finalResponse.model || this.appState.selectedModel,
                        timestamp: finalResponse.timestamp || new Date().toISOString(),
                        isFinal: true, // Indicate this is the final chunk
                        fullResponse: finalResponse.response // Send the complete response for final rendering
                    });
                }
            } catch (error) {
                console.error('AI Answer generation failed:', error);
                // Send final signal with error
                if (this.responseWindow) {
                    this.responseWindow.webContents.send('stream-response-chunk', {
                        content: `Error generating response: ${error.message}`,
                        model: this.appState.selectedModel,
                        timestamp: new Date().toISOString(),
                        isFinal: true, // Indicate this is the final chunk
                        isError: true // Indicate that an error occurred
                    });
                }
            } finally {
                this.appState.isAIWorking = false;
            }
        } catch (outerError) {
            console.error('Outer AI Answer generation failed:', outerError);
            if (this.responseWindow) {
                this.responseWindow.webContents.send('stream-response-chunk', {
                    content: `Critical Error: ${outerError.message}`,
                    model: this.appState.selectedModel,
                    timestamp: new Date().toISOString(),
                    isFinal: true,
                    isError: true
                });
            }
        } finally {
            this.appState.isAIWorking = false;
        }
    }

    

    // Hotkey action methods
    async toggleSystemSound() {
        try {
            this.appState.isSystemSoundEnabled = !this.appState.isSystemSoundEnabled;
            
            if (this.appState.isSystemSoundEnabled) {
                console.log('🔊 Starting system sound capture...');
                await this.systemAudioService.startSystemAudioCapture();
                
                // Set up audio data handler for future STT implementation
                this.systemAudioService.on('data', (audioData) => {
                    this.speechService.transcribe(audioData.data);
                });

                this.speechService.on('transcription', (transcription) => {
                    if (this.controlWindow) {
                        this.controlWindow.webContents.send('display-transcription', transcription.response);
                    }
                });
                
                this.systemAudioService.on('error', (error) => {
                    console.error('System audio error:', error);
                    this.appState.isSystemSoundEnabled = false;
                    if (this.controlWindow) {
                        this.controlWindow.webContents.send('system-sound-toggled', false);
                        this.controlWindow.webContents.send('display-transcription', `❌ System audio error: ${error.message}`);
                    }
                });
                
                if (this.controlWindow) {
                    this.controlWindow.webContents.send('system-sound-toggled', true);
                    this.controlWindow.webContents.send('display-transcription', '🔊 System audio capture started - listening to system sounds...');
                }
            } else {
                console.log('🔇 Stopping system sound capture...');
                this.systemAudioService.stopSystemAudioCapture();
                
                if (this.controlWindow) {
                    this.controlWindow.webContents.send('system-sound-toggled', false);
                    this.controlWindow.webContents.send('display-transcription', '🔇 System audio capture stopped');
                }
            }
        } catch (error) {
            console.error('Failed to toggle system sound:', error);
            this.appState.isSystemSoundEnabled = false;
            
            if (this.controlWindow) {
                this.controlWindow.webContents.send('system-sound-toggled', false);
                this.controlWindow.webContents.send('display-transcription', `❌ Failed to start system audio: ${error.message}`);
            }
        }
    }

    toggleMicrophone() {
        console.log('⚠️ Microphone functionality has been completely disabled');
        
        // Always keep it disabled
        this.appState.isMicEnabled = false;
        
        // Send disabled state update to renderer
        if (this.controlWindow) {
            this.controlWindow.webContents.send('microphone-toggled', false);
            this.controlWindow.webContents.send('display-transcription', '❌ Microphone functionality has been permanently disabled');
        }
    }

    analyzeScreen() {
        console.log('Analyzing screen...');
        this.screenCaptureService.captureFullScreen().then(screenshot => {
            if (screenshot.error) {
                console.error('Screen capture failed:', screenshot.error);
                return;
            }

            const imageDataUrl = `data:image/png;base64,${screenshot.imageData.toString('base64')}`;

            const prompt = "You are an expert interview candidate. Analyze the following screenshot, identify the interview question, and provide a concise, accurate, and well-structured answer suitable for a job interview. If no question is visible, state that.";
            this.aiService.analyzeImageWithPrompt(imageDataUrl, prompt).then(response => {
                this.showResponseWindow(response.response);
            });
        });
    }

    focusQuestionInput() {
        console.log('Focusing question input...');
        
        // Send focus command to renderer
        if (this.controlWindow) {
            this.controlWindow.webContents.send('focus-question-input');
        }
    }

    clearListeningArea() {
        console.log('Clearing listening area...');
        
        // Reset current question state
        this.appState.currentQuestion = '';
        
        // Send clear command to renderer
        if (this.controlWindow) {
            this.controlWindow.webContents.send('clear-listening-area');
        }
    }

    // Window positioning and resizing methods
    moveWindowLeft() {
        if (!this.controlWindow) return;
        
        const [x, y] = this.controlWindow.getPosition();
        const newX = Math.max(0, x - 50); // Move 50 pixels left, don't go beyond screen edge
        this.controlWindow.setPosition(newX, y);
        this.currentPosition.x = newX;
        console.log(`Window moved left to position: ${newX}, ${y}`);
    }

    moveWindowRight() {
        if (!this.controlWindow) return;
        
        const [x, y] = this.controlWindow.getPosition();
        const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
        const newX = Math.min(screenWidth - this.currentSize.width, x + 50); // Move 50 pixels right
        this.controlWindow.setPosition(newX, y);
        this.currentPosition.x = newX;
        console.log(`Window moved right to position: ${newX}, ${y}`);
    }

    decreaseWindowSize() {
        if (!this.controlWindow) return;
        
        const minWidth = 600;
        const minHeight = 150;
        const newWidth = Math.max(minWidth, this.currentSize.width - 50);
        const newHeight = Math.max(minHeight, this.currentSize.height - 10);
        
        this.controlWindow.setSize(newWidth, newHeight);
        this.currentSize = { width: newWidth, height: newHeight };
        console.log(`Window size decreased to: ${newWidth}x${newHeight}`);
    }

    increaseWindowSize() {
        if (!this.controlWindow) return;
        
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
        const maxWidth = Math.min(1200, screenWidth - 100);
        const maxHeight = Math.min(300, screenHeight - 100);
        const newWidth = Math.min(maxWidth, this.currentSize.width + 50);
        const newHeight = Math.min(maxHeight, this.currentSize.height + 10);
        
        this.controlWindow.setSize(newWidth, newHeight);
        this.currentSize = { width: newWidth, height: newHeight };
        console.log(`Window size increased to: ${newWidth}x${newHeight}`);
    }

    // NEW METHODS FOR VERTICAL DRAGGING:
    moveWindowUp() {
        if (!this.controlWindow) return;
        
        const [x, y] = this.controlWindow.getPosition();
        const newY = Math.max(0, y - 50); // Move 50 pixels up, don't go above screen edge
        this.controlWindow.setPosition(x, newY);
        this.currentPosition.y = newY;
        console.log(`Window moved up to position: ${x}, ${newY}`);
        
        // If response window exists, move it too to maintain relative position
        if (this.responseWindow) {
            const responseNewY = newY + this.currentSize.height + 2;
            this.responseWindow.setPosition(x, responseNewY);
        }
    }

    moveWindowDown() {
        if (!this.controlWindow) return;
        
        const [x, y] = this.controlWindow.getPosition();
        const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
        const newY = Math.min(screenHeight - this.currentSize.height, y + 50); // Move 50 pixels down
        this.controlWindow.setPosition(x, newY);
        this.currentPosition.y = newY;
        console.log(`Window moved down to position: ${x}, ${newY}`);
        
        // If response window exists, move it too to maintain relative position
        if (this.responseWindow) {
            const responseNewY = newY + this.currentSize.height + 2;
            const responseHeight = this.responseWindow.getBounds().height;
            // Make sure response window doesn't go below screen
            const maxResponseY = screenHeight - responseHeight;
            const finalResponseY = Math.min(maxResponseY, responseNewY);
            this.responseWindow.setPosition(x, finalResponseY);
        }
    }

    // Helper method to extract questions from OCR text
    extractQuestionsFromText(text) {
        const questions = [];
        
        // Common question patterns
        const questionPatterns = [
            /\?[^?]*$/gm, // Sentences ending with ?
            /what\s+(?:is|are|do|does|would|will|can|could)[^.!?]*\?/gi,
            /how\s+(?:do|does|would|will|can|could)[^.!?]*\?/gi,
            /why\s+(?:do|does|would|will|can|could)[^.!?]*\?/gi,
            /when\s+(?:do|does|would|will|can|could)[^.!?]*\?/gi,
            /where\s+(?:do|does|would|will|can|could)[^.!?]*\?/gi,
            /tell\s+me\s+about[^.!?]*[.!?]/gi,
            /describe\s+[^.!?]*[.!?]/gi,
            /explain\s+[^.!?]*[.!?]/gi,
            /can\s+you\s+[^.!?]*\?/gi,
            /would\s+you\s+[^.!?]*\?/gi
        ];
        
        // Extract potential questions
        questionPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const cleaned = match.trim();
                    if (cleaned.length > 10 && cleaned.length < 200) {
                        questions.push(cleaned);
                    }
                });
            }
        });
        
        // Remove duplicates and return unique questions
        return [...new Set(questions)];
    }

    // Helper method to analyze resume content
    analyzeResumeContent(text) {
        const skills = this.extractSkills(text);
        const experience = this.extractExperience(text);
        const education = this.extractEducation(text);
        const summary = this.extractSummary(text);
        
        return {
            skills,
            experience,
            education,
            summary
        };
    }

    extractSkills(text) {
        const skillPatterns = [
            // Programming languages
            /\b(?:JavaScript|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin|TypeScript|R|MATLAB)\b/gi,
            // Frameworks and libraries
            /\b(?:React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel|Rails|jQuery)\b/gi,
            // Databases
            /\b(?:MySQL|PostgreSQL|MongoDB|SQLite|Redis|Cassandra|Oracle|SQL Server)\b/gi,
            // Cloud and DevOps
            /\b(?:AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|CI\/CD|Terraform)\b/gi,
            // Other technologies
            /\b(?:HTML|CSS|SCSS|Bootstrap|Tailwind|GraphQL|REST|API|JSON|XML)\b/gi
        ];
        
        const skills = new Set();
        skillPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(skill => skills.add(skill));
            }
        });
        
        return Array.from(skills);
    }

    extractExperience(text) {
        const experienceLines = [];
        const lines = text.split('\n');
        
        // Look for job titles and companies
        const jobTitlePatterns = [
            /(?:software|web|frontend|backend|full.?stack|mobile)\s+(?:developer|engineer|programmer)/gi,
            /(?:senior|junior|lead|principal)\s+(?:developer|engineer|programmer)/gi,
            /(?:data|machine learning|ai)\s+(?:scientist|engineer|analyst)/gi,
            /(?:product|project)\s+manager/gi,
            /(?:ui|ux)\s+(?:designer|developer)/gi
        ];
        
        lines.forEach(line => {
            jobTitlePatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    experienceLines.push(line.trim());
                }
            });
        });
        
        return experienceLines;
    }

    extractEducation(text) {
        const educationLines = [];
        const lines = text.split('\n');
        
        const educationPatterns = [
            /\b(?:bachelor|master|phd|doctorate|associate)\s+(?:of|in|degree)/gi,
            /\b(?:b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?)\b/gi,
            /\b(?:computer science|software engineering|information technology|electrical engineering)\b/gi,
            /\buniversity\b|\bcollege\b|\binstitute\b/gi
        ];
        
        lines.forEach(line => {
            educationPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    educationLines.push(line.trim());
                }
            });
        });
        
        return educationLines;
    }

    extractSummary(text) {
        const lines = text.split('\n');
        const summaryKeywords = ['summary', 'objective', 'profile', 'about'];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            if (summaryKeywords.some(keyword => line.includes(keyword))) {
                // Return the next few lines as summary
                const summaryLines = lines.slice(i + 1, i + 4)
                    .filter(line => line.trim().length > 0)
                    .join(' ');
                return summaryLines.substring(0, 300); // Limit to 300 characters
            }
        }
        
        // If no summary section found, return first meaningful paragraph
        const meaningfulLines = lines.filter(line => 
            line.trim().length > 50 && 
            !line.match(/^[A-Z\s]+$/) && // Skip all caps headers
            !line.match(/^\d+/) // Skip lines starting with numbers
        );
        
        return meaningfulLines.length > 0 ? meaningfulLines[0].substring(0, 300) : '';
    }

    resetWindowPositionAndSize() {
        if (!this.controlWindow) return;

        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

        // Reset control window size to initial values
        this.currentSize = { width: 900, height: 180 };

        // Calculate center position for top-center alignment
        const controlWindowX = Math.floor((screenWidth - this.currentSize.width) / 2);
        const controlWindowY = 0; // Top of screen

        this.controlWindow.setBounds({
            x: controlWindowX,
            y: controlWindowY,
            width: this.currentSize.width,
            height: this.currentSize.height
        });
        this.currentPosition = { x: controlWindowX, y: controlWindowY };
        console.log(`Control window reset to position: ${controlWindowX}, ${controlWindowY} and size: ${this.currentSize.width}x${this.currentSize.height}`);

        // Reset response window position and size
        if (this.responseWindow) {
            const responseX = controlWindowX;
            const responseY = controlWindowY + this.currentSize.height + 10;
            this.responseWindow.setBounds({
                x: responseX,
                y: responseY,
                width: this.currentSize.width,
                height: this.responseSize.height // Use its default height
            });
            this.responsePosition = { x: responseX, y: responseY };
            console.log(`Response window reset to position: ${responseX}, ${responseY} and size: ${this.currentSize.width}x${this.responseSize.height}`);
        }
    }
}

// Initialize the application
const mockMateApp = new MockMateApp();

// App event handlers
app.whenReady().then(() => {
    mockMateApp.initialize().catch(console.error);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        mockMateApp.initialize().catch(console.error);
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});