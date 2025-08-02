const ipcRenderer = window.electron.ipcRenderer;

console.log('Renderer: main.js loaded and executing.');

class MockMateController {
    constructor() {
        this.isMicOn = false;
        this.isSystemSoundOn = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
        this.timerInterval = null;
        
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
        
        // Audio capture service
        this.audioCaptureRenderer = null;
        
        this.init();
    }

    async init() {
        // Remove createUI() call since HTML structure already exists
        await this.loadModelsFromAPI();
        this.setupCustomSelect();
        this.setupEventListeners();
        this.setupIPCListeners();
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
        document.getElementById('micBtn').addEventListener('click', () => this.handleMicrophoneToggle());
        document.getElementById('systemSoundBtn').addEventListener('click', () => this.handleSystemSoundToggle());
        document.getElementById('analyzeScreenBtn').addEventListener('click', () => this.handleAnalyzeScreen());
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
        });
        
        // Handle transcription updates from system audio capture
        ipcRenderer.on('transcription-update', (event, transcription) => {
            console.log('Renderer: Received transcription update:', transcription);
            this.handleTranscriptionUpdate(transcription);
        });


        // Remove old renderer-based audio capture handlers - now using SystemAudioCaptureService
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


    handleEndSession() {
        this.showToast('\uD83D\uDC4B Ending session...', 'info');
        ipcRenderer.send('end-session');
    }

    handleClearTranscription() {
        const transcriptionEl = document.getElementById('transcriptionText');
        transcriptionEl.textContent = 'Listening...';
        transcriptionEl.classList.remove('active');
        this.currentQuestion = '';
        this.showToast('🧹 Transcription cleared', 'info');
    }

    handleMicrophoneToggle() {
        this.isMicOn = !this.isMicOn;
        const micBtn = document.getElementById('micBtn');
        const micIcon = micBtn.querySelector('.material-icons');
        
        if (this.isMicOn) {
            micIcon.textContent = 'mic';
            micBtn.classList.add('active');
            this.showToast('Microphone activated (disabled - no audio functionality)', 'info', 'mic');
        } else {
            micIcon.textContent = 'mic_off';
            micBtn.classList.remove('active');
            this.showToast('Microphone deactivated', 'info', 'mic_off');
        }
    }

    async handleSystemSoundToggle() {
        this.isSystemSoundOn = !this.isSystemSoundOn;
        const soundBtn = document.getElementById('systemSoundBtn');
        const soundIcon = soundBtn.querySelector('.material-icons');
        
        if (this.isSystemSoundOn) {
            soundIcon.textContent = 'volume_up';
            soundBtn.classList.add('active');
            this.showToast('🔊 System audio capture started', 'info', 'volume_up');
            this.startSystemAudioRecording();
        } else {
            soundIcon.textContent = 'volume_off';
            soundBtn.classList.remove('active');
            this.showToast('🔇 System audio capture stopped', 'info', 'volume_off');
            this.stopSystemAudioRecording();
        }
    }

    async startSystemAudioRecording() {
        const systemRecordingIndicator = document.getElementById('systemRecordingIndicator');
        const systemAudioTimer = document.getElementById('systemAudioTimer');
        const soundBtn = document.getElementById('systemSoundBtn');

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: false
            });

            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop = this.saveWebm.bind(this);
            this.mediaRecorder.onerror = (event) => {
                console.error(`System audio recording error: ${event.error}`);
                this.showToast(`❌ System audio recording error: ${event.error.name}`, 'error');
                this.stopSystemAudioRecording();
            };

            this.mediaRecorder.start();
            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this.updateSystemAudioTimer(), 1000);
            systemRecordingIndicator.classList.add('active');
            systemAudioTimer.style.display = 'block';
            soundBtn.disabled = false; // Keep button enabled to allow stopping
        } catch (error) {
            console.error('Failed to start system audio recording:', error);
            this.showToast(`❌ Failed to start system audio: ${error.message}`, 'error');
            this.isSystemSoundOn = false;
            soundBtn.querySelector('.material-icons').textContent = 'volume_off';
            soundBtn.classList.remove('active');
        }
    }

    stopSystemAudioRecording() {
        const systemRecordingIndicator = document.getElementById('systemRecordingIndicator');
        const systemAudioTimer = document.getElementById('systemAudioTimer');

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
        clearInterval(this.timerInterval);
        systemRecordingIndicator.classList.remove('active');
        systemAudioTimer.textContent = '00:00';
        systemAudioTimer.style.display = 'none';
        this.audioChunks = []; // Clear chunks after stopping
    }

    updateSystemAudioTimer() {
        const systemAudioTimer = document.getElementById('systemAudioTimer');
        const elapsed = Date.now() - this.startTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        systemAudioTimer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async saveWebm() {
        try {
            const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            
            // Send to main process for conversion and auto-saving
            const result = await window.electronAPI.writeWebm(arrayBuffer);
            if (result.success) {
                this.showToast('✅ System audio auto-saved!', 'success');
            } else {
                this.showToast(`❌ Failed to auto-save system audio: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Error saving system audio:', error);
            this.showToast(`❌ Error saving system audio: ${error.message}`, 'error');
        }
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

            if (!currentQuestion || currentQuestion === 'Listening...') {
                this.showToast('\u26A0\uFE0F No question to answer. Try asking something first.', 'warning');
                return;
            }

            const context = {
                company: this.companyName,
                jobDescription: this.jobDescription,
                question: currentQuestion,
                model: this.selectedModel,
                resumeData: this.resumeData // Ensure resumeData is passed
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

        if (!this.currentQuestion) {
            transcriptionEl.textContent = 'Listening...';
        }
		transcriptionEl.classList.remove('listening');
    }
    
    handleTranscriptionUpdate(transcription) {
        console.log('Renderer: Processing transcription update:', transcription);
        const transcriptionEl = document.getElementById('transcriptionText');
        
        if (transcription && transcription.text) {
            transcriptionEl.textContent = transcription.text;
            transcriptionEl.classList.add('active');
            this.currentQuestion = transcription.text;
            console.log('Renderer: Updated transcription display with text:', transcription.text);
        } else {
            console.warn('Renderer: Received empty or invalid transcription:', transcription);
        }
    }



    
    
    
    
    

    

    

    

    addHotkeyIndicators() {
        const hotkeyHints = {
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

    showToast(message, type = 'info', icon = null) {
        // Add to queue
        this.toastQueue.push({ message, type, icon });
        
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
        const { message, type, icon } = this.toastQueue.shift();

        // Remove current toast if exists
        if (this.currentToast && document.body.contains(this.currentToast)) {
            document.body.removeChild(this.currentToast);
        }

        const toast = document.createElement('div');
        const colors = {
            error: '#ff4757',
            success: '#00c896',
            warning: '#ffa502',
            info: 'orange'
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
        toast.innerHTML = icon ? `<span class='material-icons' style='vertical-align: middle; margin-right: 8px;'>${icon}</span>${message}` : message;
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
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+Z</strong><span>Generate AI Answer</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><strong>Ctrl+X</strong><span>Hide/Show Window</span></div>
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

    // Renderer-based audio capture methods
    async startRendererAudioCapture() {
        console.log('🎬 RENDERER: startRendererAudioCapture() method called');
        try {
            console.log('🎬 RENDERER: Starting real audio capture with AudioCaptureRenderer...');
            console.log('🎬 RENDERER: Checking if AudioCaptureRenderer is available...');
            console.log('🎬 RENDERER: window.AudioCaptureRenderer =', typeof window.AudioCaptureRenderer);
            
            // Initialize AudioCaptureRenderer if not already done
            if (!this.audioCaptureRenderer) {
                console.log('🎬 RENDERER: audioCaptureRenderer not initialized, creating new instance');
                if (typeof window.AudioCaptureRenderer === 'undefined') {
                    console.error('🎬 RENDERER: AudioCaptureRenderer not found. Make sure AudioCaptureRenderer.js is loaded.');
                    console.log('🎬 RENDERER: Available window properties:', Object.keys(window));
                    this.showToast('❌ AudioCaptureRenderer script not loaded', 'error');
                    return;
                }
                console.log('🎬 RENDERER: Creating new AudioCaptureRenderer instance');
                this.audioCaptureRenderer = new window.AudioCaptureRenderer();
                console.log('🎬 RENDERER: AudioCaptureRenderer instance created:', this.audioCaptureRenderer);
            } else {
                console.log('🎬 RENDERER: Using existing audioCaptureRenderer instance');
            }
            
            // Set up transcription callback
            console.log('🎬 RENDERER: Setting up transcription callback');
            const onTranscription = (transcription) => {
                console.log('🎬 RENDERER: Received transcription from AudioCaptureRenderer:', transcription);
                
                // Send transcription to main process
                console.log('🎬 RENDERER: Sending transcription to main process via IPC');
                ipcRenderer.send('transcription-from-renderer', transcription);
            };
            
            // Start audio capture
            console.log('🎬 RENDERER: Calling startCapture on AudioCaptureRenderer...');
            const result = await this.audioCaptureRenderer.startCapture(onTranscription);
            console.log('🎬 RENDERER: startCapture result:', result);
            
            if (result.success) {
                console.log('🎬 RENDERER: Real audio capture started successfully');
                this.showToast('🎙️ Real-time audio capture started', 'success');
            } else {
                console.error('🎬 RENDERER: Failed to start real audio capture:', result.message);
                this.showToast(`❌ Audio capture failed: ${result.message}`, 'error');
            }
            
        } catch (error) {
            console.error('🎬 RENDERER: Error starting audio capture:', error);
            console.error('🎬 RENDERER: Error stack:', error.stack);
            this.showToast('❌ Audio capture error', 'error');
        }
    }
    
    async stopRendererAudioCapture() {
        try {
            console.log('Renderer: Stopping real audio capture...');
            
            if (!this.audioCaptureRenderer) {
                console.log('Renderer: No audio capture renderer to stop');
                return;
            }
            
            const result = await this.audioCaptureRenderer.stopCapture();
            
            if (result.success) {
                console.log('Renderer: Real audio capture stopped successfully');
                this.showToast('🔇 Audio capture stopped', 'info');
            } else {
                console.error('Renderer: Failed to stop audio capture:', result.message);
                this.showToast(`❌ Stop capture failed: ${result.message}`, 'error');
            }
            
        } catch (error) {
            console.error('Renderer: Error stopping audio capture:', error);
            this.showToast('❌ Stop capture error', 'error');
        }
    }
}

// Initialize the controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MockMateController();
});
