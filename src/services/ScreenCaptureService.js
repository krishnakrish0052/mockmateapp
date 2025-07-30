const { desktopCapturer, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

class ScreenCaptureService {
    constructor() {
        this.captureOptions = {
            types: ['screen', 'window'],
            thumbnailSize: { width: 1920, height: 1080 },
            fetchWindowIcons: false
        };
        
        // Cache for screen sources
        this.screenSources = [];
        this.lastScreenUpdate = 0;
        this.screenUpdateInterval = 2000; // 2 seconds
        
        // Capture regions for optimization
        this.captureRegions = {
            fullScreen: { x: 0, y: 0, width: null, height: null },
            topHalf: { x: 0, y: 0, width: null, height: null },
            bottomHalf: { x: 0, y: null, width: null, height: null },
            center: { x: null, y: null, width: null, height: null }
        };
        
        // Initialize display information
        this.updateDisplayInfo();
        
        // Monitor display changes
        screen.on('display-added', () => this.updateDisplayInfo());
        screen.on('display-removed', () => this.updateDisplayInfo());
        screen.on('display-metrics-changed', () => this.updateDisplayInfo());
    }

    updateDisplayInfo() {
        this.displays = screen.getAllDisplays();
        this.primaryDisplay = screen.getPrimaryDisplay();
        
        // Update capture regions based on primary display
        const { width, height } = this.primaryDisplay.bounds;
        
        this.captureRegions.fullScreen = { x: 0, y: 0, width, height };
        this.captureRegions.topHalf = { x: 0, y: 0, width, height: Math.floor(height / 2) };
        this.captureRegions.bottomHalf = { x: 0, y: Math.floor(height / 2), width, height: Math.floor(height / 2) };
        this.captureRegions.center = { 
            x: Math.floor(width * 0.25), 
            y: Math.floor(height * 0.25), 
            width: Math.floor(width * 0.5), 
            height: Math.floor(height * 0.5) 
        };
        
        console.log(`📺 Display info updated: ${this.displays.length} displays, primary: ${width}x${height}`);
    }

    async getScreenSources(forceRefresh = false) {
        const now = Date.now();
        
        if (!forceRefresh && this.screenSources.length > 0 && (now - this.lastScreenUpdate) < this.screenUpdateInterval) {
            return this.screenSources;
        }

        try {
            this.screenSources = await desktopCapturer.getSources(this.captureOptions);
            this.lastScreenUpdate = now;
            
            console.log(`🖥️ Found ${this.screenSources.length} screen sources`);
            return this.screenSources;
        } catch (error) {
            console.error('Error getting screen sources:', error);
            return [];
        }
    }

    async captureFullScreen(displayId = null) {
        try {
            const sources = await this.getScreenSources();
            
            let targetSource;
            if (displayId) {
                targetSource = sources.find(source => source.display_id === displayId);
            } else {
                // Get primary screen
                targetSource = sources.find(source => source.name.includes('Entire Screen') || source.name.includes('Screen 1'));
                if (!targetSource) {
                    targetSource = sources[0]; // Fallback to first available
                }
            }

            if (!targetSource) {
                throw new Error('No screen source available for capture');
            }

            const thumbnail = targetSource.thumbnail;
            
            return {
                success: true,
                imageData: thumbnail.toDataURL(),
                buffer: thumbnail.toPNG(),
                dimensions: thumbnail.getSize(),
                sourceId: targetSource.id,
                sourceName: targetSource.name,
                displayId: targetSource.display_id,
                captureType: 'fullscreen'
            };
        } catch (error) {
            console.error('Full screen capture error:', error);
            return { error: error.message };
        }
    }

    async captureMultipleDisplays() {
        try {
            const sources = await this.getScreenSources();
            const screenSources = sources.filter(source => 
                source.name.includes('Entire Screen') || 
                source.name.includes('Screen')
            );

            const captures = [];
            
            for (const source of screenSources) {
                try {
                    const thumbnail = source.thumbnail;
                    
                    captures.push({
                        success: true,
                        imageData: thumbnail.toDataURL(),
                        buffer: thumbnail.toPNG(),
                        dimensions: thumbnail.getSize(),
                        sourceId: source.id,
                        sourceName: source.name,
                        displayId: source.display_id
                    });
                } catch (sourceError) {
                    console.error(`Error capturing ${source.name}:`, sourceError);
                    captures.push({
                        error: sourceError.message,
                        sourceName: source.name
                    });
                }
            }

            return {
                success: true,
                captures: captures,
                totalDisplays: captures.length
            };
        } catch (error) {
            console.error('Multi-display capture error:', error);
            return { error: error.message };
        }
    }

    async captureSpecificWindow(windowTitle) {
        try {
            const sources = await this.getScreenSources();
            const windowSources = sources.filter(source => source.name.toLowerCase().includes(windowTitle.toLowerCase()));

            if (windowSources.length === 0) {
                throw new Error(`No window found with title containing: ${windowTitle}`);
            }

            // Get the first matching window
            const targetWindow = windowSources[0];
            const thumbnail = targetWindow.thumbnail;

            return {
                success: true,
                imageData: thumbnail.toDataURL(),
                buffer: thumbnail.toPNG(),
                dimensions: thumbnail.getSize(),
                sourceId: targetWindow.id,
                sourceName: targetWindow.name,
                captureType: 'window'
            };
        } catch (error) {
            console.error('Window capture error:', error);
            return { error: error.message };
        }
    }

    async captureRegion(region = 'fullScreen') {
        try {
            const fullCapture = await this.captureFullScreen();
            if (fullCapture.error) {
                return fullCapture;
            }

            const regionConfig = this.captureRegions[region];
            if (!regionConfig) {
                throw new Error(`Invalid capture region: ${region}`);
            }

            // Create cropped image from full capture
            const originalImage = nativeImage.createFromDataURL(fullCapture.imageData);
            const croppedImage = originalImage.crop(regionConfig);

            return {
                success: true,
                imageData: croppedImage.toDataURL(),
                buffer: croppedImage.toPNG(),
                dimensions: croppedImage.getSize(),
                sourceId: fullCapture.sourceId,
                sourceName: fullCapture.sourceName,
                captureType: 'region',
                region: region
            };
        } catch (error) {
            console.error('Region capture error:', error);
            return { error: error.message };
        }
    }

    async captureWithOptions(options = {}) {
        const captureOptions = {
            types: options.types || ['screen'],
            thumbnailSize: options.thumbnailSize || { width: 1920, height: 1080 },
            fetchWindowIcons: options.fetchWindowIcons || false
        };

        try {
            const sources = await desktopCapturer.getSources(captureOptions);
            
            if (sources.length === 0) {
                throw new Error('No capture sources available');
            }

            const captures = sources.map(source => ({
                id: source.id,
                name: source.name,
                displayId: source.display_id,
                thumbnail: source.thumbnail.toDataURL(),
                appIcon: source.appIcon ? source.appIcon.toDataURL() : null
            }));

            return {
                success: true,
                sources: captures,
                count: captures.length
            };
        } catch (error) {
            console.error('Custom capture error:', error);
            return { error: error.message };
        }
    }

    async saveCapture(captureData, filename = null) {
        try {
            if (!captureData.buffer) {
                throw new Error('No buffer data available for saving');
            }

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const fileName = filename || `screen_capture_${Date.now()}.png`;
            const filePath = path.join(tempDir, fileName);

            fs.writeFileSync(filePath, captureData.buffer);

            return {
                success: true,
                filePath: filePath,
                fileName: fileName,
                size: captureData.buffer.length
            };
        } catch (error) {
            console.error('Save capture error:', error);
            return { error: error.message };
        }
    }

    async getDisplayInfo() {
        try {
            const displays = screen.getAllDisplays();
            const primaryDisplay = screen.getPrimaryDisplay();

            return {
                success: true,
                displays: displays.map(display => ({
                    id: display.id,
                    bounds: display.bounds,
                    workArea: display.workArea,
                    scaleFactor: display.scaleFactor,
                    rotation: display.rotation,
                    touchSupport: display.touchSupport,
                    isPrimary: display.id === primaryDisplay.id
                })),
                primaryDisplayId: primaryDisplay.id,
                totalDisplays: displays.length
            };
        } catch (error) {
            console.error('Get display info error:', error);
            return { error: error.message };
        }
    }

    async detectInterviewPlatforms() {
        try {
            const sources = await this.getScreenSources();
            const windowSources = sources.filter(source => source.name && source.name.length > 1);

            const interviewPlatforms = [
                'zoom', 'teams', 'meet', 'webex', 'skype', 'discord', 
                'chrome', 'firefox', 'edge', 'safari', 'browser'
            ];

            const detectedPlatforms = [];

            for (const source of windowSources) {
                const sourceName = source.name.toLowerCase();
                
                for (const platform of interviewPlatforms) {
                    if (sourceName.includes(platform)) {
                        detectedPlatforms.push({
                            platform: platform,
                            windowName: source.name,
                            sourceId: source.id,
                            confidence: this.calculatePlatformConfidence(sourceName, platform)
                        });
                        break; // Avoid duplicate entries for same window
                    }
                }
            }

            return {
                success: true,
                platforms: detectedPlatforms.sort((a, b) => b.confidence - a.confidence),
                totalWindows: windowSources.length
            };
        } catch (error) {
            console.error('Platform detection error:', error);
            return { error: error.message };
        }
    }

    calculatePlatformConfidence(windowName, platform) {
        let confidence = 0;
        
        // Direct match
        if (windowName === platform) confidence += 50;
        
        // Contains platform name
        if (windowName.includes(platform)) confidence += 30;
        
        // Interview-related keywords
        const interviewKeywords = ['meeting', 'call', 'video', 'conference'];
        for (const keyword of interviewKeywords) {
            if (windowName.includes(keyword)) confidence += 10;
        }
        
        // Browser-specific bonuses
        if (platform.includes('chrome') && windowName.includes('google')) confidence += 15;
        if (platform.includes('teams') && windowName.includes('microsoft')) confidence += 15;
        
        return Math.min(100, confidence);
    }

    // Privacy-aware capturing - exclude sensitive windows
    async getFilteredSources(excludePatterns = []) {
        try {
            const sources = await this.getScreenSources();
            const defaultExcludes = [
                'password', 'banking', 'wallet', 'private', 'personal',
                'secure', 'confidential', 'admin', 'root'
            ];
            
            const allExcludes = [...defaultExcludes, ...excludePatterns];
            
            const filteredSources = sources.filter(source => {
                const sourceName = source.name.toLowerCase();
                return !allExcludes.some(pattern => sourceName.includes(pattern.toLowerCase()));
            });

            return {
                success: true,
                sources: filteredSources,
                filtered: sources.length - filteredSources.length,
                total: sources.length
            };
        } catch (error) {
            console.error('Filtered sources error:', error);
            return { error: error.message };
        }
    }

    // Performance monitoring
    async benchmarkCapture() {
        const results = {
            fullScreen: null,
            region: null,
            window: null,
            multiDisplay: null
        };

        try {
            // Benchmark full screen capture
            const fullScreenStart = Date.now();
            const fullScreenResult = await this.captureFullScreen();
            results.fullScreen = {
                success: !fullScreenResult.error,
                duration: Date.now() - fullScreenStart,
                size: fullScreenResult.buffer ? fullScreenResult.buffer.length : 0
            };

            // Benchmark region capture
            const regionStart = Date.now();
            const regionResult = await this.captureRegion('center');
            results.region = {
                success: !regionResult.error,
                duration: Date.now() - regionStart,
                size: regionResult.buffer ? regionResult.buffer.length : 0
            };

            // Benchmark multi-display capture
            const multiDisplayStart = Date.now();
            const multiDisplayResult = await this.captureMultipleDisplays();
            results.multiDisplay = {
                success: !multiDisplayResult.error,
                duration: Date.now() - multiDisplayStart,
                displays: multiDisplayResult.totalDisplays || 0
            };

            return {
                success: true,
                benchmarks: results,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Benchmark error:', error);
            return { error: error.message };
        }
    }

    // Cleanup old capture files
    cleanupTempFiles() {
        try {
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) return;

            const files = fs.readdirSync(tempDir);
            const oneHourAgo = Date.now() - (60 * 60 * 1000);

            files.forEach(file => {
                if (file.startsWith('screen_capture_')) {
                    const filePath = path.join(tempDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime.getTime() < oneHourAgo) {
                        fs.unlinkSync(filePath);
                        console.log('🧹 Cleaned up old capture file:', file);
                    }
                }
            });
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

module.exports = ScreenCaptureService;
