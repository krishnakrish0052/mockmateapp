class QuestionDetectionService {
    constructor(aiService = null, ocrService = null) {
        this.aiService = aiService;
        this.ocrService = ocrService;
        
        // Question classification patterns
        this.patterns = {
            behavioral: {
                keywords: [
                    'tell me about a time', 'describe a situation', 'give me an example',
                    'walk me through', 'how did you handle', 'what would you do if',
                    'share an experience', 'can you think of', 'have you ever',
                    'describe your experience', 'give me a specific example'
                ],
                indicators: [
                    'situation', 'task', 'action', 'result', 'star method',
                    'challenge', 'conflict', 'problem', 'difficulty', 'success',
                    'failure', 'leadership', 'teamwork', 'collaboration'
                ],
                weight: 0.8
            },
            technical: {
                keywords: [
                    'how would you implement', 'what is the difference between',
                    'explain how', 'what are the pros and cons', 'how do you optimize',
                    'what is the complexity', 'design a system', 'code this',
                    'solve this problem', 'algorithm', 'data structure'
                ],
                indicators: [
                    'algorithm', 'complexity', 'optimization', 'performance',
                    'scaling', 'architecture', 'design pattern', 'database',
                    'api', 'framework', 'library', 'programming', 'coding'
                ],
                weight: 0.9
            },
            general: {
                keywords: [
                    'what', 'how', 'why', 'when', 'where', 'who', 'which',
                    'tell me', 'describe', 'explain', 'discuss'
                ],
                indicators: [
                    'experience', 'background', 'skills', 'knowledge',
                    'opinion', 'thoughts', 'perspective', 'approach'
                ],
                weight: 0.6
            },
            company: {
                keywords: [
                    'why do you want to work here', 'what do you know about',
                    'why this company', 'what attracts you', 'our culture',
                    'our values', 'our mission', 'our products'
                ],
                indicators: [
                    'company', 'organization', 'culture', 'values', 'mission',
                    'products', 'services', 'industry', 'market', 'competition'
                ],
                weight: 0.7
            },
            personal: {
                keywords: [
                    'tell me about yourself', 'your strengths', 'your weaknesses',
                    'where do you see yourself', 'your goals', 'your motivation',
                    'what drives you', 'your passion', 'your interests'
                ],
                indicators: [
                    'strengths', 'weaknesses', 'goals', 'motivation', 'passion',
                    'interests', 'hobbies', 'personality', 'character', 'values'
                ],
                weight: 0.7
            }
        };
        
        // Performance tracking
        this.stats = {
            totalQuestions: 0,
            successfulDetections: 0,
            classificationAccuracy: 0,
            averageConfidence: 0,
            processingTime: 0
        };
        
        // Context awareness
        this.contextHistory = [];
        this.maxContextHistory = 10;
    }

    /**
     * Detect and extract questions from text or image
     */
    async detectQuestions(input, options = {}) {
        const startTime = Date.now();
        
        try {
            let text = '';
            let metadata = {};
            
            // Handle different input types
            if (typeof input === 'string') {
                if (input.startsWith('data:image') || input.includes('base64')) {
                    // It's an image, use OCR
                    if (!this.ocrService) {
                        throw new Error('OCR service not available');
                    }
                    const ocrResult = await this.ocrService.performOCR(input, options.ocrOptions);
                    text = ocrResult.processedText || ocrResult.text;
                    metadata.ocrProvider = ocrResult.provider;
                    metadata.ocrConfidence = ocrResult.confidence;
                } else {
                    // It's plain text
                    text = input;
                }
            } else if (Buffer.isBuffer(input)) {
                // It's an image buffer, use OCR
                if (!this.ocrService) {
                    throw new Error('OCR service not available');
                }
                const ocrResult = await this.ocrService.performOCR(input, options.ocrOptions);
                text = ocrResult.processedText || ocrResult.text;
                metadata.ocrProvider = ocrResult.provider;
                metadata.ocrConfidence = ocrResult.confidence;
            } else {
                throw new Error('Unsupported input type');
            }
            
            if (!text || text.trim().length === 0) {
                return {
                    success: false,
                    questions: [],
                    metadata: { ...metadata, error: 'No text extracted from input' }
                };
            }
            
            // Extract potential questions
            const extractedQuestions = this.extractQuestions(text);
            
            // Classify questions
            const classifiedQuestions = await this.classifyQuestions(extractedQuestions, options);
            
            // Apply AI enhancement if available
            let enhancedQuestions = classifiedQuestions;
            if (this.aiService && options.useAI !== false) {
                enhancedQuestions = await this.enhanceWithAI(classifiedQuestions, text, options);
            }
            
            // Filter by confidence threshold
            const confidenceThreshold = options.confidenceThreshold || 0.5;
            const filteredQuestions = enhancedQuestions.filter(q => q.confidence >= confidenceThreshold);
            
            // Update statistics
            const processingTime = Date.now() - startTime;
            this.updateStats(filteredQuestions, processingTime);
            
            // Update context history
            this.updateContextHistory(text, filteredQuestions);
            
            return {
                success: true,
                questions: filteredQuestions,
                totalFound: extractedQuestions.length,
                afterClassification: enhancedQuestions.length,
                afterFiltering: filteredQuestions.length,
                processingTime: processingTime,
                metadata: {
                    ...metadata,
                    confidenceThreshold,
                    aiEnhanced: this.aiService && options.useAI !== false
                }
            };
            
        } catch (error) {
            console.error('Question detection error:', error);
            return {
                success: false,
                error: error.message,
                questions: [],
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Extract potential questions from text using pattern matching
     */
    extractQuestions(text) {
        const questions = [];
        const sentences = this.splitIntoSentences(text);
        
        sentences.forEach((sentence, index) => {
            const cleanSentence = this.cleanSentence(sentence);
            
            if (this.isLikelyQuestion(cleanSentence)) {
                questions.push({
                    text: cleanSentence,
                    originalText: sentence,
                    position: index,
                    source: 'pattern_matching',
                    rawConfidence: this.calculateRawConfidence(cleanSentence)
                });
            }
        });
        
        return questions;
    }

    /**
     * Split text into sentences intelligently
     */
    splitIntoSentences(text) {
        // Handle various sentence endings and edge cases
        const sentences = text
            .replace(/([.!?])\s*(?=[A-Z])/g, '$1|SPLIT|')
            .split('|SPLIT|')
            .map(s => s.trim())
            .filter(s => s.length > 10) // Minimum question length
            .filter(s => s.length < 500); // Maximum question length
        
        return sentences;
    }

    /**
     * Clean and normalize sentence
     */
    cleanSentence(sentence) {
        return sentence
            .replace(/^\d+\.\s*/, '') // Remove numbering
            .replace(/^[-•*]\s*/, '') // Remove bullets
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Check if sentence is likely a question
     */
    isLikelyQuestion(sentence) {
        const lowerSentence = sentence.toLowerCase();
        
        // Direct question indicators
        if (sentence.endsWith('?')) return true;
        
        // Question word patterns
        const questionWords = [
            /^(what|how|why|when|where|who|which|whose|whom)\s/i,
            /^(can|could|would|will|should|do|does|did|is|are|was|were)\s/i,
            /^(tell me|describe|explain|discuss|give me|walk me)\s/i
        ];
        
        return questionWords.some(pattern => pattern.test(sentence));
    }

    /**
     * Calculate raw confidence score for extracted question
     */
    calculateRawConfidence(sentence) {
        let confidence = 0.3; // Base confidence
        
        const lowerSentence = sentence.toLowerCase();
        
        // Question mark bonus
        if (sentence.endsWith('?')) confidence += 0.4;
        
        // Question word bonus
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
        if (questionWords.some(word => lowerSentence.startsWith(word))) {
            confidence += 0.3;
        }
        
        // Imperative question bonus
        const imperatives = ['tell me', 'describe', 'explain', 'discuss', 'give me'];
        if (imperatives.some(phrase => lowerSentence.startsWith(phrase))) {
            confidence += 0.2;
        }
        
        // Length penalty/bonus
        if (sentence.length < 20) confidence -= 0.1;
        if (sentence.length > 100) confidence += 0.1;
        if (sentence.length > 200) confidence -= 0.1;
        
        return Math.min(1.0, Math.max(0.0, confidence));
    }

    /**
     * Classify questions by type and calculate confidence
     */
    async classifyQuestions(questions, options = {}) {
        return questions.map(question => {
            const classification = this.classifyQuestion(question.text);
            
            return {
                ...question,
                type: classification.type,
                confidence: this.combineConfidences(question.rawConfidence, classification.confidence),
                typeConfidence: classification.confidence,
                subCategories: classification.subCategories,
                keywords: classification.matchedKeywords
            };
        });
    }

    /**
     * Classify a single question
     */
    classifyQuestion(questionText) {
        const lowerText = questionText.toLowerCase();
        const results = {};
        
        // Score against each pattern type
        Object.entries(this.patterns).forEach(([type, pattern]) => {
            let score = 0;
            const matchedKeywords = [];
            
            // Check keywords
            pattern.keywords.forEach(keyword => {
                if (lowerText.includes(keyword)) {
                    score += pattern.weight;
                    matchedKeywords.push(keyword);
                }
            });
            
            // Check indicators
            pattern.indicators.forEach(indicator => {
                if (lowerText.includes(indicator)) {
                    score += pattern.weight * 0.5;
                }
            });
            
            if (score > 0) {
                results[type] = {
                    score: Math.min(1.0, score),
                    matchedKeywords
                };
            }
        });
        
        // Find best match
        const bestMatch = Object.entries(results)
            .sort(([,a], [,b]) => b.score - a.score)[0];
        
        if (!bestMatch) {
            return {
                type: 'general',
                confidence: 0.3,
                subCategories: [],
                matchedKeywords: []
            };
        }
        
        const [type, data] = bestMatch;
        
        return {
            type: type,
            confidence: data.score,
            subCategories: this.getSubCategories(type, questionText),
            matchedKeywords: data.matchedKeywords
        };
    }

    /**
     * Get subcategories for specific question types
     */
    getSubCategories(type, questionText) {
        const lowerText = questionText.toLowerCase();
        const subCategories = [];
        
        switch (type) {
            case 'behavioral':
                if (lowerText.includes('conflict') || lowerText.includes('disagree')) {
                    subCategories.push('conflict_resolution');
                }
                if (lowerText.includes('leadership') || lowerText.includes('lead')) {
                    subCategories.push('leadership');
                }
                if (lowerText.includes('team') || lowerText.includes('collaborate')) {
                    subCategories.push('teamwork');
                }
                if (lowerText.includes('challenge') || lowerText.includes('difficult')) {
                    subCategories.push('problem_solving');
                }
                break;
                
            case 'technical':
                if (lowerText.includes('algorithm') || lowerText.includes('complexity')) {
                    subCategories.push('algorithms');
                }
                if (lowerText.includes('system') || lowerText.includes('architecture')) {
                    subCategories.push('system_design');
                }
                if (lowerText.includes('database') || lowerText.includes('sql')) {
                    subCategories.push('database');
                }
                if (lowerText.includes('code') || lowerText.includes('implement')) {
                    subCategories.push('coding');
                }
                break;
                
            case 'personal':
                if (lowerText.includes('strength')) {
                    subCategories.push('strengths');
                }
                if (lowerText.includes('weakness')) {
                    subCategories.push('weaknesses');
                }
                if (lowerText.includes('goal') || lowerText.includes('future')) {
                    subCategories.push('career_goals');
                }
                break;
        }
        
        return subCategories;
    }

    /**
     * Combine confidence scores
     */
    combineConfidences(rawConfidence, typeConfidence) {
        // Weighted average with slight bias toward type confidence
        return (rawConfidence * 0.4) + (typeConfidence * 0.6);
    }

    /**
     * Enhance questions using AI service
     */
    async enhanceWithAI(questions, originalText, options = {}) {
        if (!this.aiService || questions.length === 0) {
            return questions;
        }
        
        try {
            const prompt = this.buildAIEnhancementPrompt(questions, originalText);
            const aiResponse = await this.aiService.generateResponse({
                question: prompt,
                model: options.aiModel || 'openai'
            });
            
            const enhancedData = this.parseAIEnhancement(aiResponse.response || aiResponse.text);
            
            return this.applyAIEnhancements(questions, enhancedData);
            
        } catch (error) {
            console.error('AI enhancement failed:', error);
            return questions; // Return original questions if AI fails
        }
    }

    /**
     * Build prompt for AI enhancement
     */
    buildAIEnhancementPrompt(questions, originalText) {
        const questionList = questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n');
        
        return `Analyze the following potential interview questions extracted from text:

Original text context:
${originalText.substring(0, 500)}...

Extracted questions:
${questionList}

For each question, provide:
1. Confidence score (0-1) for whether it's actually an interview question
2. Improved question type classification (behavioral, technical, general, company, personal)
3. Any corrections to the question text if needed
4. Difficulty level (entry, mid, senior, executive)

Respond in JSON format with an array of objects containing: questionIndex, confidence, type, correctedText, difficulty, reasoning.`;
    }

    /**
     * Parse AI enhancement response
     */
    parseAIEnhancement(aiResponse) {
        try {
            // Try to extract JSON from AI response
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback: parse structured text response
            return this.parseStructuredAIResponse(aiResponse);
            
        } catch (error) {
            console.error('Failed to parse AI enhancement:', error);
            return [];
        }
    }

    /**
     * Parse structured AI response (fallback)
     */
    parseStructuredAIResponse(response) {
        const enhancements = [];
        const lines = response.split('\n');
        
        let currentEnhancement = null;
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            
            if (trimmedLine.match(/^\d+\./)) {
                if (currentEnhancement) {
                    enhancements.push(currentEnhancement);
                }
                currentEnhancement = {
                    questionIndex: parseInt(trimmedLine.match(/^(\d+)/)[1]) - 1,
                    confidence: 0.7,
                    type: 'general',
                    difficulty: 'mid'
                };
            } else if (currentEnhancement) {
                if (trimmedLine.includes('confidence') || trimmedLine.includes('score')) {
                    const scoreMatch = trimmedLine.match(/(\d+\.?\d*)/);
                    if (scoreMatch) {
                        currentEnhancement.confidence = parseFloat(scoreMatch[1]);
                        if (currentEnhancement.confidence > 1) {
                            currentEnhancement.confidence /= 100; // Convert percentage
                        }
                    }
                }
                
                if (trimmedLine.includes('type') || trimmedLine.includes('classification')) {
                    const typeMatch = trimmedLine.match(/(behavioral|technical|general|company|personal)/i);
                    if (typeMatch) {
                        currentEnhancement.type = typeMatch[1].toLowerCase();
                    }
                }
            }
        });
        
        if (currentEnhancement) {
            enhancements.push(currentEnhancement);
        }
        
        return enhancements;
    }

    /**
     * Apply AI enhancements to questions
     */
    applyAIEnhancements(questions, enhancements) {
        return questions.map((question, index) => {
            const enhancement = enhancements.find(e => e.questionIndex === index);
            
            if (enhancement) {
                return {
                    ...question,
                    confidence: this.combineConfidences(question.confidence, enhancement.confidence),
                    type: enhancement.type || question.type,
                    aiEnhanced: true,
                    aiConfidence: enhancement.confidence,
                    difficulty: enhancement.difficulty,
                    correctedText: enhancement.correctedText || question.text,
                    aiReasoning: enhancement.reasoning
                };
            }
            
            return question;
        });
    }

    /**
     * Update context history for better detection
     */
    updateContextHistory(text, questions) {
        this.contextHistory.unshift({
            text: text.substring(0, 200),
            questions: questions.length,
            timestamp: Date.now(),
            types: [...new Set(questions.map(q => q.type))]
        });
        
        // Keep only recent history
        if (this.contextHistory.length > this.maxContextHistory) {
            this.contextHistory = this.contextHistory.slice(0, this.maxContextHistory);
        }
    }

    /**
     * Update performance statistics
     */
    updateStats(questions, processingTime) {
        this.stats.totalQuestions += questions.length;
        this.stats.successfulDetections += questions.filter(q => q.confidence > 0.7).length;
        this.stats.processingTime = (this.stats.processingTime + processingTime) / 2; // Running average
        
        if (questions.length > 0) {
            const avgConfidence = questions.reduce((sum, q) => sum + q.confidence, 0) / questions.length;
            this.stats.averageConfidence = (this.stats.averageConfidence + avgConfidence) / 2;
        }
        
        if (this.stats.totalQuestions > 0) {
            this.stats.classificationAccuracy = this.stats.successfulDetections / this.stats.totalQuestions;
        }
    }

    /**
     * Get performance statistics
     */
    getStats() {
        return {
            ...this.stats,
            contextHistorySize: this.contextHistory.length,
            aiServiceAvailable: !!this.aiService,
            ocrServiceAvailable: !!this.ocrService
        };
    }

    /**
     * Get recent context for better detection
     */
    getRecentContext() {
        return this.contextHistory.slice(0, 5);
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalQuestions: 0,
            successfulDetections: 0,
            classificationAccuracy: 0,
            averageConfidence: 0,
            processingTime: 0
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            services: {
                ai: this.aiService ? 'available' : 'unavailable',
                ocr: this.ocrService ? 'available' : 'unavailable'
            },
            stats: this.getStats(),
            timestamp: new Date().toISOString()
        };
        
        // Test basic functionality
        try {
            const testResult = await this.detectQuestions('What is your name?', { useAI: false });
            health.testResult = testResult.success ? 'passed' : 'failed';
        } catch (error) {
            health.status = 'error';
            health.testError = error.message;
        }
        
        return health;
    }
}

module.exports = QuestionDetectionService;
