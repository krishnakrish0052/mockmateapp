const fs = require('fs');
const path = require('path');

class OCRService {
    constructor() {
        this.providers = {
            tesseract: null
        };
        
        // OCR Configuration
        this.config = {
            tesseract: {
                language: 'eng',
                options: {
                    logger: m => console.log('Tesseract:', m.status, m.progress),
                    errorHandler: err => console.error('Tesseract Error:', err)
                },
                psm: 6, // Page segmentation mode: uniform block of text
                oem: 3  // OCR Engine Mode: default
            }
        };
        
        // Initialize available providers
        this.initializeProviders();
        
        // Question detection patterns
        this.questionPatterns = {
            direct: [
                /^(?:what|how|why|when|where|who|which|whose|whom)\s+/i,
                /^(?:can|could|would|will|should|do|does|did|is|are|was|were)\s+/i,
                /^(?:tell me|describe|explain|discuss|give me)\s+/i,
                /\?$/
            ],
            behavioral: [
                /tell me about a time/i,
                /describe a situation/i,
                /give me an example/i,
                /walk me through/i,
                /how did you handle/i,
                /what would you do if/i,
                /share an experience/i
            ],
            technical: [
                /how would you implement/i,
                /what is the difference between/i,
                /explain how.*works/i,
                /what are the pros and cons/i,
                /how do you optimize/i,
                /what is.*complexity/i,
                /design a system/i
            ]
        };
        
        // Performance tracking
        this.performanceStats = {
            tesseract: { calls: 0, totalTime: 0, errors: 0 },
            azure: { calls: 0, totalTime: 0, errors: 0 },
            google: { calls: 0, totalTime: 0, errors: 0 },
            aws: { calls: 0, totalTime: 0, errors: 0 }
        };
    }

    async initializeProviders() {
        // Initialize Tesseract.js (offline OCR)
        try {
            this.providers.tesseract = require('tesseract.js');
            console.log('✅ Tesseract.js initialized');
        } catch (error) {
            console.log('⚠️ Tesseract.js not available:', error.message);
        }
    }

    async performOCR(imageInput, options = {}) {
        const startTime = Date.now();
        const provider = options.provider || this.selectBestProvider();
        
        console.log(`[OCRService] performOCR: Starting OCR with provider: ${provider}`);
        console.log(`[OCRService] performOCR: Input type: ${typeof imageInput}, options:`, options);
        
        try {
            let result;
            
            switch (provider) {
                case 'tesseract':
                    result = await this.useTesseract(imageInput, options);
                    break;
            }
            
            const duration = Date.now() - startTime;
            this.updatePerformanceStats(provider, duration, false);
            
            // Post-process the result
            const processedResult = await this.postProcessOCRResult(result, options);
            
            console.log(`[OCRService] performOCR: OCR completed in ${duration}ms with ${provider}. Result length: ${processedResult.text.length}`);
            return processedResult;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.updatePerformanceStats(provider, duration, true);
            
            console.error(`[OCRService] performOCR: OCR failed with ${provider}:`, error.message);
            
            // Try fallback provider if available
            if (options.enableFallback !== false) {
                const fallbackProvider = this.getFallbackProvider(provider);
                if (fallbackProvider) {
                    console.log(`[OCRService] performOCR: Trying fallback provider: ${fallbackProvider}`);
                    return await this.performOCR(imageInput, { 
                        ...options, 
                        provider: fallbackProvider, 
                        enableFallback: false 
                    });
                }
            }
            
            throw error;
        }
    }

    async useTesseract(imageInput, options = {}) {
        console.log(`[OCRService] useTesseract: Attempting Tesseract OCR.`);
        if (!this.providers.tesseract) {
            console.error(`[OCRService] useTesseract: Tesseract.js not available.`);
            throw new Error('Tesseract.js not available');
        }

        const tesseractOptions = {
            ...this.config.tesseract.options,
            ...options.tesseractOptions
        };
        console.log(`[OCRService] useTesseract: Tesseract options:`, tesseractOptions);

        try {
            const { data: { text, confidence, words, paragraphs } } = await this.providers.tesseract.recognize(
                imageInput,
                this.config.tesseract.language,
                tesseractOptions
            );
            console.log(`[OCRService] useTesseract: Tesseract OCR successful. Confidence: ${confidence}, Text length: ${text.length}`);
            return {
                provider: 'tesseract',
                text: text.trim(),
                confidence: confidence / 100, // Convert to 0-1 scale
                words: words,
                paragraphs: paragraphs,
                metadata: {
                    language: this.config.tesseract.language,
                    psm: this.config.tesseract.psm,
                    oem: this.config.tesseract.oem
                }
            };
        } catch (error) {
            console.error(`[OCRService] useTesseract: Tesseract OCR failed:`, error);
            throw error;
        }
    }

    

    async postProcessOCRResult(result, options = {}) {
        const processedResult = {
            ...result,
            processedText: this.cleanText(result.text),
            questions: [],
            questionTypes: [],
            confidence: result.confidence
        };

        // Extract potential questions
        if (options.extractQuestions !== false) {
            processedResult.questions = this.extractQuestions(processedResult.processedText);
            processedResult.questionTypes = this.classifyQuestions(processedResult.questions);
        }

        // Apply text corrections
        if (options.applyCorrections !== false) {
            processedResult.correctedText = this.applyCommonCorrections(processedResult.processedText);
        }

        // Extract structured data
        if (options.extractStructuredData) {
            processedResult.structuredData = this.extractStructuredData(processedResult.processedText);
        }

        return processedResult;
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
            .replace(/[^\w\s\.\?\!\,\:\;\-\(\)]/g, '') // Remove special characters except basic punctuation
            .trim();
    }

    applyCommonCorrections(text) {
        const corrections = {
            // Common OCR mistakes
            '0': 'o', // Zero to letter O
            '1': 'l', // One to letter L
            '5': 'S', // Five to letter S
            '8': 'B', // Eight to letter B
            // Add more corrections as needed
        };

        let correctedText = text;
        Object.entries(corrections).forEach(([wrong, correct]) => {
            // Apply corrections in word boundaries to avoid over-correction
            const regex = new RegExp(`\\b${wrong}\\b`, 'g');
            correctedText = correctedText.replace(regex, correct);
        });

        return correctedText;
    }

    extractQuestions(text) {
        const questions = [];
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

        sentences.forEach(sentence => {
            // Check if sentence matches question patterns
            const isQuestion = this.questionPatterns.direct.some(pattern => pattern.test(sentence));
            
            if (isQuestion || sentence.includes('?')) {
                const cleanQuestion = sentence.replace(/^[^a-zA-Z]+/, '').trim();
                if (cleanQuestion.length > 10 && cleanQuestion.length < 200) {
                    questions.push(cleanQuestion);
                }
            }
        });

        // Remove duplicates and return
        return [...new Set(questions)];
    }

    classifyQuestions(questions) {
        return questions.map(question => {
            const lowerQuestion = question.toLowerCase();
            
            let type = 'general';
            let confidence = 0;

            // Check for behavioral questions
            const behavioralMatch = this.questionPatterns.behavioral.some(pattern => pattern.test(lowerQuestion));
            if (behavioralMatch) {
                type = 'behavioral';
                confidence = 0.8;
            }

            // Check for technical questions
            const technicalMatch = this.questionPatterns.technical.some(pattern => pattern.test(lowerQuestion));
            if (technicalMatch) {
                type = 'technical';
                confidence = 0.8;
            }

            // Check for direct questions
            const directMatch = this.questionPatterns.direct.some(pattern => pattern.test(lowerQuestion));
            if (directMatch && type === 'general') {
                type = 'direct';
                confidence = 0.6;
            }

            return {
                question: question,
                type: type,
                confidence: confidence
            };
        });
    }

    extractStructuredData(text) {
        const data = {
            emails: [],
            urls: [],
            dates: [],
            times: [],
            numbers: []
        };

        // Extract emails
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        data.emails = text.match(emailPattern) || [];

        // Extract URLs
        const urlPattern = /https?:\/\/[^\s]+/g;
        data.urls = text.match(urlPattern) || [];

        // Extract dates (simple patterns)
        const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
        data.dates = text.match(datePattern) || [];

        // Extract times
        const timePattern = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?\b/g;
        data.times = text.match(timePattern) || [];

        // Extract numbers
        const numberPattern = /\b\d+(?:\.\d+)?\b/g;
        data.numbers = text.match(numberPattern) || [];

        return data;
    }

    selectBestProvider() {
        // Always use Tesseract as the primary provider
        if (this.providers.tesseract !== null) {
            return 'tesseract';
        }
        throw new Error('Tesseract OCR not available');
    }

    getFallbackProvider(failedProvider) {
        const allProviders = ['tesseract', 'azure', 'google', 'aws'];
        const availableProviders = allProviders.filter(provider => 
            provider !== failedProvider && this.isProviderAvailable(provider)
        );

        return availableProviders.length > 0 ? availableProviders[0] : null;
    }

    isProviderAvailable(provider) {
        switch (provider) {
            case 'tesseract':
                return this.providers.tesseract !== null;
            default:
                return false;
        }
    }

    updatePerformanceStats(provider, duration, isError) {
        if (this.performanceStats[provider]) {
            this.performanceStats[provider].calls++;
            this.performanceStats[provider].totalTime += duration;
            if (isError) {
                this.performanceStats[provider].errors++;
            }
        }
    }

    getPerformanceStats() {
        const stats = {};
        
        Object.entries(this.performanceStats).forEach(([provider, data]) => {
            if (data.calls > 0) {
                stats[provider] = {
                    calls: data.calls,
                    averageTime: Math.round(data.totalTime / data.calls),
                    totalTime: data.totalTime,
                    errors: data.errors,
                    errorRate: (data.errors / data.calls * 100).toFixed(2) + '%',
                    available: this.isProviderAvailable(provider)
                };
            }
        });

        return stats;
    }

    // Batch OCR processing for multiple images
    async performBatchOCR(imageInputs, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 5;
        
        for (let i = 0; i < imageInputs.length; i += batchSize) {
            const batch = imageInputs.slice(i, i + batchSize);
            
            const batchPromises = batch.map((imageInput, index) => 
                this.performOCR(imageInput, {
                    ...options,
                    batchIndex: i + index
                }).catch(error => ({
                    error: error.message,
                    batchIndex: i + index
                }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches to avoid rate limiting
            if (i + batchSize < imageInputs.length && options.batchDelay) {
                await new Promise(resolve => setTimeout(resolve, options.batchDelay));
            }
        }

        return results;
    }

    // Health check for all providers
    async healthCheck() {
        const health = {};

        for (const provider of Object.keys(this.providers)) {
            try {
                const isAvailable = this.isProviderAvailable(provider);
                health[provider] = {
                    available: isAvailable,
                    status: isAvailable ? 'healthy' : 'unavailable',
                    lastChecked: new Date().toISOString()
                };

                if (isAvailable) {
                    // You could add actual health check calls here
                    health[provider].responseTime = 'N/A'; // Placeholder
                }
            } catch (error) {
                health[provider] = {
                    available: false,
                    status: 'error',
                    error: error.message,
                    lastChecked: new Date().toISOString()
                };
            }
        }

        return health;
    }
}

module.exports = OCRService;
