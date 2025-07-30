const axios = require('axios');

// Make tesseract.js optional since it might not be installed
let Tesseract = null;
try {
    Tesseract = require('tesseract.js');
} catch (error) {
    console.log('OCR functionality disabled: tesseract.js not installed');
}

class AIService {
    constructor() {
        this.selectedModel = 'openai';
        this.textBaseURL = 'https://text.pollinations.ai';
        this.imageBaseURL = 'https://image.pollinations.ai';
        this.openaiEndpoint = 'https://text.pollinations.ai/openai';
        
        // Updated model mappings based on latest API documentation
        this.models = {
            'openai': 'openai',
            'openai-large': 'openai-large', 
            'claude-hybridspace': 'claude-hybridspace',
            'mistral': 'mistral',
            'gemini-pro': 'gemini-pro',
            'llama-3-70b': 'llama-3-70b',
            'mixtral-8x7b': 'mixtral-8x7b',
            'searchgpt': 'searchgpt',
            'openai-audio': 'openai-audio'
        };
        
        // Text-to-speech functionality has been disabled
        
        // Cache for available models from API
        this.availableModels = null;
        this.modelsLastFetched = null;
    }

    setModel(model) {
        this.selectedModel = model;
    }

    async generateResponse(context, onChunk = null) {
        try {
            // The prompt is now directly provided in context.prompt
            const prompt = context.prompt;
            
            // Optimized request configuration
            const requestBody = {
                model: this.models[this.selectedModel] || this.selectedModel,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 400, // Reduced for even faster initial response
                stream: onChunk !== null,
                private: true
            };
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': onChunk ? 'text/event-stream' : 'application/json',
                'Cache-Control': 'no-cache'
            };
            
            const startTime = Date.now();
            const response = await fetch(this.openaiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(15000) // Reduced timeout for faster failure
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/event-stream')) {
                return await this._processStreamOptimized(response.body.getReader(), onChunk, startTime);
            } else {
                const jsonData = await response.json();
                let content = this._extractContent(jsonData);
                
                if (onChunk && content) {
                    // Simulate streaming for non-streaming responses to maintain consistency
                    this._simulateStreaming(content, onChunk);
                }
                
                return { 
                    response: content, 
                    model: this.selectedModel, 
                    timestamp: new Date().toISOString(),
                    responseTime: Date.now() - startTime
                };
            }
        } catch (error) {
            console.error('AI Service Error:', error);
            return await this.generateResponseFallback(context);
        }
    }

    async transcribeAudio(audioBuffer, audioFormat = null) {
        try {
            // Validate audio buffer
            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Invalid audio buffer: empty or null');
            }
            
            const audioBase64 = audioBuffer.toString('base64');
            const audioSizeMB = (audioBase64.length * 0.75) / (1024 * 1024); // Approximate size in MB
            
            console.log(`AIService: Audio buffer size: ${audioSizeMB.toFixed(2)} MB`);
            
            // Check if audio is too large (limit to 10MB for API)
            if (audioSizeMB > 10) {
                console.warn(`Audio file too large: ${audioSizeMB.toFixed(2)} MB. API limit is typically 10MB.`);
                return await this.transcribeAudioFallback(audioBuffer);
            }
            
            // Detect audio format from buffer or use provided format
            const detectedFormat = audioFormat || this.detectAudioFormat(audioBuffer);
            console.log(`AIService: Detected/provided audio format: ${detectedFormat}`);
            
            // Validate format is supported
            const supportedFormats = ['mp3', 'wav', 'm4a', 'flac', 'webm'];
            if (!supportedFormats.includes(detectedFormat.toLowerCase())) {
                console.warn(`Unsupported audio format: ${detectedFormat}. Supported formats: ${supportedFormats.join(', ')}`);
                return await this.transcribeAudioFallback(audioBuffer);
            }
            
            // Get STT model from environment variable, default to 'openai-audio'
            const sttModel = process.env.STT_MODEL || 'openai-audio';
            console.log(`AIService: Using STT model for transcription: ${sttModel}`);

            // Ensure we're using the correct model for audio transcription
            if (sttModel !== 'openai-audio') {
                console.warn(`Model ${sttModel} may not support audio transcription. Switching to openai-audio.`);
            }

            // Following Pollinations API documentation for audio transcription
            const requestBody = {
                model: 'openai-audio', // Force use of openai-audio for transcription
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Transcribe this:' }, // Simplified prompt as per docs
                            {
                                type: 'input_audio',
                                input_audio: {
                                    data: audioBase64,
                                    format: detectedFormat.toLowerCase()
                                }
                            }
                        ]
                    }
                ]
            };

            console.log(`AIService: Sending transcription request with format: ${detectedFormat}`);
            console.log(`AIService: Request payload structure:`, {
                model: requestBody.model,
                messageType: typeof requestBody.messages[0].content[1],
                audioDataLength: audioBase64.length,
                format: detectedFormat
            });
            
            const response = await axios.post(this.openaiEndpoint, requestBody, {
                headers: this.getAuthHeaders(),
                timeout: 45000, // Increased timeout for larger files
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            console.log(`AIService: Transcription successful with ${requestBody.model} model`);
            return this.formatResponse(response.data);
        } catch (error) {
            console.error('Audio transcription error:', error);
            
            // Log more detailed error information
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
                console.error('Response headers:', error.response.headers);
                
                // Check for specific error messages
                const errorDetails = error.response.data?.details?.error;
                if (errorDetails) {
                    console.error('API Error Details:', {
                        message: errorDetails.message,
                        type: errorDetails.type,
                        param: errorDetails.param,
                        code: errorDetails.code
                    });
                }
            }
            
            // Check for specific error types
            if (error.response && error.response.status === 402) {
                console.log('Audio model requires higher tier - attempting fallback');
                return await this.transcribeAudioFallback(audioBuffer);
            } else if (error.response && error.response.status === 400) {
                const errorMsg = error.response.data?.details?.error?.message || '';
                if (errorMsg.includes('format') || errorMsg.includes('unsupported')) {
                    console.log('Unsupported format error - attempting format conversion fallback');
                    return await this.transcribeAudioWithFormatFallback(audioBuffer);
                } else {
                    console.log('Bad request error - attempting fallback');
                    return await this.transcribeAudioFallback(audioBuffer);
                }
            } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                console.log('Request timeout - attempting fallback');
                return await this.transcribeAudioFallback(audioBuffer);
            }
            
            // For any other error, try fallback
            console.log('Unknown transcription error - attempting fallback');
            return await this.transcribeAudioFallback(audioBuffer);
        }
    }

    // Detect audio format from buffer magic bytes
    detectAudioFormat(audioBuffer) {
        try {
            // Check magic bytes to detect audio format
            const header = audioBuffer.subarray(0, 12);
            
            // WAV format: starts with "RIFF" and contains "WAVE"
            if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
                header[8] === 0x57 && header[9] === 0x41 && header[10] === 0x56 && header[11] === 0x45) {
                return 'wav';
            }
            
            // MP3 format: starts with "ID3" or has MP3 frame sync
            if ((header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) || // ID3
                (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0)) { // MP3 frame sync
                return 'mp3';
            }
            
            // M4A/AAC format: starts with ftyp box
            if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
                return 'm4a';
            }
            
            // FLAC format: starts with "fLaC"
            if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) {
                return 'flac';
            }
            
            // WebM format: starts with EBML header
            if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
                return 'webm';
            }
            
            // Default to WAV if format cannot be detected
            console.warn('Could not detect audio format from buffer, defaulting to WAV');
            return 'wav';
        } catch (error) {
            console.error('Error detecting audio format:', error);
            return 'wav'; // Safe default
        }
    }

    // Fallback method for format conversion attempts
    async transcribeAudioWithFormatFallback(audioBuffer) {
        console.log('Attempting transcription with different format assumptions...');
        
        // Try different common formats
        const formatsToTry = ['wav', 'mp3', 'm4a'];
        
        for (const format of formatsToTry) {
            try {
                console.log(`Trying transcription with format: ${format}`);
                const result = await this.transcribeAudio(audioBuffer, format);
                
                // If we get a successful result (not a fallback), return it
                if (result && !result.error) {
                    console.log(`Successfully transcribed with format: ${format}`);
                    return result;
                }
            } catch (error) {
                console.log(`Format ${format} failed, trying next...`);
                continue;
            }
        }
        
        // If all formats fail, return the standard fallback
        console.log('All format attempts failed, using standard fallback');
        return await this.transcribeAudioFallback(audioBuffer);
    }

    async transcribeAudioFallback(audioBuffer) {
        console.log("Audio transcription fallback: Text-based models cannot process audio data.");
        
        // Return a helpful message instead of trying to send audio data to a text model
        const fallbackMessage = "I'm sorry, but I cannot transcribe audio at the moment. The audio transcription service is currently unavailable. Please try again later or consider typing your question instead.";
        
        return {
            response: fallbackMessage,
            text: fallbackMessage,
            model: `fallback-${this.selectedModel}`,
            timestamp: new Date().toISOString(),
            confidence: 0, // No confidence since we cannot actually transcribe
            error: 'Audio transcription service unavailable'
        };
    }

    async analyzeImageWithPrompt(imageUrl, prompt, onChunk = null) {
        try {
            const requestBody = {
                model: 'openai', // Vision-capable model
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageUrl }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                stream: onChunk !== null,
                private: true
            };

            const startTime = Date.now();
            const response = await fetch(this.openaiEndpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(30000) // 30 seconds timeout for analysis
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/event-stream')) {
                return await this._processStreamOptimized(response.body.getReader(), onChunk, startTime);
            } else {
                const jsonData = await response.json();
                let content = this._extractContent(jsonData);
                
                if (onChunk && content) {
                    this._simulateStreaming(content, onChunk);
                }
                
                return { 
                    response: content, 
                    model: this.selectedModel, 
                    timestamp: new Date().toISOString(),
                    responseTime: Date.now() - startTime
                };
            }
        } catch (error) {
            console.error('Image analysis error:', error);
            throw new Error('Failed to analyze image: ' + error.message);
        }
    }

    // Optimized stream processing to stream character-by-character for a smoother typing effect
    async _processStreamOptimized(reader, onChunk = null, startTime) {
        let accumulatedContent = '';
        let buffer = '';
        const decoder = new TextDecoder('utf-8');

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        
                        if (data === '[DONE]') {
                            return { response: accumulatedContent, model: this.selectedModel, timestamp: new Date().toISOString(), responseTime: Date.now() - startTime };
                        }

                        if (data) {
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || json.content || '';
                                
                                if (content) {
                                    accumulatedContent += content;
                                    if (onChunk) {
                                        // Stream each character individually for the typing effect
                                        for (const char of content) {
                                            onChunk({ content: char, model: this.selectedModel, timestamp: new Date().toISOString() });
                                        }
                                    }
                                }
                            } catch (parseError) {
                                console.warn('Stream parse error (non-critical):', parseError.message);
                            }
                        }
                    }
                }
            }
            return { response: accumulatedContent, model: this.selectedModel, timestamp: new Date().toISOString(), responseTime: Date.now() - startTime };
        } catch (error) {
            console.error('Stream processing error:', error);
            throw error;
        }
    }

    // Legacy stream processing method (kept for fallback)
    async _processStream(reader, onChunk = null) {
        console.warn('Using legacy stream processing - consider upgrading');
        return this._processStreamOptimized(reader, onChunk, Date.now());
    }

    _extractContent(jsonData) {
        if (jsonData.choices && jsonData.choices[0]) {
            return jsonData.choices[0].message?.content || jsonData.choices[0].text || '';
        } else if (jsonData.response) {
            return jsonData.response;
        } else if (jsonData.text) {
            return jsonData.text;
        }
        return '';
    }

    _simulateStreaming(content, onChunk) {
        const chars = content.split('');
        let accumulated = '';
        chars.forEach((char, index) => {
            setTimeout(() => {
                accumulated += char;
                onChunk({ 
                    content: char, 
                    model: this.selectedModel, 
                    timestamp: new Date().toISOString(),
                    accumulated: accumulated,
                    isFinal: index === chars.length - 1
                });
            }, index * 10); // Shortened delay for faster typing effect
        });
    }

    // Removed _processBuffer as its logic is now integrated into _processStream

    

    formatResponse(rawResponse) {
        // Handle different response formats from Pollination API
        let content = '';
        
        if (typeof rawResponse === 'string') {
            content = rawResponse;
        } else if (rawResponse.choices && rawResponse.choices[0]) {
            content = rawResponse.choices[0].message?.content || rawResponse.choices[0].text;
        } else if (rawResponse.content) {
            content = rawResponse.content;
        } else if (rawResponse.response) {
            content = rawResponse.response;
        } else if (rawResponse.text) {
            content = rawResponse.text;
        } else {
            content = JSON.stringify(rawResponse);
        }

        return {
            response: content, // Changed from 'content' to 'response' to match expected format
            text: content,     // Also provide 'text' for compatibility
            model: this.selectedModel,
            timestamp: new Date().toISOString(),
            confidence: this.calculateConfidence(content)
        };
    }

    calculateConfidence(content) {
        // Simple confidence calculation based on content length and structure
        const length = content.length;
        const hasStructure = content.includes('\n') && (content.includes('1.') || content.includes('##') || content.includes('**'));
        const hasCodeBlocks = content.includes('```') || content.includes('`');
        
        let confidence = 85; // Base confidence
        
        if (length > 500) confidence += 5;
        if (length > 1000) confidence += 5;
        if (hasStructure) confidence += 3;
        if (hasCodeBlocks) confidence += 2;
        
        return Math.min(99, confidence);
    }

    async performOCR(imageBuffer) {
        if (!Tesseract) {
            throw new Error('OCR functionality is not available - tesseract.js not installed');
        }
        
        try {
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: m => console.log(m)
            });
            return text;
        } catch (error) {
            console.error('OCR Error:', error);
            throw new Error('Failed to perform OCR: ' + error.message);
        }
    }

    async extractQuestion(text) {
        try {
            // Use AI to identify and extract the most likely interview question
            const prompt = `
            Analyze the following text and extract the most likely interview question from it. 
            Look for questions that start with common interview patterns like:
            - "Tell me about..."
            - "How would you..."
            - "What is..."
            - "Explain..."
            - "Describe..."
            - "Why..."
            - "When..."
            
            Text to analyze:
            ${text}
            
            Return only the question text, nothing else. If no clear question is found, return "No clear question detected".
            `;

            const response = await axios.post(this.openaiEndpoint, {
                messages: [
                    {
                        role: "system",
                        content: "You are a text analyzer that extracts interview questions from text."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: this.models[this.selectedModel],
                seed: 42
            }, {
                headers: this.getAuthHeaders(),
                timeout: 15000
            });

            let extractedText = '';
            if (typeof response.data === 'string') {
                extractedText = response.data;
            } else if (response.data.choices && response.data.choices[0]) {
                extractedText = response.data.choices[0].message?.content || response.data.choices[0].text;
            }

            return extractedText.trim();
        } catch (error) {
            console.error('Question extraction error:', error);
            // Fallback: Simple regex-based extraction
            return this.simpleQuestionExtraction(text);
        }
    }

    simpleQuestionExtraction(text) {
        // Fallback method using regex patterns
        const questionPatterns = [
            /(?:Tell me about|How would you|What is|Explain|Describe|Why|When|Where|Who)[^.!?]*[.!?]/gi,
            /[A-Z][^.!?]*\?/g,
            /\d+\.\s*[A-Z][^.!?]*[.!?]/g
        ];

        for (const pattern of questionPatterns) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {
                return matches[0].trim();
            }
        }

        return 'No clear question detected';
    }

    async getAvailableModels() {
        try {
            const fetchedModels = await this.fetchAvailableModels();
            
            if (!Array.isArray(fetchedModels)) {
                console.error('fetchAvailableModels did not return an array:', fetchedModels);
                return [];
            }

            // Check if the first element is a string (model ID) or an object
            if (fetchedModels.length > 0 && typeof fetchedModels[0] === 'string') {
                // Case 1: fetchedModels is an array of strings (model IDs)
                return fetchedModels.map(modelId => ({
                    id: modelId,
                    name: this.getModelDisplayName(modelId),
                    provider: this.getModelProvider(modelId)
                }));
            } else if (fetchedModels.length > 0 && typeof fetchedModels[0] === 'object' && fetchedModels[0].name) {
                // Case 2: fetchedModels is already an array of objects with name (and optionally id)
                return fetchedModels.map(model => {
                    const modelId = model.id || model.name; // Use 'id' if available, otherwise use 'name'
                    const modelIdString = String(modelId); // Ensure modelId is a string
                    return {
                        id: modelIdString,
                        name: this.getModelDisplayName(modelIdString),
                        provider: this.getModelProvider(modelIdString)
                    };
                });
            } else {
                // Fallback for unexpected format
                console.warn('Unexpected format for fetched models:', fetchedModels);
                return [];
            }
        } catch (error) {
            console.error('Error in getAvailableModels:', error);
            return [];
        }
    }

    getModelDisplayName(modelId) {
        const displayNames = {
            'gemini-pro': 'Gemini Pro',
            'gpt-4-turbo': 'GPT-4 Turbo',
            'claude-3.5': 'Claude 3.5 Sonnet',
            'llama-3': 'Llama 3 70B',
            'mixtral': 'Mixtral 8x7B'
        };
        return displayNames[modelId] || modelId;
    }

    getModelProvider(modelId) {
        const providers = {
            'openai': 'OpenAI',
            'openai-large': 'OpenAI',
            'claude-hybridspace': 'Anthropic',
            'mistral': 'Mistral AI',
            'gemini-pro': 'Google',
            'llama-3-70b': 'Meta',
            'mixtral-8x7b': 'Mistral AI',
            'searchgpt': 'Pollinations',
            'openai-audio': 'OpenAI'
        };
        return providers[modelId] || 'Unknown';
    }

    // Fallback method using GET endpoint
    async generateResponseFallback(context) {
        try {
            const prompt = context.prompt;
    
            console.log('Sending request to Fallback POST endpoint:', this.textBaseURL);
    
            const requestBody = {
                prompt: prompt,
                model: this.models[this.selectedModel] || this.selectedModel,
                seed: Math.floor(Math.random() * 1000),
                private: true,
                system: 'You are an expert interview coach providing concise answers.'
            };
            
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'MockMate-AI/1.0.4'
            };
            
            // Use POST instead of GET to avoid URI too large errors for long prompts.
            const response = await axios.post(this.textBaseURL, requestBody, { 
                headers: headers,
                timeout: 25000
            });
    
            console.log('Fallback API Response Status:', response.status);
            console.log('Fallback API Response Data:', JSON.stringify(response.data, null, 2));
    
            return this.formatResponse(response.data);
        } catch (error) {
            console.error('Fallback API Error:', error);
            throw new Error('All API endpoints failed: ' + error.message);
        }
    }

    // Fetch available models dynamically from API
    async fetchAvailableModels(forceRefresh = false) {
        const cacheValid = this.modelsLastFetched && 
            (Date.now() - this.modelsLastFetched) < 300000; // 5 minutes cache
        
        if (!forceRefresh && cacheValid && this.availableModels) {
            return this.availableModels;
        }

        try {
            console.log(`Attempting to fetch models from: ${this.textBaseURL}/models`);
            const response = await axios.get(`${this.textBaseURL}/models`, {
                headers: this.getAuthHeaders(),
                timeout: 30000
            });
            
            this.availableModels = response.data;
            this.modelsLastFetched = Date.now();
            console.log('API Response Status:', response.status);
            console.log('Raw models response from API:', this.availableModels);
            return this.availableModels;
        } catch (error) {
            console.error('Error fetching available models:', error.message);
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error('Error Response Data:', error.response.data);
                console.error('Error Response Status:', error.response.status);
                console.error('Error Response Headers:', error.response.headers);
            } else if (error.request) {
                // The request was made but no response was received
                console.error('Error Request:', error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Error Message:', error.message);
            }
            // Return cached models or fallback to hardcoded list
            return this.availableModels || Object.keys(this.models);
        }
    }

    // Generate image using Pollinations API
    async generateImage(prompt, options = {}) {
        try {
            const params = {
                width: options.width || 1024,
                height: options.height || 1024,
                model: options.model || 'flux',
                seed: options.seed || Math.floor(Math.random() * 10000),
                nologo: true,
                private: true,
                ...options
            };

            const encodedPrompt = encodeURIComponent(prompt);
            const queryString = new URLSearchParams(params).toString();
            const imageUrl = `${this.imageBaseURL}/prompt/${encodedPrompt}?${queryString}`;
            
            return {
                url: imageUrl,
                prompt: prompt,
                parameters: params
            };
        } catch (error) {
            console.error('Image generation error:', error);
            throw new Error('Failed to generate image: ' + error.message);
        }
    }

    // Text-to-Speech functionality DISABLED
    async generateSpeech(text, voice = 'nova') {
        console.log('⚠️ Text-to-Speech functionality has been completely disabled');
        throw new Error('Text-to-Speech functionality disabled');
    }

    // Vision API - analyze images
    async analyzeImage(imageUrl, question = "What's in this image?") {
        try {
            const response = await axios.post(this.openaiEndpoint, {
                model: 'openai', // Vision-capable model
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: question },
                            {
                                type: "image_url",
                                image_url: { url: imageUrl }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                private: true
            }, {
                headers: this.getAuthHeaders(),
                timeout: 30000
            });

            return this.formatResponse(response.data);
        } catch (error) {
            console.error('Vision API error:', error);
            throw new Error('Failed to analyze image: ' + error.message);
        }
    }

    // Search functionality using SearchGPT
    async searchInformation(query) {
        try {
            const encodedQuery = encodeURIComponent(query);
            
            const response = await axios.get(`${this.textBaseURL}/${encodedQuery}`, {
                params: {
                    model: 'searchgpt',
                    private: true
                },
                headers: {
                    'User-Agent': 'MockMate-AI/1.0.4'
                },
                timeout: 25000
            });

            return this.formatResponse(response.data);
        } catch (error) {
            console.error('Search API error:', error);
            throw new Error('Failed to search information: ' + error.message);
        }
    }

    // Enhanced model display names
    getModelDisplayName(modelId) {
        const displayNames = {
            'openai': 'OpenAI GPT-4',
            'openai-large': 'OpenAI GPT-4 Large',
            'claude-hybridspace': 'Claude 3 Hybrid',
            'mistral': 'Mistral 7B',
            'gemini-pro': 'Gemini Pro',
            'llama-3-70b': 'Llama 3 70B',
            'mixtral-8x7b': 'Mixtral 8x7B',
            'searchgpt': 'SearchGPT',
            'openai-audio': 'OpenAI Audio'
        };
        return displayNames[modelId] || modelId;
    }

    // Get authentication headers
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'MockMate-AI/1.0.4'
        };

        // Add Authorization header if API key is available
        if (process.env.POLLINATION_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.POLLINATION_API_KEY}`;
        }

        // Add Referer header for tier authentication based on Pollinations API docs
        // This helps identify the application/domain for tier access
        headers['Referer'] = process.env.POLLINATION_REFERER || 'https://pollinations.ai/';
        
        // Add additional headers for seed tier access
        headers['Accept'] = 'application/json';
        headers['Cache-Control'] = 'no-cache';

        return headers;
    }

    // Health check for API
    async healthCheck() {
        try {
            const models = await this.fetchAvailableModels();
            return {
                status: 'healthy',
                modelsAvailable: Array.isArray(models) ? models.length : 0,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = AIService;
