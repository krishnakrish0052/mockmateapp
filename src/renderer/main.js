const ipcRenderer = window.electron.ipcRenderer;

console.log('Renderer: main.js loaded and executing.');

class MockMateController {
    constructor() {
        this.isMicOn = false;
        this.isSystemSoundOn = false;
        
        this.models = [];
        this.selectedModel = 'openai';
        this.isGeneratingResponse = false;
        this.companyName = '';
        this.jobDescription = '';
        this.currentQuestion = '';
        
        // Database and session management
        this.currentSessionId = null;
        this.sessionQuestions = [];
        this.questionHistory = [];
        this.isSessionActive = false;
        this.lastResponseData = null;
        
        // Toast queue system
        this.toastQueue = [];
        this.currentToast = null;
        this.isShowingToast = false;
        
        // System audio capture
        this.systemAudioStream = null;
        this.systemAudioProcessor = null;
        this.audioDebugInterval = null;
        this.audioDataReceived = 0;
        this.lastAudioActivity = 0;
        
        this.init();
    }

    async init() {
        // Remove createUI() call since HTML structure already exists
        await this.loadModelsFromAPI();
        this.setupCustomSelect();
        this.setupEventListeners();
        this.setupIPCListeners();
        this.initializeMicrophoneTranscription();
        this.addHotkeyIndicators();
        this.updateTranscriptionState();
        
        // Database removed - no session management needed
        
        // Show hotkey hints on first load
        setTimeout(() => {
            this.showToast('\uD83D\uDCA1 Press F1 to see all hotkeys', 'info');
        }, 2000);
    }

    

    async loadModelsFromAPI() {
        try {
            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = '<option value="loading">Loading models...</option>'; // Set loading state

            // Fetch models from Pollinations API
            console.log('Renderer: Requesting available models from main process...');
            const availableModels = await ipcRenderer.invoke('get-available-models');
            console.log('Renderer: Received models from main process:', availableModels);
            
            
            if (availableModels && availableModels.length > 0) {
                this.models = availableModels;
                modelSelect.innerHTML = ''; // Clear loading option
                this.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = typeof model.name === 'string' ? model.name : model.id;
                    modelSelect.appendChild(option);
                });
                // Set default selected model to openai
                this.selectedModel = 'openai'; // Default to openai model
                
                // Log available models for debugging
                console.log('Available model IDs:', this.models.map(m => m.id));
                
                // Try to find openai model (check various possible IDs)
                const openaiModel = this.models.find(m => 
                    m.id === 'openai' || 
                    m.id === 'gpt-4' || 
                    m.id === 'openai-gpt' ||
                    m.id.toLowerCase().includes('openai') ||
                    m.id.toLowerCase().includes('gpt')
                );
                
                if (openaiModel) {
                    this.selectedModel = openaiModel.id;
                    modelSelect.value = openaiModel.id;
                    console.log('Selected OpenAI model:', openaiModel.id);
                } else if (this.models.length > 0) {
                    // Fallback to first available model
                    this.selectedModel = this.models[0].id;
                    modelSelect.value = this.selectedModel;
                    console.log('OpenAI model not found, using:', this.selectedModel);
                }
            } else {
                // Fallback to default models if API fails or returns empty
                this.models = [{ id: 'openai', name: 'OpenAI GPT-4 (Default)', provider: 'OpenAI' }];
                modelSelect.innerHTML = '';
                const option = document.createElement('option');
                option.value = 'openai';
                option.textContent = 'OpenAI GPT-4 (Default)';
                modelSelect.appendChild(option);
                this.selectedModel = 'openai';
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = 'openai';
            option.textContent = 'OpenAI GPT-4 (Error Loading)';
            modelSelect.appendChild(option);
            this.selectedModel = 'openai';
        }
    }

    // Removed getModelIcon as it's no longer needed for the native select

    // Removed setupCustomSelect as it's no longer needed for the native select
    setupCustomSelect() {}

    setupEventListeners() {
        // Model select dropdown
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
            ipcRenderer.invoke('set-model-from-window', this.selectedModel);
            const selectedModelName = this.models.find(m => m.id === this.selectedModel)?.name || this.selectedModel;
            this.showToast(`\uD83E\uDD16 Model switched to ${selectedModelName}`, 'info');
        });

        // Utility buttons
        document.getElementById('uploadResumeBtn').addEventListener('click', () => this.handleUploadResume());
        document.getElementById('analyzeScreenBtn').addEventListener('click', () => this.handleAnalyzeScreen());
        document.getElementById('systemSoundBtn').addEventListener('click', () => this.toggleSystemSound());
        document.getElementById('micBtn').addEventListener('click', () => this.toggleMicrophone());
        document.getElementById('endSessionBtn').addEventListener('click', () => this.handleEndSession());
        document.getElementById('clearBtn').addEventListener('click', () => this.handleClearTranscription());
        
        // Action buttons
        const generateBtn = document.getElementById('generateBtn');
        const sendBtn = document.getElementById('sendBtn');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.handleGenerateAnswer());
        }
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendMessage());
        }

        // Input fields
        const companyInput = document.querySelector('.company-input');
        const jobInput = document.querySelector('.job-input');
        const questionInput = document.getElementById('questionInput');

        companyInput.addEventListener('input', (e) => {
            this.companyName = e.target.value;
        });

        jobInput.addEventListener('input', (e) => {
            this.jobDescription = e.target.value;
        });

        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.showHotkeyLegend();
            }
        });
    }

    setupIPCListeners() {
        ipcRenderer.on('system-sound-toggled', (event, isEnabled) => {
            this.isSystemSoundOn = isEnabled;
            const systemSoundBtn = document.getElementById('systemSoundBtn');
            systemSoundBtn.classList.toggle('active', isEnabled);
            this.updateTranscriptionState();
            this.showToast(`🔊 System Sound ${isEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
        
        // Handle system audio capture start/stop requests from main process
        ipcRenderer.on('start-system-audio-capture', async () => {
            console.log('Renderer: Starting system audio capture...');
            try {
                await this.startSystemAudioCapture();
            } catch (error) {
                console.error('Renderer: Failed to start system audio capture:', error);
                ipcRenderer.send('system-audio-error', error.message);
            }
        });
        
        ipcRenderer.on('stop-system-audio-capture', () => {
            console.log('Renderer: Stopping system audio capture...');
            this.stopSystemAudioCapture();
        });

        ipcRenderer.on('microphone-toggled', (event, isEnabled) => {
            this.isMicOn = isEnabled;
            const micBtn = document.getElementById('micBtn');
            micBtn.classList.toggle('active', isEnabled);
            this.updateTranscriptionState();
            this.showToast(`\uD83C\uDFA4 Microphone ${isEnabled ? 'enabled' : 'disabled'}`, 'info');
        });

        ipcRenderer.on('analyze-screen-triggered', () => {
            this.handleAnalyzeScreen();
        });

        ipcRenderer.on('focus-question-input', () => {
            const questionInput = document.getElementById('questionInput');
            questionInput.focus();
            questionInput.select();
            this.showToast('\uD83D\uDCAD Question input focused', 'info');
        });

        ipcRenderer.on('clear-listening-area', () => {
            this.handleClearTranscription();
            this.showToast('\uD83E\uDDF9 Listening area cleared', 'info');
        });

        ipcRenderer.on('ai-response', (event, response) => {
            this.showToast('\u2705 AI response generated!', 'success');
            console.log('AI Response:', response);
        });

        // Handle transcription display from audio services
        ipcRenderer.on('display-transcription', (event, transcription) => {
            const transcriptionEl = document.getElementById('transcriptionText');
            if (transcriptionEl && transcription) {
                if (transcriptionEl.textContent === 'Listening...' || transcriptionEl.textContent === 'Audio functionality disabled - Use manual input or screen analysis...') {
                    transcriptionEl.textContent = '';
                }
                transcriptionEl.textContent += ` ${transcription}`;
                transcriptionEl.classList.add('active');
                transcriptionEl.classList.remove('listening');
                this.currentQuestion = transcriptionEl.textContent;
            }
        });

        // Handle streaming response chunks
        ipcRenderer.on('stream-response-chunk', (event, data) => {
            console.log('Received streaming chunk:', data.chunk);
            // The response window will handle displaying chunks
        });

        // Handle streaming response completion
        ipcRenderer.on('stream-response-complete', (event, data) => {
            console.log('Streaming response completed:', data.fullResponse);
            this.showToast('\u2705 AI response completed!', 'success');
        });

        // Handle streaming response errors
        ipcRenderer.on('stream-response-error', (event, data) => {
            console.error('Streaming response error:', data.error);
            this.showToast('\u274C AI response failed', 'error');
        });
    }

    // Button functionality implementations
    async handleUploadResume() {
        try {
            this.showToast('\uD83D\uDCC4 Opening file dialog...', 'info');
            
            // Send IPC message to main process to open file dialog
            const result = await ipcRenderer.invoke('open-file-dialog', {
                filters: [
                    { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled) {
                this.showToast('\uD83D\uDCC4 Upload cancelled', 'warning');
                return;
            }

            const filePath = result.filePaths[0];
            this.showToast('\uD83D\uDCC4 Processing resume...', 'info');

            // Send file to main process for processing
            const resumeData = await ipcRenderer.invoke('process-resume', filePath);
            
            if (resumeData.error) {
                throw new Error(resumeData.error);
            }

            this.showToast('\u2705 Resume uploaded successfully!', 'success');
            console.log('Resume processed:', resumeData);
            

        } catch (error) {
            console.error('Resume upload failed:', error);
            this.showToast('\u274C Resume upload failed', 'error');
        }
    }

    async handleAnalyzeScreen() {
        if (this.isGeneratingResponse) return; // Prevent multiple triggers

        try {
            this.isGeneratingResponse = true;
            const analyzeBtn = document.getElementById('analyzeScreenBtn');
            analyzeBtn.classList.add('active');

            this.showToast('\uD83D\uDC41\uFE0F Capturing screen and preparing for AI analysis...', 'info');
            
            // Request screen capture from main process
            const screenData = await ipcRenderer.invoke('capture-screen');
            
            if (screenData.error) {
                throw new Error(screenData.error);
            }

            this.showToast('\uD83D\uDD0D Sending image to AI and generating answer...', 'info');

            // Trigger the full analysis and response generation in the main process
            // The main process will handle showing the loading state and streaming to the response window
            await ipcRenderer.invoke('analyze-screen-and-respond', screenData.thumbnail);
            
            this.showToast('\u2705 AI response streamed to response window!', 'success');

        } catch (error) {
            console.error('Screen analysis and response failed:', error);
            this.showToast('\u274C Failed to analyze screen and generate response', 'error');
        } finally {
            this.isGeneratingResponse = false;
            const analyzeBtn = document.getElementById('analyzeScreenBtn');
            analyzeBtn.classList.remove('active');
        }
    }

    toggleSystemSound() {
        console.log('Renderer: Toggling system sound...');
        
        // Toggle the state and notify main process
        ipcRenderer.send('toggle-system-sound', !this.isSystemSoundOn);
        
        // Start/stop audio monitoring
        if (!this.isSystemSoundOn) {
            this.startAudioMonitoring();
        } else {
            this.stopAudioMonitoring();
        }
        
        // The main process will send back 'system-sound-toggled' event to update UI
    }

    toggleMicrophone() {
        console.log('⚠️ Microphone functionality has been completely disabled');
        
        // Always keep disabled
        this.isMicOn = false;
        const micBtn = document.getElementById('micBtn');
        micBtn.classList.remove('active');
        
        this.showToast('\u274C Microphone functionality has been permanently disabled', 'warning');
        
        // Notify main process (but it will ignore the request)
        ipcRenderer.send('toggle-microphone', false);
    }

    handleEndSession() {
        this.showToast('\uD83D\uDC4B Ending session...', 'info');
        // Clean up any active transcription
        this.stopMicrophoneTranscription();
        this.stopSystemAudioTranscription();
        ipcRenderer.send('end-session');
    }

    handleClearTranscription() {
        const transcriptionEl = document.getElementById('transcriptionText');
        transcriptionEl.textContent = 'Audio functionality disabled - Use manual input or screen analysis...';
        transcriptionEl.classList.remove('active', 'listening');
        this.currentQuestion = '';
        this.showToast('\uD83E\uDDF9 Transcription cleared', 'info');
    }

    async handleGenerateAnswer() {
        if (this.isGeneratingResponse) return;

        try {
            this.isGeneratingResponse = true;
            const generateBtn = document.getElementById('generateBtn');
            const originalHTML = generateBtn.innerHTML;

            generateBtn.innerHTML = '<span class="material-icons spinning">auto_awesome</span>Generating...';
            generateBtn.disabled = true;

            const transcriptionEl = document.getElementById('transcriptionText');
            const currentQuestion = transcriptionEl.textContent.replace(/"/g, '').trim();

            if (!currentQuestion || currentQuestion === 'Audio functionality disabled - Use manual input or screen analysis...') {
                this.showToast('\u26A0\uFE0F No question to answer. Try asking something first.', 'warning');
                return;
            }

            const context = {
                company: this.companyName || 'Unknown Company',
                jobDescription: this.jobDescription || 'Software Developer',
                question: currentQuestion,
                model: this.selectedModel
            };

            this.showToast('\uD83E\uDD16 Generating AI response...', 'info');

            // Send clear response event to response window before generating new content
            ipcRenderer.send('clear-response-window');

            const response = await ipcRenderer.invoke('generate-ai-response', context);

            if (response.error) {
                throw new Error(response.error);
            }

            this.showToast('\uD83E\uDD16 Generating AI response...', 'info');
            // The main process will handle showing and updating the response window for streaming
            // No need to call showResponseWindow here directly for the final response

        } catch (error) {
            
            this.showToast('\u274C Failed to generate response', 'error');
        } finally {
            this.isGeneratingResponse = false;
            const generateBtn = document.getElementById('generateBtn');
            generateBtn.innerHTML = '<span class="material-icons">auto_awesome</span>Generate Answer';
            generateBtn.disabled = false;
        }
    }

    async handleSendMessage() {
        const questionInput = document.getElementById('questionInput');
        const message = questionInput.value.trim();

        if (!message) {
            this.showToast('\u26A0\uFE0F Please enter a question', 'warning');
            questionInput.focus();
            return;
        }

        try {
            this.showToast('\uD83D\uDCAC Processing question...', 'info');

            // Update transcription with user's question
            const transcriptionEl = document.getElementById('transcriptionText');
            transcriptionEl.textContent = `"${message}"`;
            transcriptionEl.classList.add('active');
            this.currentQuestion = message;

            // Clear input
            questionInput.value = '';

            // Auto-generate response after a short delay
            setTimeout(() => {
                this.handleGenerateAnswer();
            }, 500);

        } catch (error) {
            console.error('Message sending failed:', error);
            this.showToast('\u274C Failed to process message', 'error');
        }
    }

    updateTranscriptionState() {
        const transcriptionEl = document.getElementById('transcriptionText');
        const isListening = this.isMicOn || this.isSystemSoundOn;

        if (isListening) {
            if (transcriptionEl.textContent === '' || 
                transcriptionEl.textContent === 'Audio functionality disabled - Use manual input or screen analysis...') {
                transcriptionEl.textContent = 'Listening...';
            }
            transcriptionEl.classList.remove('active');
            transcriptionEl.classList.add('listening');
            
        } else {
            if (!this.currentQuestion) {
                transcriptionEl.textContent = 'Audio functionality disabled - Use manual input or screen analysis...';
            }
            transcriptionEl.classList.remove('listening');
            
        }
    }

    startRealTranscription() {
        // Start actual speech recognition
        if (this.isMicOn) {
            this.startMicrophoneTranscription();
        }
        if (this.isSystemSoundOn) {
            this.startSystemAudioTranscription();
        }
    }

    initializeMicrophoneTranscription() {
        // The display-transcription listener is already set up in setupIPCListeners()
        console.log('Microphone transcription listener initialized');
    }

    async startSystemAudioCapture() {
        try {
            console.log('Renderer: Starting system audio capture...');
            console.log('Renderer: Browser:', navigator.userAgent);
            console.log('Renderer: Platform:', navigator.platform);
            console.log('Renderer: Running in Electron:', !!window.electron);
            
            // Reset audio monitoring counters
            this.audioDataReceived = 0;
            this.lastAudioActivity = 0;
            
            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('getDisplayMedia is not supported in this browser');
            }
            
            // Show detailed instructions
            this.showAudioCaptureInstructions();
            
            // Method 1: Try getDisplayMedia with audio (modern approach)
            try {
                console.log('Renderer: Trying Method 1 - getDisplayMedia with audio constraints...');
                
                // Show user what to expect
                this.showToast('🎯 Select "Share system audio" when prompted!', 'info');
                
                this.systemAudioStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        mediaSource: 'screen',
                        width: { max: 1 },
                        height: { max: 1 }
                    },
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 44100
                    }
                });
                
                // Detailed audio track analysis
                const audioTracks = this.systemAudioStream.getAudioTracks();
                const videoTracks = this.systemAudioStream.getVideoTracks();
                
                console.log('Renderer: Stream details:');
                console.log('  - Audio tracks:', audioTracks.length);
                console.log('  - Video tracks:', videoTracks.length);
                
                if (audioTracks.length > 0) {
                    audioTracks.forEach((track, index) => {
                        console.log(`  - Audio Track ${index}:`, {
                            label: track.label,
                            kind: track.kind,
                            enabled: track.enabled,
                            muted: track.muted,
                            readyState: track.readyState,
                            settings: track.getSettings()
                        });
                    });
                } else {
                    throw new Error('No audio tracks in display media stream - user may not have selected "Share system audio"');
                }
                
                console.log('Renderer: Method 1 successful - Audio tracks found:', audioTracks.length);
                
            } catch (displayMediaError) {
                console.log('Renderer: Method 1 failed:', displayMediaError.message);
                console.log('Renderer: Method 1 error details:', displayMediaError);

                // Method 2: Attempt to get audio from main process (Electron-specific)
                try {
                    console.log('Renderer: Trying Method 2 - IPC to main process for audio sources...');
                    
                    // Get available audio sources from main process
                    const sources = await ipcRenderer.invoke('get-audio-sources');
                    if (!sources || sources.length === 0) {
                        throw new Error('No audio sources returned from main process');
                    }
                    
                    console.log('Renderer: Received audio sources from main:', sources);
                    
                    // Find system audio source (heuristic)
                    const systemAudioSource = sources.find(s => 
                        s.name.toLowerCase().includes('system') || 
                        s.name.toLowerCase().includes('loopback') || 
                        s.name.toLowerCase().includes('stereo mix')
                    );
                    
                    if (!systemAudioSource) {
                        throw new Error('Could not identify a system audio source');
                    }
                    
                    console.log('Renderer: Selected system audio source:', systemAudioSource);
                    
                    // Request stream from main process with selected source ID
                    this.systemAudioStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: systemAudioSource.id
                            }
                        },
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop'
                            }
                        }
                    });

                    const audioTracks = this.systemAudioStream.getAudioTracks();
                    if (audioTracks.length === 0) {
                        throw new Error('No audio tracks in stream from main process source');
                    }

                    console.log('Renderer: Method 2 successful - Audio stream acquired from main process');

                } catch (ipcError) {
                    console.log('Renderer: Method 2 failed:', ipcError.message);
                    console.log('Renderer: Method 2 error details:', ipcError);

                    // Removed demonstration mode - throw error if all methods fail
                    throw new Error('All audio capture methods failed');
                }
            }
            
            // Set up audio processing (common for all methods)
            const audioContext = new AudioContext();
            const audioSource = audioContext.createMediaStreamSource(this.systemAudioStream);
            
            // Create a script processor to handle audio data
            this.systemAudioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            this.systemAudioProcessor.onaudioprocess = (event) => {
                const inputBuffer = event.inputBuffer;
                const outputBuffer = event.outputBuffer;
                
                // Copy input to output (passthrough)
                for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                    const inputData = inputBuffer.getChannelData(channel);
                    const outputData = outputBuffer.getChannelData(channel);
                    for (let sample = 0; sample < inputBuffer.length; sample++) {
                        outputData[sample] = inputData[sample];
                    }
                }
                
                // Send audio data to main process for processing
                const audioData = inputBuffer.getChannelData(0);
                const audioArray = Array.from(audioData);
                
                // Calculate RMS for debugging
                const rms = Math.sqrt(audioArray.reduce((sum, sample) => sum + sample * sample, 0) / audioArray.length);
                
                // Log audio levels for debugging
                console.log(`Audio RMS level: ${rms.toFixed(5)}`);
                this.updateAudioDebugInfo(rms);
                
                // Only send if there's significant audio activity
                if (rms > 0.001) { // Lower threshold for demo mode
                    this.audioDataReceived++;
                    this.lastAudioActivity = Date.now();
                    
                    ipcRenderer.send('system-audio-data', {
                        data: audioArray,
                        sampleRate: audioContext.sampleRate,
                        timestamp: Date.now()
                    });
                    
                    console.log(`Sent audio data chunk #${this.audioDataReceived}, RMS: ${rms.toFixed(5)}`);
                }
            };
            
            // Connect the audio graph (no output to speakers to avoid feedback)
            audioSource.connect(this.systemAudioProcessor);
            // Removed: this.systemAudioProcessor.connect(audioContext.destination); // This was causing feedback
            
            // Listen for track ending (if available)
            const audioTracks = this.systemAudioStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.addEventListener('ended', () => {
                    console.log('Renderer: Audio track ended');
                    this.stopSystemAudioCapture();
                    ipcRenderer.send('system-audio-error', 'Audio track ended');
                });
            });
            
            console.log('Renderer: System audio capture started successfully');
            ipcRenderer.send('system-audio-started');
            
        } catch (error) {
            console.error('Renderer: System audio capture failed completely:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('Permission denied. Please allow screen/audio sharing to capture system audio.');
            } else {
                throw new Error(`System audio capture failed: ${error.message}. This may be due to system limitations or browser restrictions.`);
            }
        }
    }
    
    stopSystemAudioCapture() {
        try {
            console.log('Renderer: Stopping system audio capture...');
            
            if (this.systemAudioProcessor) {
                this.systemAudioProcessor.disconnect();
                this.systemAudioProcessor = null;
            }
            
            if (this.systemAudioStream) {
                this.systemAudioStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.systemAudioStream = null;
            }
            
            console.log('Renderer: System audio capture stopped');
            ipcRenderer.send('system-audio-stopped');
            
        } catch (error) {
            console.error('Renderer: Error stopping system audio capture:', error);
        }
    }
    
    async startSystemAudioTranscription() {
        console.log('⚠️ System audio transcription functionality has been completely disabled');
        this.showToast('\u274C System audio functionality has been permanently disabled', 'warning');
    }

    

    stopMicrophoneTranscription() {
        console.log('⚠️ Microphone transcription functionality has been completely disabled');
        // No actual stopping needed since functionality is disabled
    }

    stopSystemAudioTranscription() {
        console.log('⚠️ System audio transcription functionality has been completely disabled');
        // No actual stopping needed since functionality is disabled
    }

    addHotkeyIndicators() {
        const hotkeyHints = {
            'systemSoundBtn': 'Shift+S',
            'micBtn': 'Ctrl+Q',
            'analyzeScreenBtn': 'Ctrl+A',
            'clearBtn': 'Ctrl+Shift+C',
            'generateBtn': 'Ctrl+Z'
        };

        Object.entries(hotkeyHints).forEach(([btnId, hotkey]) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.title += ` (${hotkey})`;
            }
        });

        const questionInput = document.getElementById('questionInput');
        if (questionInput) {
            questionInput.placeholder += ' (Ctrl+I to focus, Enter to submit)';
        }
    }

    showToast(message, type = 'info') {
        // Add to queue
        this.toastQueue.push({ message, type });
        
        // Process queue if not already showing a toast
        if (!this.isShowingToast) {
            this.processToastQueue();
        }
    }

    processToastQueue() {
        if (this.toastQueue.length === 0) {
            this.isShowingToast = false;
            return;
        }

        this.isShowingToast = true;
        const { message, type } = this.toastQueue.shift();

        // Remove current toast if exists
        if (this.currentToast && document.body.contains(this.currentToast)) {
            document.body.removeChild(this.currentToast);
        }

        const toast = document.createElement('div');
        const colors = {
            error: '#ff4757',
            success: '#00c896',
            warning: '#ffa502',
            info: '#00d4ff'
        };

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 300px;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        `;
        toast.textContent = message;
        this.currentToast = toast;

        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove and process next
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.style.transform = 'translateX(-100%)';
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        document.body.removeChild(toast);
                    }
                    this.processToastQueue(); // Process next toast
                }, 300);
            } else {
                this.processToastQueue(); // Process next toast
            }
        }, 3000);
    }

    toggleModelWindow() {
        // Send IPC message to main process to toggle model window
        ipcRenderer.send('toggle-model-window');
        this.showToast('\uD83E\uDD16 Model window toggled (Ctrl+M)', 'info');
    }

    

    


    

    

    showHotkeyLegend() {
        const legend = document.createElement('div');
        legend.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 20px;
            border-radius: 12px;
            font-size: 14px;
            font-family: monospace;
            z-index: 10000;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            max-width: 400px;
            line-height: 1.6;
        `;

        legend.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #00d4ff; text-align: center;">\uD83C\uDFB9 Hotkey Reference</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Shift+S</strong><span>System Sound On/Off</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+Z</strong><span>Generate AI Answer</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+X</strong><span>Hide/Show Window</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+Q</strong><span>Microphone On/Off</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+A</strong><span>Analyze Screen</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+I</strong><span>Focus Input</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Enter</strong><span>Submit Question</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+Shift+C</strong><span>Clear Area</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+Shift+.</strong><span>Move Left</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+Shift+,</strong><span>Move Right</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+-</strong><span>Decrease Size</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+=</strong><span>Increase Size</span></div>
            <div style="text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);
                 color: #888; font-size: 12px;">Click anywhere to close</div>
        `;

        document.body.appendChild(legend);

        legend.addEventListener('click', () => {
            document.body.removeChild(legend);
        });

        setTimeout(() => {
            if (document.body.contains(legend)) {
                document.body.removeChild(legend);
            }
            }, 10000);
    }

    // Audio monitoring and debugging methods
    startAudioMonitoring() {
        console.log('Renderer: Starting audio monitoring...');
        
        // Reset counters
        this.audioDataReceived = 0;
        this.lastAudioActivity = 0;
        
        // Show audio debug info
        this.showAudioDebugWindow();
        
        // Start periodic logging
        this.audioDebugInterval = setInterval(() => {
            const timeSinceLastActivity = Date.now() - this.lastAudioActivity;
            console.log(`Audio Monitor - Chunks received: ${this.audioDataReceived}, Last activity: ${timeSinceLastActivity}ms ago`);
            
            // Show toast every 10 seconds if no audio activity
            if (timeSinceLastActivity > 10000 && this.audioDataReceived === 0) {
                this.showToast('🔇 No audio detected - check system audio is playing', 'warning');
            }
        }, 5000);
    }
    
    stopAudioMonitoring() {
        console.log('Renderer: Stopping audio monitoring...');
        
        if (this.audioDebugInterval) {
            clearInterval(this.audioDebugInterval);
            this.audioDebugInterval = null;
        }
        
        // Hide debug window
        this.hideAudioDebugWindow();
        
        // Final stats
        console.log(`Audio Monitor Summary - Total chunks received: ${this.audioDataReceived}`);
    }
    
    updateAudioDebugInfo(rms) {
        // Update debug window if it exists
        const debugWindow = document.getElementById('audioDebugWindow');
        if (debugWindow) {
            const rmsDisplay = debugWindow.querySelector('.rms-value');
            const chunksDisplay = debugWindow.querySelector('.chunks-count');
            const activityDisplay = debugWindow.querySelector('.last-activity');
            
            if (rmsDisplay) {
                rmsDisplay.textContent = rms.toFixed(5);
                // Color code RMS level
                if (rms > 0.01) {
                    rmsDisplay.style.color = '#00ff00'; // Green for high
                } else if (rms > 0.001) {
                    rmsDisplay.style.color = '#ffff00'; // Yellow for medium
                } else {
                    rmsDisplay.style.color = '#ff0000'; // Red for low
                }
            }
            
            if (chunksDisplay) {
                chunksDisplay.textContent = this.audioDataReceived;
            }
            
            if (activityDisplay) {
                const timeSince = this.lastAudioActivity ? Date.now() - this.lastAudioActivity : 'Never';
                activityDisplay.textContent = typeof timeSince === 'number' ? `${timeSince}ms ago` : timeSince;
            }
        }
    }
    
    showAudioDebugWindow() {
        // Remove existing debug window if present
        this.hideAudioDebugWindow();
        
        const debugWindow = document.createElement('div');
        debugWindow.id = 'audioDebugWindow';
        debugWindow.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            border: 1px solid rgba(255, 255, 255, 0.3);
            min-width: 250px;
            backdrop-filter: blur(10px);
        `;
        
        debugWindow.innerHTML = `
            <div style="margin-bottom: 10px; color: #00d4ff; font-weight: bold;">🎧 Audio Debug Monitor</div>
            <div style="margin: 5px 0;">RMS Level: <span class="rms-value" style="font-weight: bold;">0.00000</span></div>
            <div style="margin: 5px 0;">Chunks Sent: <span class="chunks-count" style="font-weight: bold;">0</span></div>
            <div style="margin: 5px 0;">Last Activity: <span class="last-activity" style="font-weight: bold;">Never</span></div>
            <div style="margin-top: 10px; font-size: 10px; color: #888;">Real-time audio capture monitoring</div>
        `;
        
        document.body.appendChild(debugWindow);
        
        // Make it draggable (simple version)
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        debugWindow.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragOffset.x = e.clientX - debugWindow.offsetLeft;
            dragOffset.y = e.clientY - debugWindow.offsetTop;
            debugWindow.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                debugWindow.style.left = (e.clientX - dragOffset.x) + 'px';
                debugWindow.style.top = (e.clientY - dragOffset.y) + 'px';
                debugWindow.style.right = 'auto';
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            debugWindow.style.cursor = 'grab';
        });
        
        debugWindow.style.cursor = 'grab';
    }
    
    hideAudioDebugWindow() {
        const debugWindow = document.getElementById('audioDebugWindow');
        if (debugWindow && document.body.contains(debugWindow)) {
            document.body.removeChild(debugWindow);
        }
    }
    
    showAudioCaptureInstructions() {
        const instructions = document.createElement('div');
        instructions.id = 'audioCaptureInstructions';
        instructions.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 25px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 10001;
            backdrop-filter: blur(20px);
            border: 2px solid #00d4ff;
            box-shadow: 0 8px 32px rgba(0, 212, 255, 0.3);
            max-width: 500px;
            line-height: 1.6;
            animation: slideIn 0.3s ease;
        `;
        
        instructions.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 24px; margin-bottom: 10px;">🎧</div>
                <h3 style="margin: 0; color: #00d4ff; font-size: 18px;">System Audio Capture</h3>
            </div>
            
            <div style="margin-bottom: 15px; padding: 15px; background: rgba(0, 212, 255, 0.1); border-radius: 8px; border-left: 4px solid #00d4ff;">
                <strong>⚠️ IMPORTANT:</strong> When the browser prompts you to share your screen:
                <ol style="margin: 10px 0 0 20px; padding: 0;">
                    <li>Select the screen/window you want to share</li>
                    <li><strong>✅ CHECK the "Share system audio" or "Share audio" checkbox</strong></li>
                    <li>Click "Share"</li>
                </ol>
            </div>
            
            <div style="margin-bottom: 20px;">
                <strong>🎯 What to expect:</strong>
                <ul style="margin: 10px 0 0 20px; padding: 0;">
                    <li>Browser permission prompt will appear</li>
                    <li>Select your main screen or the window with audio</li>
                    <li>Make sure audio checkbox is checked!</li>
                    <li>Audio debug monitor will show real-time levels</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <button id="proceedWithCapture" style="
                    background: #00d4ff;
                    color: black;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-right: 10px;
                ">I Understand - Proceed</button>
                <button id="cancelCapture" style="
                    background: transparent;
                    color: white;
                    border: 1px solid #666;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                ">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(instructions);
        
        // Handle buttons
        instructions.querySelector('#proceedWithCapture').addEventListener('click', () => {
            document.body.removeChild(instructions);
        });
        
        instructions.querySelector('#cancelCapture').addEventListener('click', () => {
            document.body.removeChild(instructions);
            this.stopSystemAudioCapture();
            this.showToast('❌ Audio capture cancelled', 'warning');
        });
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            if (document.body.contains(instructions)) {
                document.body.removeChild(instructions);
            }
        }, 10000);
    }
    
}

// Initialize the controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MockMateController();
});
