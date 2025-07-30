const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

class DatabaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.encryptionKey = null;
        this.dbPath = null;
        this.stats = {
            questionsStored: 0,
            responsesGenerated: 0,
            sessionsCreated: 0,
            lastActivity: null
        };
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            const dataDir = path.join(os.homedir(), '.mockmate');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.dbPath = path.join(dataDir, 'mockmate.db');
            
            // Generate or load encryption key
            await this.initializeEncryption(dataDir);
            
            // Initialize database
            this.db = new Database(this.dbPath);
            
            // Enable WAL mode for better performance
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            
            // Create tables
            this.createTables();
            
            // Load existing stats
            await this.loadStats();
            
            this.isInitialized = true;
            console.log('✅ Database initialized successfully');
            
            return {
                success: true,
                dbPath: this.dbPath,
                stats: this.stats
            };
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    async initializeEncryption(dataDir) {
        const keyPath = path.join(dataDir, '.key');
        
        try {
            if (fs.existsSync(keyPath)) {
                // Load existing key
                const keyData = fs.readFileSync(keyPath);
                this.encryptionKey = keyData.toString('hex');
            } else {
                // Generate new encryption key
                this.encryptionKey = crypto.randomBytes(32).toString('hex');
                fs.writeFileSync(keyPath, Buffer.from(this.encryptionKey, 'hex'), { mode: 0o600 });
            }
        } catch (error) {
            console.error('Encryption initialization failed:', error);
            throw error;
        }
    }

    createTables() {
        // Sessions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                company_name TEXT,
                job_description TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                status TEXT DEFAULT 'active',
                model_used TEXT,
                total_questions INTEGER DEFAULT 0,
                total_responses INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Questions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                question_text TEXT NOT NULL,
                question_type TEXT DEFAULT 'unknown',
                confidence_score REAL DEFAULT 0.0,
                source TEXT DEFAULT 'manual',
                detected_at INTEGER DEFAULT (strftime('%s', 'now')),
                context TEXT,
                is_answered BOOLEAN DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (session_id) REFERENCES sessions (session_id)
            )
        `);

        // AI Responses table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ai_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                response_text TEXT NOT NULL,
                model_used TEXT NOT NULL,
                response_time INTEGER,
                token_count INTEGER,
                confidence_score REAL DEFAULT 0.0,
                user_rating INTEGER,
                is_used BOOLEAN DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (question_id) REFERENCES questions (id),
                FOREIGN KEY (session_id) REFERENCES sessions (session_id)
            )
        `);

        // User preferences table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                data_type TEXT DEFAULT 'string',
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Resume data table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS resume_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                file_path TEXT,
                content TEXT NOT NULL,
                skills TEXT,
                experience TEXT,
                education TEXT,
                uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Analytics table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                event_data TEXT,
                session_id TEXT,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Create indexes for better performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
            CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
            CREATE INDEX IF NOT EXISTS idx_responses_question ON ai_responses(question_id);
            CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type);
            CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);
        `);
    }

    // Session Management
    async createSession(sessionData = {}) {
        try {
            const sessionId = this.generateSessionId();
            const now = Date.now();
            
            const stmt = this.db.prepare(`
                INSERT INTO sessions (session_id, company_name, job_description, start_time, model_used)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                sessionId,
                sessionData.companyName || null,
                sessionData.jobDescription || null,
                now,
                sessionData.model || 'google'
            );
            
            this.stats.sessionsCreated++;
            this.stats.lastActivity = now;
            await this.saveStats();
            
            await this.logEvent('session_created', { sessionId, ...sessionData });
            
            return {
                success: true,
                sessionId,
                id: result.lastInsertRowid
            };
        } catch (error) {
            console.error('Create session failed:', error);
            throw error;
        }
    }

    async getSession(sessionId) {
        try {
            const stmt = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?');
            const session = stmt.get(sessionId);
            
            if (session) {
                // Get related questions and responses
                const questions = await this.getSessionQuestions(sessionId);
                const responses = await this.getSessionResponses(sessionId);
                
                return {
                    ...session,
                    questions,
                    responses,
                    questionCount: questions.length,
                    responseCount: responses.length
                };
            }
            
            return null;
        } catch (error) {
            console.error('Get session failed:', error);
            throw error;
        }
    }

    async updateSession(sessionId, updates) {
        try {
            const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updates);
            values.push(Date.now()); // updated_at
            values.push(sessionId);
            
            const stmt = this.db.prepare(`
                UPDATE sessions 
                SET ${fields}, updated_at = ?
                WHERE session_id = ?
            `);
            
            const result = stmt.run(...values);
            
            await this.logEvent('session_updated', { sessionId, updates });
            
            return result.changes > 0;
        } catch (error) {
            console.error('Update session failed:', error);
            throw error;
        }
    }

    async endSession(sessionId) {
        try {
            const endTime = Date.now();
            const stmt = this.db.prepare(`
                UPDATE sessions 
                SET end_time = ?, status = 'completed', updated_at = ?
                WHERE session_id = ?
            `);
            
            const result = stmt.run(endTime, endTime, sessionId);
            
            await this.logEvent('session_ended', { sessionId, endTime });
            
            return result.changes > 0;
        } catch (error) {
            console.error('End session failed:', error);
            throw error;
        }
    }

    // Question Management
    async storeQuestion(questionData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO questions (session_id, question_text, question_type, confidence_score, source, context)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                questionData.sessionId,
                this.encrypt(questionData.questionText),
                questionData.questionType || 'unknown',
                questionData.confidenceScore || 0.0,
                questionData.source || 'manual',
                questionData.context ? this.encrypt(JSON.stringify(questionData.context)) : null
            );
            
            this.stats.questionsStored++;
            this.stats.lastActivity = Date.now();
            await this.saveStats();
            
            await this.logEvent('question_stored', { 
                questionId: result.lastInsertRowid,
                sessionId: questionData.sessionId,
                type: questionData.questionType
            });
            
            return {
                success: true,
                questionId: result.lastInsertRowid
            };
        } catch (error) {
            console.error('Store question failed:', error);
            throw error;
        }
    }

    async getQuestion(questionId) {
        try {
            const stmt = this.db.prepare('SELECT * FROM questions WHERE id = ?');
            const question = stmt.get(questionId);
            
            if (question) {
                question.question_text = this.decrypt(question.question_text);
                if (question.context) {
                    question.context = JSON.parse(this.decrypt(question.context));
                }
            }
            
            return question;
        } catch (error) {
            console.error('Get question failed:', error);
            throw error;
        }
    }

    async getSessionQuestions(sessionId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM questions 
                WHERE session_id = ? 
                ORDER BY created_at DESC
            `);
            
            const questions = stmt.all(sessionId);
            
            return questions.map(q => ({
                ...q,
                question_text: this.decrypt(q.question_text),
                context: q.context ? JSON.parse(this.decrypt(q.context)) : null
            }));
        } catch (error) {
            console.error('Get session questions failed:', error);
            throw error;
        }
    }

    // AI Response Management
    async storeAIResponse(responseData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO ai_responses (question_id, session_id, response_text, model_used, response_time, token_count, confidence_score)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                responseData.questionId,
                responseData.sessionId,
                this.encrypt(responseData.responseText),
                responseData.modelUsed,
                responseData.responseTime || null,
                responseData.tokenCount || null,
                responseData.confidenceScore || 0.0
            );
            
            // Mark question as answered
            const updateQuestionStmt = this.db.prepare('UPDATE questions SET is_answered = 1 WHERE id = ?');
            updateQuestionStmt.run(responseData.questionId);
            
            this.stats.responsesGenerated++;
            this.stats.lastActivity = Date.now();
            await this.saveStats();
            
            await this.logEvent('response_generated', {
                responseId: result.lastInsertRowid,
                questionId: responseData.questionId,
                sessionId: responseData.sessionId,
                model: responseData.modelUsed
            });
            
            return {
                success: true,
                responseId: result.lastInsertRowid
            };
        } catch (error) {
            console.error('Store AI response failed:', error);
            throw error;
        }
    }

    async getSessionResponses(sessionId) {
        try {
            const stmt = this.db.prepare(`
                SELECT r.*, q.question_text 
                FROM ai_responses r 
                JOIN questions q ON r.question_id = q.id 
                WHERE r.session_id = ? 
                ORDER BY r.created_at DESC
            `);
            
            const responses = stmt.all(sessionId);
            
            return responses.map(r => ({
                ...r,
                response_text: this.decrypt(r.response_text),
                question_text: this.decrypt(r.question_text)
            }));
        } catch (error) {
            console.error('Get session responses failed:', error);
            throw error;
        }
    }

    // User Preferences
    async saveUserPreferences(preferences) {
        try {
            // Always ensure there's at least one row for preferences
            const existing = this.db.prepare('SELECT COUNT(*) as count FROM user_preferences').get().count;
            if (existing === 0) {
                this.db.prepare('INSERT INTO user_preferences DEFAULT VALUES').run();
            }

            const fields = [];
            const values = [];

            if (preferences.companyName !== undefined) {
                fields.push('company_name = ?');
                values.push(preferences.companyName);
            }
            if (preferences.jobDescription !== undefined) {
                fields.push('job_description = ?');
                values.push(preferences.jobDescription);
            }
            if (preferences.resumePath !== undefined) {
                fields.push('resume_path = ?');
                values.push(preferences.resumePath);
            }
            if (preferences.selectedModel !== undefined) {
                fields.push('selected_model = ?');
                values.push(preferences.selectedModel);
            }

            if (fields.length === 0) {
                return { success: false, message: 'No preferences to save.' };
            }

            values.push(Date.now()); // updated_at

            const stmt = this.db.prepare(`
                UPDATE user_preferences 
                SET ${fields.join(', ')}, updated_at = ?
                WHERE id = (SELECT MIN(id) FROM user_preferences)
            `);
            
            const result = stmt.run(...values);
            
            await this.logEvent('user_preferences_saved', preferences);
            
            return result.changes > 0;
        } catch (error) {
            console.error('Save user preferences failed:', error);
            throw error;
        }
    }

    async getUserPreferences() {
        try {
            const stmt = this.db.prepare('SELECT * FROM user_preferences ORDER BY created_at DESC LIMIT 1');
            const prefs = stmt.get();
            
            if (prefs) {
                return {
                    companyName: prefs.company_name,
                    jobDescription: prefs.job_description,
                    resumePath: prefs.resume_path,
                    selectedModel: prefs.selected_model
                };
            }
            
            return {};
        } catch (error) {
            console.error('Get user preferences failed:', error);
            return {};
        }
    }

    // Resume Management
    async storeResume(resumeData) {
        try {
            // Deactivate previous resumes
            this.db.prepare('UPDATE resume_data SET is_active = 0').run();
            
            const stmt = this.db.prepare(`
                INSERT INTO resume_data (file_name, file_path, content, skills, experience, education)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                resumeData.fileName,
                resumeData.filePath || null,
                this.encrypt(resumeData.content),
                resumeData.skills ? this.encrypt(JSON.stringify(resumeData.skills)) : null,
                resumeData.experience ? this.encrypt(JSON.stringify(resumeData.experience)) : null,
                resumeData.education ? this.encrypt(JSON.stringify(resumeData.education)) : null
            );
            
            await this.logEvent('resume_uploaded', { 
                resumeId: result.lastInsertRowid,
                fileName: resumeData.fileName
            });
            
            return {
                success: true,
                resumeId: result.lastInsertRowid
            };
        } catch (error) {
            console.error('Store resume failed:', error);
            throw error;
        }
    }

    async getActiveResume() {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM resume_data 
                WHERE is_active = 1 
                ORDER BY uploaded_at DESC 
                LIMIT 1
            `);
            
            const resume = stmt.get();
            
            if (resume) {
                return {
                    ...resume,
                    content: this.decrypt(resume.content),
                    skills: resume.skills ? JSON.parse(this.decrypt(resume.skills)) : null,
                    experience: resume.experience ? JSON.parse(this.decrypt(resume.experience)) : null,
                    education: resume.education ? JSON.parse(this.decrypt(resume.education)) : null
                };
            }
            
            return null;
        } catch (error) {
            console.error('Get active resume failed:', error);
            return null;
        }
    }

    // Analytics and Logging
    async logEvent(eventType, eventData = {}) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO analytics (event_type, event_data, session_id)
                VALUES (?, ?, ?)
            `);
            
            stmt.run(
                eventType,
                JSON.stringify(eventData),
                eventData.sessionId || null
            );
        } catch (error) {
            console.error('Log event failed:', error);
        }
    }

    async getAnalytics(days = 30) {
        try {
            const sinceTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
            
            const stmt = this.db.prepare(`
                SELECT event_type, COUNT(*) as count, 
                       DATE(timestamp/1000, 'unixepoch') as date
                FROM analytics 
                WHERE timestamp >= ?
                GROUP BY event_type, date
                ORDER BY date DESC, count DESC
            `);
            
            return stmt.all(sinceTimestamp);
        } catch (error) {
            console.error('Get analytics failed:', error);
            return [];
        }
    }

    // Stats Management
    async loadStats() {
        try {
            // Load stats from database
            const questionsCount = this.db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
            const responsesCount = this.db.prepare('SELECT COUNT(*) as count FROM ai_responses').get().count;
            const sessionsCount = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
            const lastActivity = this.db.prepare('SELECT MAX(created_at) as last FROM analytics').get().last;
            
            this.stats = {
                questionsStored: questionsCount,
                responsesGenerated: responsesCount,
                sessionsCreated: sessionsCount,
                lastActivity: lastActivity ? lastActivity * 1000 : Date.now()
            };
        } catch (error) {
            console.error('Load stats failed:', error);
        }
    }

    async saveStats() {
        // Stats are now derived from database, no need to save separately
        return true;
    }

    async getStats() {
        await this.loadStats();
        return {
            ...this.stats,
            dbSize: this.getDatabaseSize(),
            uptime: Date.now() - this.stats.lastActivity
        };
    }

    // Utility Methods
    encrypt(text) {
        if (!text) return text;
        
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption failed:', error);
            return text; // Return original text if encryption fails
        }
    }

    decrypt(encryptedText) {
        if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
        
        try {
            const [ivHex, encrypted] = encryptedText.split(':');
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedText; // Return original text if decryption fails
        }
    }

    generateSessionId() {
        return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    getDatabaseSize() {
        try {
            const stats = fs.statSync(this.dbPath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    // Data Export/Import
    async exportData(options = {}) {
        try {
            const data = {
                sessions: [],
                questions: [],
                responses: [],
                preferences: await this.getAllPreferences(),
                resume: await this.getActiveResume(),
                exportedAt: Date.now()
            };
            
            if (options.includeSessions !== false) {
                const sessionsStmt = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
                data.sessions = sessionsStmt.all();
            }
            
            if (options.includeQuestions !== false) {
                const questionsStmt = this.db.prepare('SELECT * FROM questions ORDER BY created_at DESC');
                const questions = questionsStmt.all();
                data.questions = questions.map(q => ({
                    ...q,
                    question_text: this.decrypt(q.question_text),
                    context: q.context ? JSON.parse(this.decrypt(q.context)) : null
                }));
            }
            
            if (options.includeResponses !== false) {
                const responsesStmt = this.db.prepare('SELECT * FROM ai_responses ORDER BY created_at DESC');
                const responses = responsesStmt.all();
                data.responses = responses.map(r => ({
                    ...r,
                    response_text: this.decrypt(r.response_text)
                }));
            }
            
            return data;
        } catch (error) {
            console.error('Export data failed:', error);
            throw error;
        }
    }

    // Cleanup and Maintenance
    async cleanup(options = {}) {
        try {
            const daysToKeep = options.daysToKeep || 90;
            const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            
            // Clean old analytics
            this.db.prepare('DELETE FROM analytics WHERE timestamp < ?').run(cutoffTimestamp);
            
            // Clean completed sessions older than cutoff
            if (options.cleanOldSessions) {
                this.db.prepare(`
                    DELETE FROM sessions 
                    WHERE status = 'completed' AND end_time < ?
                `).run(cutoffTimestamp);
            }
            
            // Vacuum database
            this.db.exec('VACUUM');
            
            await this.logEvent('database_cleanup', { daysToKeep, cutoffTimestamp });
            
            return { success: true };
        } catch (error) {
            console.error('Database cleanup failed:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            this.isInitialized = false;
            console.log('Database connection closed');
        } catch (error) {
            console.error('Database close failed:', error);
        }
    }
}

module.exports = DatabaseService;
