const fs = require('fs');
const path = require('path');

class DocumentIntelligenceService {
    constructor(aiService = null) {
        this.aiService = aiService;
        
        // Industry-specific skill categories
        this.skillCategories = {
            programming: {
                keywords: [
                    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift',
                    'Kotlin', 'TypeScript', 'R', 'MATLAB', 'Scala', 'Perl', 'Objective-C', 'Dart',
                    'Assembly', 'COBOL', 'Fortran', 'Haskell', 'Lisp', 'Prolog', 'SQL', 'NoSQL'
                ],
                weight: 1.0
            },
            frameworks: {
                keywords: [
                    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
                    'Laravel', 'Rails', 'jQuery', 'Bootstrap', 'Tailwind', 'Electron', 'React Native',
                    'Flutter', 'ASP.NET', 'Symfony', 'CodeIgniter', 'Hibernate', 'Struts'
                ],
                weight: 0.9
            },
            databases: {
                keywords: [
                    'MySQL', 'PostgreSQL', 'MongoDB', 'SQLite', 'Redis', 'Cassandra', 'Oracle',
                    'SQL Server', 'MariaDB', 'DynamoDB', 'Elasticsearch', 'Neo4j', 'CouchDB',
                    'Firebase', 'InfluxDB'
                ],
                weight: 0.8
            },
            cloud: {
                keywords: [
                    'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins',
                    'CI/CD', 'Terraform', 'Ansible', 'Puppet', 'Chef', 'Vagrant', 'OpenStack',
                    'CloudFormation', 'Serverless', 'Lambda', 'EC2', 'S3'
                ],
                weight: 0.9
            },
            tools: {
                keywords: [
                    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN', 'Mercurial', 'JIRA', 'Confluence',
                    'Slack', 'Trello', 'Asana', 'Notion', 'Figma', 'Adobe XD', 'Sketch', 'InVision',
                    'Postman', 'Insomnia', 'Swagger', 'REST', 'GraphQL', 'SOAP'
                ],
                weight: 0.7
            },
            methodologies: {
                keywords: [
                    'Agile', 'Scrum', 'Kanban', 'DevOps', 'TDD', 'BDD', 'CI/CD', 'Microservices',
                    'SOA', 'MVC', 'MVP', 'MVVM', 'Clean Architecture', 'Domain-Driven Design',
                    'Event-Driven Architecture', 'RESTful', 'Waterfall', 'Lean'
                ],
                weight: 0.8
            },
            softSkills: {
                keywords: [
                    'Leadership', 'Communication', 'Teamwork', 'Problem Solving', 'Critical Thinking',
                    'Creativity', 'Adaptability', 'Time Management', 'Project Management',
                    'Collaboration', 'Mentoring', 'Public Speaking', 'Writing', 'Research'
                ],
                weight: 0.6
            }
        };

        // Experience level indicators
        this.experienceLevels = {
            junior: ['junior', 'entry', 'associate', 'intern', 'trainee', '0-2 years', '1-3 years'],
            mid: ['mid', 'intermediate', 'experienced', '3-5 years', '2-5 years', '4-7 years'],
            senior: ['senior', 'lead', 'principal', '5+ years', '7+ years', '8+ years'],
            executive: ['director', 'vp', 'cto', 'ceo', 'head of', 'chief', 'executive']
        };

        // Industry keywords
        this.industries = {
            technology: ['tech', 'software', 'IT', 'computer', 'digital', 'internet', 'web'],
            finance: ['finance', 'banking', 'fintech', 'investment', 'trading', 'insurance'],
            healthcare: ['healthcare', 'medical', 'pharma', 'biotech', 'hospital', 'clinical'],
            education: ['education', 'academic', 'university', 'school', 'learning', 'training'],
            ecommerce: ['ecommerce', 'retail', 'marketplace', 'shopping', 'commerce'],
            gaming: ['gaming', 'game', 'entertainment', 'mobile games', 'console'],
            automotive: ['automotive', 'car', 'vehicle', 'transportation', 'mobility']
        };

        // Performance tracking
        this.stats = {
            resumesProcessed: 0,
            jobDescriptionsProcessed: 0,
            totalProcessingTime: 0,
            averageMatchScore: 0,
            skillsExtracted: 0
        };
    }

    /**
     * Enhanced resume analysis with AI-powered insights
     */
    async analyzeResume(resumeText, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log('🔍 Starting enhanced resume analysis...');

            // Basic text processing
            const cleanedText = this.cleanText(resumeText);
            
            // Extract structured data
            const basicInfo = this.extractBasicInfo(cleanedText);
            const skills = this.extractSkills(cleanedText);
            const experience = this.extractExperience(cleanedText);
            const education = this.extractEducation(cleanedText);
            const projects = this.extractProjects(cleanedText);
            const certifications = this.extractCertifications(cleanedText);
            
            // AI-enhanced analysis if available
            let aiInsights = null;
            if (this.aiService && options.useAI !== false) {
                aiInsights = await this.getAIResumeInsights(cleanedText, options);
            }

            // Calculate experience level
            const experienceLevel = this.determineExperienceLevel(experience, cleanedText);
            
            // Industry detection
            const detectedIndustries = this.detectIndustries(cleanedText);

            const result = {
                success: true,
                basicInfo,
                skills: {
                    technical: skills.technical,
                    soft: skills.soft,
                    tools: skills.tools,
                    total: skills.total
                },
                experience: {
                    jobs: experience.jobs,
                    totalYears: experience.totalYears,
                    level: experienceLevel,
                    summary: experience.summary
                },
                education: {
                    degrees: education.degrees,
                    institutions: education.institutions,
                    certifications: certifications
                },
                projects: projects,
                industries: detectedIndustries,
                aiInsights: aiInsights,
                metadata: {
                    processingTime: Date.now() - startTime,
                    textLength: cleanedText.length,
                    confidenceScore: this.calculateResumeConfidence(skills, experience, education)
                }
            };

            this.updateStats('resume', Date.now() - startTime);
            console.log(`✅ Resume analysis completed in ${Date.now() - startTime}ms`);
            
            return result;

        } catch (error) {
            console.error('❌ Resume analysis error:', error);
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Enhanced job description analysis
     */
    async analyzeJobDescription(jobText, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log('🔍 Starting job description analysis...');

            const cleanedText = this.cleanText(jobText);
            
            // Extract structured data
            const basicInfo = this.extractJobBasicInfo(cleanedText);
            const requirements = this.extractJobRequirements(cleanedText);
            const responsibilities = this.extractJobResponsibilities(cleanedText);
            const benefits = this.extractJobBenefits(cleanedText);
            const compensation = this.extractCompensation(cleanedText);
            
            // AI-enhanced analysis
            let aiInsights = null;
            if (this.aiService && options.useAI !== false) {
                aiInsights = await this.getAIJobInsights(cleanedText, options);
            }

            // Determine job level and industry
            const jobLevel = this.determineJobLevel(cleanedText, requirements.experience);
            const detectedIndustries = this.detectIndustries(cleanedText);
            const companySize = this.estimateCompanySize(cleanedText);

            const result = {
                success: true,
                basicInfo,
                requirements: {
                    skills: requirements.skills,
                    experience: requirements.experience,
                    education: requirements.education,
                    mustHave: requirements.mustHave,
                    niceToHave: requirements.niceToHave
                },
                responsibilities: responsibilities,
                benefits: benefits,
                compensation: compensation,
                jobLevel: jobLevel,
                industries: detectedIndustries,
                companySize: companySize,
                aiInsights: aiInsights,
                metadata: {
                    processingTime: Date.now() - startTime,
                    textLength: cleanedText.length,
                    confidenceScore: this.calculateJobDescriptionConfidence(requirements, responsibilities)
                }
            };

            this.updateStats('jobDescription', Date.now() - startTime);
            console.log(`✅ Job description analysis completed in ${Date.now() - startTime}ms`);
            
            return result;

        } catch (error) {
            console.error('❌ Job description analysis error:', error);
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Calculate match score between resume and job description
     */
    calculateMatchScore(resumeAnalysis, jobAnalysis) {
        if (!resumeAnalysis.success || !jobAnalysis.success) {
            return { score: 0, details: { error: 'Analysis failed' } };
        }

        const scores = {
            skills: 0,
            experience: 0,
            education: 0,
            industry: 0,
            overall: 0
        };

        // Skills matching (40% weight)
        scores.skills = this.calculateSkillsMatch(
            resumeAnalysis.skills,
            jobAnalysis.requirements.skills
        ) * 0.4;

        // Experience matching (30% weight)
        scores.experience = this.calculateExperienceMatch(
            resumeAnalysis.experience,
            jobAnalysis.requirements.experience
        ) * 0.3;

        // Education matching (15% weight)
        scores.education = this.calculateEducationMatch(
            resumeAnalysis.education,
            jobAnalysis.requirements.education
        ) * 0.15;

        // Industry matching (15% weight)
        scores.industry = this.calculateIndustryMatch(
            resumeAnalysis.industries,
            jobAnalysis.industries
        ) * 0.15;

        scores.overall = scores.skills + scores.experience + scores.education + scores.industry;

        return {
            score: Math.round(scores.overall * 100) / 100,
            breakdown: {
                skills: Math.round(scores.skills / 0.4 * 100),
                experience: Math.round(scores.experience / 0.3 * 100),
                education: Math.round(scores.education / 0.15 * 100),
                industry: Math.round(scores.industry / 0.15 * 100)
            },
            recommendations: this.generateMatchRecommendations(resumeAnalysis, jobAnalysis, scores)
        };
    }

    /**
     * Clean and normalize text
     */
    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\.\,\;\:\!\?\-\(\)\[\]]/g, '')
            .trim();
    }

    /**
     * Extract basic information from resume
     */
    extractBasicInfo(text) {
        const info = {
            name: null,
            email: null,
            phone: null,
            location: null,
            linkedin: null,
            github: null,
            website: null
        };

        // Extract email
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) info.email = emailMatch[0];

        // Extract phone
        const phoneMatch = text.match(/(\+?\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/);
        if (phoneMatch) info.phone = phoneMatch[0];

        // Extract LinkedIn
        const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
        if (linkedinMatch) info.linkedin = linkedinMatch[0];

        // Extract GitHub
        const githubMatch = text.match(/github\.com\/[\w-]+/i);
        if (githubMatch) info.github = githubMatch[0];

        // Extract name (heuristic approach)
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        for (const line of lines.slice(0, 5)) {
            if (line.length < 50 && line.length > 5 && 
                !line.includes('@') && !line.includes('http') &&
                /^[A-Za-z\s\.]+$/.test(line)) {
                info.name = line.trim();
                break;
            }
        }

        return info;
    }

    /**
     * Extract skills with categorization and confidence scoring
     */
    extractSkills(text) {
        const lowerText = text.toLowerCase();
        const extractedSkills = {
            technical: [],
            soft: [],
            tools: [],
            total: 0
        };

        Object.entries(this.skillCategories).forEach(([category, data]) => {
            data.keywords.forEach(skill => {
                if (lowerText.includes(skill.toLowerCase())) {
                    const skillObj = {
                        name: skill,
                        category: category,
                        confidence: this.calculateSkillConfidence(skill, text),
                        weight: data.weight
                    };

                    if (category === 'softSkills') {
                        extractedSkills.soft.push(skillObj);
                    } else if (category === 'tools') {
                        extractedSkills.tools.push(skillObj);
                    } else {
                        extractedSkills.technical.push(skillObj);
                    }
                }
            });
        });

        extractedSkills.total = extractedSkills.technical.length + 
                              extractedSkills.soft.length + 
                              extractedSkills.tools.length;

        return extractedSkills;
    }

    /**
     * Extract work experience with enhanced parsing
     */
    extractExperience(text) {
        const experience = {
            jobs: [],
            totalYears: 0,
            summary: ''
        };

        const lines = text.split('\n');
        let currentJob = null;
        let inExperienceSection = false;

        const experienceKeywords = ['experience', 'employment', 'work history', 'career', 'professional'];
        const jobTitlePatterns = [
            /(?:software|web|frontend|backend|full.?stack|mobile)\s+(?:developer|engineer|programmer)/gi,
            /(?:senior|junior|lead|principal|staff)\s+(?:developer|engineer|programmer)/gi,
            /(?:data|machine learning|ai)\s+(?:scientist|engineer|analyst)/gi,
            /(?:product|project|program)\s+manager/gi,
            /(?:ui|ux)\s+(?:designer|developer)/gi,
            /(?:devops|site reliability)\s+engineer/gi,
            /(?:quality assurance|qa)\s+(?:engineer|analyst)/gi
        ];

        lines.forEach(line => {
            const trimmedLine = line.trim();
            
            // Check if we're in experience section
            if (experienceKeywords.some(keyword => trimmedLine.toLowerCase().includes(keyword))) {
                inExperienceSection = true;
                return;
            }

            if (inExperienceSection && trimmedLine.length > 0) {
                // Check for job title
                const isJobTitle = jobTitlePatterns.some(pattern => pattern.test(trimmedLine));
                
                if (isJobTitle) {
                    if (currentJob) {
                        experience.jobs.push(currentJob);
                    }
                    currentJob = {
                        title: trimmedLine,
                        company: null,
                        duration: null,
                        description: []
                    };
                } else if (currentJob) {
                    // Check for company or duration
                    if (trimmedLine.includes('-') && /\d{4}/.test(trimmedLine)) {
                        currentJob.duration = trimmedLine;
                    } else if (!currentJob.company && trimmedLine.length < 100) {
                        currentJob.company = trimmedLine;
                    } else {
                        currentJob.description.push(trimmedLine);
                    }
                }
            }
        });

        if (currentJob) {
            experience.jobs.push(currentJob);
        }

        // Estimate total years of experience
        experience.totalYears = this.estimateExperienceYears(text);
        
        return experience;
    }

    /**
     * Extract education information
     */
    extractEducation(text) {
        const education = {
            degrees: [],
            institutions: []
        };

        const degreePatterns = [
            /(?:bachelor|master|phd|doctorate|associate)\s+(?:of|in|degree)/gi,
            /\b(?:b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?)\b/gi,
            /(?:computer science|software engineering|information technology|electrical engineering)/gi
        ];

        const institutionPatterns = [
            /\buniversity\b/gi,
            /\bcollege\b/gi,
            /\binstitute\b/gi
        ];

        const lines = text.split('\n');
        
        lines.forEach(line => {
            degreePatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    education.degrees.push(line.trim());
                }
            });

            institutionPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    education.institutions.push(line.trim());
                }
            });
        });

        return education;
    }

    /**
     * Extract projects from resume
     */
    extractProjects(text) {
        const projects = [];
        const lines = text.split('\n');
        let inProjectSection = false;
        let currentProject = null;

        const projectKeywords = ['projects', 'portfolio', 'work samples', 'achievements'];

        lines.forEach(line => {
            const trimmedLine = line.trim();
            
            if (projectKeywords.some(keyword => trimmedLine.toLowerCase().includes(keyword))) {
                inProjectSection = true;
                return;
            }

            if (inProjectSection && trimmedLine.length > 0) {
                // Heuristic: if line starts with capital letter and is not too long, it might be a project title
                if (/^[A-Z]/.test(trimmedLine) && trimmedLine.length < 100) {
                    if (currentProject) {
                        projects.push(currentProject);
                    }
                    currentProject = {
                        title: trimmedLine,
                        description: [],
                        technologies: []
                    };
                } else if (currentProject) {
                    currentProject.description.push(trimmedLine);
                    
                    // Extract technologies mentioned in description
                    Object.values(this.skillCategories).forEach(category => {
                        category.keywords.forEach(tech => {
                            if (trimmedLine.toLowerCase().includes(tech.toLowerCase())) {
                                if (!currentProject.technologies.includes(tech)) {
                                    currentProject.technologies.push(tech);
                                }
                            }
                        });
                    });
                }
            }
        });

        if (currentProject) {
            projects.push(currentProject);
        }

        return projects;
    }

    /**
     * Extract certifications
     */
    extractCertifications(text) {
        const certifications = [];
        const certificationKeywords = [
            'certified', 'certification', 'certificate', 'license', 'accredited',
            'AWS Certified', 'Microsoft Certified', 'Google Certified', 'Oracle Certified',
            'Cisco Certified', 'CompTIA', 'PMP', 'Scrum Master', 'Azure Certified'
        ];

        const lines = text.split('\n');
        lines.forEach(line => {
            certificationKeywords.forEach(keyword => {
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    certifications.push(line.trim());
                }
            });
        });

        return [...new Set(certifications)]; // Remove duplicates
    }

    /**
     * AI-powered resume insights
     */
    async getAIResumeInsights(resumeText, options = {}) {
        if (!this.aiService) return null;

        try {
            const prompt = `Analyze this resume and provide insights:

Resume Text:
${resumeText.substring(0, 2000)}...

Please provide:
1. Strengths and standout qualities
2. Areas for improvement
3. Career level assessment
4. Industry fit analysis
5. Skill gaps or recommendations

Respond in JSON format with structured insights.`;

            const response = await this.aiService.generateResponse({
                question: prompt,
                model: options.aiModel || 'openai'
            });

            return this.parseAIInsights(response.response || response.text);

        } catch (error) {
            console.error('AI resume insights error:', error);
            return null;
        }
    }

    /**
     * AI-powered job description insights
     */
    async getAIJobInsights(jobText, options = {}) {
        if (!this.aiService) return null;

        try {
            const prompt = `Analyze this job description and provide insights:

Job Description:
${jobText.substring(0, 2000)}...

Please provide:
1. Key requirements and must-have skills
2. Nice-to-have qualifications
3. Company culture indicators
4. Career growth potential
5. Potential red flags or concerns

Respond in JSON format with structured insights.`;

            const response = await this.aiService.generateResponse({
                question: prompt,
                model: options.aiModel || 'openai'
            });

            return this.parseAIInsights(response.response || response.text);

        } catch (error) {
            console.error('AI job insights error:', error);
            return null;
        }
    }

    /**
     * Helper methods for calculations and analysis
     */
    calculateSkillConfidence(skill, text) {
        const occurrences = (text.toLowerCase().match(new RegExp(skill.toLowerCase(), 'g')) || []).length;
        return Math.min(1.0, occurrences * 0.2 + 0.1);
    }

    estimateExperienceYears(text) {
        const yearPattern = /(\d{1,2})\+?\s*years?/gi;
        const matches = text.match(yearPattern);
        if (matches) {
            const years = matches.map(match => parseInt(match.match(/\d+/)[0]));
            return Math.max(...years);
        }
        return 0;
    }

    determineExperienceLevel(experience, text) {
        const totalYears = experience.totalYears;
        const lowerText = text.toLowerCase();

        if (totalYears >= 8 || this.experienceLevels.senior.some(keyword => lowerText.includes(keyword))) {
            return 'senior';
        } else if (totalYears >= 3 || this.experienceLevels.mid.some(keyword => lowerText.includes(keyword))) {
            return 'mid';
        } else {
            return 'junior';
        }
    }

    detectIndustries(text) {
        const lowerText = text.toLowerCase();
        const detectedIndustries = [];

        Object.entries(this.industries).forEach(([industry, keywords]) => {
            const matches = keywords.filter(keyword => lowerText.includes(keyword));
            if (matches.length > 0) {
                detectedIndustries.push({
                    industry: industry,
                    confidence: matches.length / keywords.length,
                    matchedKeywords: matches
                });
            }
        });

        return detectedIndustries.sort((a, b) => b.confidence - a.confidence);
    }

    calculateResumeConfidence(skills, experience, education) {
        let confidence = 0.5; // Base confidence
        
        if (skills.total > 5) confidence += 0.2;
        if (experience.jobs.length > 0) confidence += 0.2;
        if (education.degrees.length > 0) confidence += 0.1;
        
        return Math.min(1.0, confidence);
    }

    // Additional helper methods would be implemented here...
    extractJobBasicInfo(text) {
        // Implementation for job basic info extraction
        return {
            title: null,
            company: null,
            location: null,
            type: null,
            remote: text.toLowerCase().includes('remote')
        };
    }

    extractJobRequirements(text) {
        // Implementation for job requirements extraction
        return {
            skills: [],
            experience: null,
            education: null,
            mustHave: [],
            niceToHave: []
        };
    }

    extractJobResponsibilities(text) {
        // Implementation for job responsibilities extraction
        return [];
    }

    extractJobBenefits(text) {
        // Implementation for job benefits extraction
        return [];
    }

    extractCompensation(text) {
        // Implementation for compensation extraction
        return {
            salary: null,
            equity: null,
            benefits: []
        };
    }

    determineJobLevel(text, experience) {
        // Implementation for job level determination
        return 'mid';
    }

    estimateCompanySize(text) {
        // Implementation for company size estimation
        return 'medium';
    }

    calculateJobDescriptionConfidence(requirements, responsibilities) {
        // Implementation for job description confidence calculation
        return 0.8;
    }

    calculateSkillsMatch(resumeSkills, jobSkills) {
        // Implementation for skills matching
        return 0.7;
    }

    calculateExperienceMatch(resumeExp, jobExp) {
        // Implementation for experience matching
        return 0.8;
    }

    calculateEducationMatch(resumeEdu, jobEdu) {
        // Implementation for education matching
        return 0.6;
    }

    calculateIndustryMatch(resumeIndustries, jobIndustries) {
        // Implementation for industry matching
        return 0.9;
    }

    generateMatchRecommendations(resumeAnalysis, jobAnalysis, scores) {
        // Implementation for generating recommendations
        return [];
    }

    parseAIInsights(aiResponse) {
        // Implementation for parsing AI insights
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to parse AI insights:', error);
        }
        return { summary: aiResponse };
    }

    updateStats(type, processingTime) {
        if (type === 'resume') {
            this.stats.resumesProcessed++;
        } else if (type === 'jobDescription') {
            this.stats.jobDescriptionsProcessed++;
        }
        this.stats.totalProcessingTime += processingTime;
    }

    getStats() {
        return {
            ...this.stats,
            averageProcessingTime: this.stats.totalProcessingTime / 
                (this.stats.resumesProcessed + this.stats.jobDescriptionsProcessed),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Health check for the service
     */
    async healthCheck() {
        return {
            status: 'healthy',
            aiServiceAvailable: !!this.aiService,
            stats: this.getStats(),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = DocumentIntelligenceService;
