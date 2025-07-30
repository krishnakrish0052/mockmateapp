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
            const prompt = this.buildPrompt(context);
            
            // Optimized request configuration
            const requestBody = {
                model: this.models[this.selectedModel] || this.selectedModel,
                messages: [
                    {
                        role: "system",
                        content: `You are an expert interview coach providing concise, accurate answers. Keep responses under 150 words, focused, and directly relevant to the question asked.`
                    },
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
                headers,
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

    async transcribeAudio(audioBuffer) {
        try {
            const audioBase64 = audioBuffer.toString('base64');

            const requestBody = {
                model: 'openai-audio',
                audio: `data:audio/wav;base64,${audioBase64}`
            };

            const response = await axios.post(this.openaiEndpoint, requestBody, {
                headers: this.getAuthHeaders(),
                timeout: 30000, // 30 seconds timeout for transcription
            });

            return this.formatResponse(response.data);
        } catch (error) {
            console.error('Audio transcription error:', error);
            throw new Error('Failed to transcribe audio: ' + error.message);
        }
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

    buildPrompt(context) {
        let prompt = '';

        // Add context information
        if (context.company) {
            prompt += `Company: ${context.company}\n`;
        }
        if (context.jobDescription) {
            prompt += `Job Description: ${context.jobDescription}\n`;
        }
        if (context.industry) {
            prompt += `Industry: ${context.industry}\n`;
        }
        if (context.resumeSkills) {
            prompt += `Relevant Skills: ${context.resumeSkills.join(', ')}\n`;
        }

        // Detect question type if not provided
        const questionType = context.isBehavioral !== undefined ? 
            (context.isBehavioral ? 'Behavioral' : 'Technical') : 
            this.detectQuestionType(context.question);

        prompt += `\nInterview Question (${questionType}): ${context.question}\n\n`;

        // Enhanced prompt template based on question type
        if (questionType === 'Behavioral') {
            prompt += this.getBehavioralPromptTemplate(context);
        } else {
            prompt += this.getTechnicalPromptTemplate(context);
        }

        return prompt;
    }

    detectQuestionType(question) {
        const behavioralKeywords = [
            'tell me about a time', 'describe a situation', 'give me an example',
            'how did you handle', 'what would you do if', 'how do you deal with',
            'describe your experience', 'tell me about yourself', 'why do you want',
            'how do you work', 'describe a challenge', 'conflict', 'leadership',
            'teamwork', 'failure', 'success', 'difficult', 'pressure'
        ];

        const technicalKeywords = [
            'algorithm', 'code', 'programming', 'technical', 'system design',
            'database', 'api', 'framework', 'language', 'architecture',
            'performance', 'optimization', 'debugging', 'testing', 'deployment',
            'how would you implement', 'explain how', 'what is the difference',
            'compare', 'pros and cons'
        ];

        const lowerQuestion = question.toLowerCase();
        
        const behavioralScore = behavioralKeywords.reduce((score, keyword) => 
            lowerQuestion.includes(keyword) ? score + 1 : score, 0);
        
        const technicalScore = technicalKeywords.reduce((score, keyword) => 
            lowerQuestion.includes(keyword) ? score + 1 : score, 0);

        return behavioralScore > technicalScore ? 'Behavioral' : 'Technical';
    }

    getBehavioralPromptTemplate(context) {
        return `Using the STAR method (Situation, Task, Action, Result), provide a compelling behavioral response that demonstrates:
        - Clear context and situation
        - Specific task or challenge faced
        - Concrete actions you took
        - Measurable results or outcomes
        
        Make the response authentic, specific, and relevant to ${context.company || 'the role'}. Draw from professional experiences that showcase leadership, problem-solving, or teamwork skills.`;
    }

    getTechnicalPromptTemplate(context) {
        return `Provide a comprehensive technical response that includes:
        - Clear explanation of concepts
        - Step-by-step approach or methodology
        - Best practices and considerations
        - Real-world application examples
        
        Tailor your answer to match the technical requirements ${context.jobDescription ? 'mentioned in the job description' : 'for the role'}. Use specific technologies, frameworks, or methodologies where appropriate.`;
    }

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
            const prompt = this.buildPrompt(context);
            const encodedPrompt = encodeURIComponent(prompt);
            console.log('Sending request to Fallback GET endpoint:', `${this.textBaseURL}/${encodedPrompt}`);
            const params = {
                model: this.models[this.selectedModel] || this.selectedModel,
                seed: Math.floor(Math.random() * 1000),
                private: true,
                system: encodeURIComponent('You are an expert interview coach providing concise answers.')
            };
            console.log('Request Params:', params);
            const headers = {
                'User-Agent': 'MockMate-AI/1.0.4'
            };
            console.log('Request Headers:', headers);
            
            const response = await axios.get(`${this.textBaseURL}/${encodedPrompt}`, {
                params: params,
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

        if (process.env.POLLINATION_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.POLLINATION_API_KEY}`;
        }

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
