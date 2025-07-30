const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Store = require('electron-store');

class ContextService {
    constructor() {
        this.store = new Store();
        this.context = {
            resume: {
                text: '',
                skills: [],
                experience: [],
                education: [],
                fileName: '',
                lastUpdated: null
            },
            jobDescription: {
                text: '',
                requirements: [],
                responsibilities: [],
                company: '',
                position: '',
                fileName: '',
                lastUpdated: null
            },
            interview: {
                company: '',
                position: '',
                interviewer: '',
                type: '', // technical, behavioral, etc.
                duration: 0
            }
        };
        
        this.loadContext();
    }

    loadContext() {
        try {
            const savedContext = this.store.get('interviewContext');
            if (savedContext) {
                this.context = { ...this.context, ...savedContext };
            }
        } catch (error) {
            console.error('Error loading context:', error);
        }
    }

    saveContext() {
        try {
            this.context.lastUpdated = new Date().toISOString();
            this.store.set('interviewContext', this.context);
        } catch (error) {
            console.error('Error saving context:', error);
        }
    }

    async processResumeFile(filePath) {
        try {
            const extension = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);
            let text = '';

            switch (extension) {
                case '.pdf':
                    const pdfBuffer = await fs.readFile(filePath);
                    const pdfData = await pdfParse(pdfBuffer);
                    text = pdfData.text;
                    break;
                case '.docx':
                    const docxBuffer = await fs.readFile(filePath);
                    const result = await mammoth.extractRawText({ buffer: docxBuffer });
                    text = result.value;
                    break;
                case '.txt':
                    text = await fs.readFile(filePath, 'utf-8');
                    break;
                default:
                    throw new Error(`Unsupported file type: ${extension}`);
            }

            // Process and extract information
            const resumeData = this.extractResumeData(text);
            
            this.context.resume = {
                text: text,
                skills: resumeData.skills,
                experience: resumeData.experience,
                education: resumeData.education,
                fileName: fileName,
                lastUpdated: new Date().toISOString()
            };

            this.saveContext();
            return this.context.resume;
        } catch (error) {
            console.error('Error processing resume file:', error);
            throw error;
        }
    }

    async processJobDescriptionFile(filePath) {
        try {
            const extension = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);
            let text = '';

            switch (extension) {
                case '.pdf':
                    const pdfBuffer = await fs.readFile(filePath);
                    const pdfData = await pdfParse(pdfBuffer);
                    text = pdfData.text;
                    break;
                case '.docx':
                    const docxBuffer = await fs.readFile(filePath);
                    const result = await mammoth.extractRawText({ buffer: docxBuffer });
                    text = result.value;
                    break;
                case '.txt':
                    text = await fs.readFile(filePath, 'utf-8');
                    break;
                default:
                    throw new Error(`Unsupported file type: ${extension}`);
            }

            // Process and extract information
            const jobData = this.extractJobDescriptionData(text);
            
            this.context.jobDescription = {
                text: text,
                requirements: jobData.requirements,
                responsibilities: jobData.responsibilities,
                company: jobData.company,
                position: jobData.position,
                fileName: fileName,
                lastUpdated: new Date().toISOString()
            };

            this.saveContext();
            return this.context.jobDescription;
        } catch (error) {
            console.error('Error processing job description file:', error);
            throw error;
        }
    }

    extractResumeData(text) {
        const data = {
            skills: [],
            experience: [],
            education: []
        };

        try {
            // Extract skills
            const skillsSection = this.extractSection(text, ['skills', 'technical skills', 'core competencies']);
            if (skillsSection) {
                data.skills = this.parseSkills(skillsSection);
            }

            // Extract experience
            const experienceSection = this.extractSection(text, ['experience', 'work experience', 'professional experience']);
            if (experienceSection) {
                data.experience = this.parseExperience(experienceSection);
            }

            // Extract education
            const educationSection = this.extractSection(text, ['education', 'academic background']);
            if (educationSection) {
                data.education = this.parseEducation(educationSection);
            }
        } catch (error) {
            console.error('Error extracting resume data:', error);
        }

        return data;
    }

    extractJobDescriptionData(text) {
        const data = {
            requirements: [],
            responsibilities: [],
            company: '',
            position: ''
        };

        try {
            // Extract company name
            const companyMatch = text.match(/(?:company|organization|employer):\s*([^\n]+)/i);
            if (companyMatch) {
                data.company = companyMatch[1].trim();
            }

            // Extract position
            const positionMatch = text.match(/(?:position|role|title|job title):\s*([^\n]+)/i);
            if (positionMatch) {
                data.position = positionMatch[1].trim();
            }

            // Extract requirements
            const requirementsSection = this.extractSection(text, ['requirements', 'qualifications', 'must have']);
            if (requirementsSection) {
                data.requirements = this.parseRequirements(requirementsSection);
            }

            // Extract responsibilities
            const responsibilitiesSection = this.extractSection(text, ['responsibilities', 'duties', 'role description']);
            if (responsibilitiesSection) {
                data.responsibilities = this.parseResponsibilities(responsibilitiesSection);
            }
        } catch (error) {
            console.error('Error extracting job description data:', error);
        }

        return data;
    }

    extractSection(text, sectionHeaders) {
        try {
            for (const header of sectionHeaders) {
                const regex = new RegExp(`${header}[:\\s]*([\\s\\S]*?)(?=\\n[A-Z][^\\n]*:|$)`, 'i');
                const match = text.match(regex);
                if (match) {
                    return match[1].trim();
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting section:', error);
            return null;
        }
    }

    parseSkills(skillsText) {
        try {
            // Common patterns for skills
            const skills = [];
            const patterns = [
                /([A-Za-z\+\#\.]+(?:\s+[A-Za-z\+\#\.]+)*)/g,
                /•\s*([^\n]+)/g,
                /-\s*([^\n]+)/g
            ];

            for (const pattern of patterns) {
                const matches = skillsText.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        const skill = match.replace(/^[•\-\s]+/, '').trim();
                        if (skill.length > 1 && skill.length < 50) {
                            skills.push(skill);
                        }
                    });
                }
            }

            return [...new Set(skills)]; // Remove duplicates
        } catch (error) {
            console.error('Error parsing skills:', error);
            return [];
        }
    }

    parseExperience(experienceText) {
        try {
            const experiences = [];
            const experienceBlocks = experienceText.split(/\n\s*\n/);

            experienceBlocks.forEach(block => {
                if (block.trim().length > 50) {
                    const lines = block.split('\n').map(line => line.trim());
                    const experience = {
                        title: lines[0] || '',
                        company: lines[1] || '',
                        duration: lines[2] || '',
                        description: lines.slice(3).join(' ')
                    };
                    experiences.push(experience);
                }
            });

            return experiences;
        } catch (error) {
            console.error('Error parsing experience:', error);
            return [];
        }
    }

    parseEducation(educationText) {
        try {
            const education = [];
            const educationBlocks = educationText.split(/\n\s*\n/);

            educationBlocks.forEach(block => {
                if (block.trim().length > 10) {
                    const lines = block.split('\n').map(line => line.trim());
                    const edu = {
                        degree: lines[0] || '',
                        institution: lines[1] || '',
                        year: lines[2] || '',
                        details: lines.slice(3).join(' ')
                    };
                    education.push(edu);
                }
            });

            return education;
        } catch (error) {
            console.error('Error parsing education:', error);
            return [];
        }
    }

    parseRequirements(requirementsText) {
        try {
            const requirements = [];
            const lines = requirementsText.split('\n');

            lines.forEach(line => {
                const cleanLine = line.replace(/^[•\-\d\.\s]+/, '').trim();
                if (cleanLine.length > 10) {
                    requirements.push(cleanLine);
                }
            });

            return requirements;
        } catch (error) {
            console.error('Error parsing requirements:', error);
            return [];
        }
    }

    parseResponsibilities(responsibilitiesText) {
        try {
            const responsibilities = [];
            const lines = responsibilitiesText.split('\n');

            lines.forEach(line => {
                const cleanLine = line.replace(/^[•\-\d\.\s]+/, '').trim();
                if (cleanLine.length > 10) {
                    responsibilities.push(cleanLine);
                }
            });

            return responsibilities;
        } catch (error) {
            console.error('Error parsing responsibilities:', error);
            return [];
        }
    }

    updateInterviewDetails(details) {
        try {
            this.context.interview = { ...this.context.interview, ...details };
            this.saveContext();
        } catch (error) {
            console.error('Error updating interview details:', error);
        }
    }

    buildContextForAI(question) {
        try {
            let contextPrompt = '';

            // Add resume context
            if (this.context.resume.text) {
                contextPrompt += `CANDIDATE BACKGROUND:\n`;
                if (this.context.resume.skills.length > 0) {
                    contextPrompt += `Skills: ${this.context.resume.skills.slice(0, 10).join(', ')}\n`;
                }
                if (this.context.resume.experience.length > 0) {
                    const recentExp = this.context.resume.experience[0];
                    contextPrompt += `Recent Experience: ${recentExp.title} at ${recentExp.company}\n`;
                }
                contextPrompt += '\n';
            }

            // Add job description context
            if (this.context.jobDescription.text) {
                contextPrompt += `JOB REQUIREMENTS:\n`;
                contextPrompt += `Company: ${this.context.jobDescription.company}\n`;
                contextPrompt += `Position: ${this.context.jobDescription.position}\n`;
                if (this.context.jobDescription.requirements.length > 0) {
                    contextPrompt += `Key Requirements: ${this.context.jobDescription.requirements.slice(0, 5).join('; ')}\n`;
                }
                contextPrompt += '\n';
            }

            // Add interview context
            if (this.context.interview.company) {
                contextPrompt += `INTERVIEW CONTEXT:\n`;
                contextPrompt += `Company: ${this.context.interview.company}\n`;
                contextPrompt += `Position: ${this.context.interview.position}\n`;
                contextPrompt += '\n';
            }

            contextPrompt += `QUESTION: ${question}\n\n`;
            contextPrompt += `Provide a concise, relevant answer that:\n`;
            contextPrompt += `1. Directly addresses the question\n`;
            contextPrompt += `2. Relates to the candidate's background when relevant\n`;
            contextPrompt += `3. Aligns with the job requirements\n`;
            contextPrompt += `4. Is professional and interview-appropriate\n`;
            contextPrompt += `5. Keeps the response focused and under 150 words\n`;

            return contextPrompt;
        } catch (error) {
            console.error('Error building AI context:', error);
            return question;
        }
    }

    getRelevantSkills(question) {
        try {
            const questionLower = question.toLowerCase();
            const relevantSkills = this.context.resume.skills.filter(skill => 
                questionLower.includes(skill.toLowerCase()) ||
                skill.toLowerCase().includes(questionLower.split(' ')[0])
            );
            return relevantSkills.slice(0, 5);
        } catch (error) {
            console.error('Error getting relevant skills:', error);
            return [];
        }
    }

    getRelevantExperience(question) {
        try {
            const questionLower = question.toLowerCase();
            const relevantExp = this.context.resume.experience.filter(exp => 
                exp.description.toLowerCase().includes(questionLower.split(' ')[0]) ||
                exp.title.toLowerCase().includes(questionLower.split(' ')[0])
            );
            return relevantExp.slice(0, 2);
        } catch (error) {
            console.error('Error getting relevant experience:', error);
            return [];
        }
    }

    clearContext() {
        try {
            this.context = {
                resume: {
                    text: '',
                    skills: [],
                    experience: [],
                    education: [],
                    fileName: '',
                    lastUpdated: null
                },
                jobDescription: {
                    text: '',
                    requirements: [],
                    responsibilities: [],
                    company: '',
                    position: '',
                    fileName: '',
                    lastUpdated: null
                },
                interview: {
                    company: '',
                    position: '',
                    interviewer: '',
                    type: '',
                    duration: 0
                }
            };
            this.saveContext();
        } catch (error) {
            console.error('Error clearing context:', error);
        }
    }

    getContextSummary() {
        return {
            hasResume: this.context.resume.text.length > 0,
            hasJobDescription: this.context.jobDescription.text.length > 0,
            skillsCount: this.context.resume.skills.length,
            experienceCount: this.context.resume.experience.length,
            company: this.context.jobDescription.company || this.context.interview.company,
            position: this.context.jobDescription.position || this.context.interview.position
        };
    }
}

module.exports = ContextService;
