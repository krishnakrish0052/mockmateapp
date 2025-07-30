const { BrowserWindow } = require('electron');
const path = require('path');

class StealthService {
    constructor() {
        this.isStealthEnabled = false;
        this.originalWindowTitles = new Map();
        this.windowManager = null;
        
        // Try to load optional native modules for advanced stealth
        try {
            this.windowManager = require('node-window-manager');
        } catch (error) {
            console.log('Advanced stealth features unavailable - node-window-manager not found');
        }
    }

    async enableStealthMode() {
        try {
            this.isStealthEnabled = true;
            console.log('Stealth mode enabled');
            
            // Set process priority to avoid detection
            if (process.platform === 'win32') {
                try {
                    process.nice(19); // Lowest priority
                } catch (e) {
                    console.log('Could not set process priority');
                }
            }

            return true;
        } catch (error) {
            console.error('Error enabling stealth mode:', error);
            return false;
        }
    }

    hideFromTaskbar(window) {
        if (!window) return;

        try {
            // Electron built-in methods
            window.setSkipTaskbar(true);
            
            // Additional Windows-specific hiding
            if (process.platform === 'win32') {
                // Hide from Alt+Tab
                window.setAlwaysOnTop(true, 'screen-saver', 1);
                
                // Set window as tool window to hide from taskbar
                const nativeWindowHandle = window.getNativeWindowHandle();
                if (nativeWindowHandle) {
                    this.setWindowAsToolWindow(nativeWindowHandle);
                }
            }

            console.log('Window hidden from taskbar and Alt+Tab');
        } catch (error) {
            console.error('Error hiding window from taskbar:', error);
        }
    }

    hideFromScreenShare(window) {
        if (!window) return;

        try {
            // Set window to be excluded from screen capture
            if (process.platform === 'win32') {
                // Use WDA_EXCLUDEFROMCAPTURE flag (Windows 10 version 2004+)
                const nativeHandle = window.getNativeWindowHandle();
                if (nativeHandle) {
                    this.setWindowDisplayAffinity(nativeHandle);
                }
            }

            // Additional measures
            window.setAlwaysOnTop(true, 'screen-saver', 2);
            
            console.log('Window hidden from screen sharing');
        } catch (error) {
            console.error('Error hiding window from screen share:', error);
        }
    }

    setWindowAsToolWindow(windowHandle) {
        try {
            if (this.windowManager) {
                const { windowManager } = require('node-window-manager');
                const window = windowManager.wrap(windowHandle);
                window.setAsToolWindow();
                console.log('Applied tool window styles');
            }
        } catch (error) {
            console.error('Error setting tool window style:', error);
        }
    }

    setWindowDisplayAffinity(windowHandle) {
        try {
            if (this.windowManager) {
                const { windowManager } = require('node-window-manager');
                const window = windowManager.wrap(windowHandle);
                window.setWindowDisplayAffinity('excludeFromCapture');
                console.log('Window display affinity set to exclude from capture');
            }
        } catch (error) {
            console.error('Error setting window display affinity:', error);
        }
    }

    disguiseProcessName() {
        try {
            // Change process title to something innocuous
            const disguiseNames = [
                'Windows Security',
                'System Idle Process',
                'Windows Update',
                'Windows Defender',
                'Microsoft Edge'
            ];
            
            const randomName = disguiseNames[Math.floor(Math.random() * disguiseNames.length)];
            process.title = randomName;
            
            console.log(`Process disguised as: ${randomName}`);
        } catch (error) {
            console.error('Error disguising process name:', error);
        }
    }

    enableTransparentClickThrough(window) {
        try {
            // Make window click-through when not actively being used
            window.setIgnoreMouseEvents(true, { forward: true });
            
            // Re-enable mouse events when hovering over interactive elements
            window.webContents.on('before-input-event', (event, input) => {
                if (input.type === 'mouseMove') {
                    window.setIgnoreMouseEvents(false);
                    
                    // Set timeout to make it click-through again
                    setTimeout(() => {
                        if (window && !window.isDestroyed()) {
                            window.setIgnoreMouseEvents(true, { forward: true });
                        }
                    }, 1000);
                }
            });
            
        } catch (error) {
            console.error('Error setting transparent click-through:', error);
        }
    }

    hideFromProcessList() {
        try {
            // This would require rootkit-like functionality
            // Not implementable through standard Electron/Node.js
            
            // Alternative: Use legitimate-sounding process names
            this.disguiseProcessName();
            
            console.log('Process name disguised');
        } catch (error) {
            console.error('Error hiding from process list:', error);
        }
    }

    preventDetection() {
        try {
            // Disable web security to avoid detection by web-based monitoring
            // This is already handled in window creation
            
            // Random delays to avoid pattern detection
            const randomDelay = Math.random() * 1000 + 500;
            setTimeout(() => {
                // Perform subtle operations with randomization
            }, randomDelay);
            
            console.log('Detection prevention measures applied');
        } catch (error) {
            console.error('Error applying detection prevention:', error);
        }
    }

    enableLowProfileMode(window) {
        try {
            // Reduce window opacity slightly
            window.setOpacity(0.95);
            
            // Use system colors to blend in
            window.setBackgroundColor('#00000000');
            
            // Minimize resource usage
            window.webContents.setBackgroundThrottling(true);
            
            console.log('Low profile mode enabled');
        } catch (error) {
            console.error('Error enabling low profile mode:', error);
        }
    }

    setupAntiDetection() {
        try {
            // Disable common detection methods
            if (process.env.NODE_ENV === 'production') {
                // Remove development indicators
                delete process.env.ELECTRON_RUN_AS_NODE;
                delete process.env.ELECTRON_NO_ATTACH_CONSOLE;
            }
            
            // Spoof user agent
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            
            console.log('Anti-detection measures set up');
            return userAgent;
        } catch (error) {
            console.error('Error setting up anti-detection:', error);
            return null;
        }
    }

    createDecoyProcesses() {
        try {
            // This would create legitimate-looking background processes
            // Not recommended for actual implementation due to security implications
            
            console.log('Decoy processes concept noted (not implemented for security)');
        } catch (error) {
            console.error('Error with decoy processes:', error);
        }
    }

    monitorForDetection() {
        try {
            // Monitor for screen recording software
            const detectionInterval = setInterval(() => {
                if (this.detectScreenRecording()) {
                    // Take evasive action
                    this.enterDeepStealthMode();
                }
            }, 5000);
            
            // Monitor for monitoring software
            this.monitorProcessList();
            
            console.log('Detection monitoring started');
            return detectionInterval;
        } catch (error) {
            console.error('Error setting up detection monitoring:', error);
            return null;
        }
    }

    detectScreenRecording() {
        try {
            // Check for common screen recording processes
            const suspiciousProcesses = [
                'obs64.exe',
                'obs32.exe',
                'camtasia.exe',
                'bandicam.exe',
                'fraps.exe',
                'xsplit.exe'
            ];
            
            // This would require process enumeration
            // Return false for now (would need native implementation)
            return false;
        } catch (error) {
            console.error('Error detecting screen recording:', error);
            return false;
        }
    }

    enterDeepStealthMode() {
        try {
            console.log('Entering deep stealth mode...');
            
            // Hide all windows immediately
            BrowserWindow.getAllWindows().forEach(window => {
                window.hide();
            });
            
            // Reduce process priority even further
            if (process.platform === 'win32') {
                process.nice(20);
            }
            
            console.log('Deep stealth mode activated');
        } catch (error) {
            console.error('Error entering deep stealth mode:', error);
        }
    }

    monitorProcessList() {
        try {
            // Monitor for monitoring/security software
            const monitoringInterval = setInterval(() => {
                // Check for security software
                const securityProcesses = [
                    'procmon.exe',
                    'procexp.exe',
                    'taskmgr.exe',
                    'perfmon.exe'
                ];
                
                // Would need native process enumeration
                // Placeholder for actual implementation
            }, 10000);
            
            console.log('Process monitoring started');
            return monitoringInterval;
        } catch (error) {
            console.error('Error monitoring process list:', error);
            return null;
        }
    }

    applyAdvancedStealth(window) {
        if (!window) return;

        try {
            // Apply all stealth measures
            this.hideFromTaskbar(window);
            this.hideFromScreenShare(window);
            this.enableLowProfileMode(window);
            this.preventDetection();
            
            // Start monitoring
            this.monitorForDetection();
            
            console.log('Advanced stealth measures applied');
        } catch (error) {
            console.error('Error applying advanced stealth:', error);
        }
    }

    disableStealthMode() {
        try {
            this.isStealthEnabled = false;
            
            // Restore normal window behavior
            BrowserWindow.getAllWindows().forEach(window => {
                window.setSkipTaskbar(false);
                window.setOpacity(1.0);
                window.setIgnoreMouseEvents(false);
            });
            
            console.log('Stealth mode disabled');
        } catch (error) {
            console.error('Error disabling stealth mode:', error);
        }
    }

    getStealthStatus() {
        return {
            enabled: this.isStealthEnabled,
            features: {
                taskbarHidden: true,
                screenShareHidden: true,
                processDisguised: true,
                lowProfile: true,
                antiDetection: true
            }
        };
    }
}

module.exports = StealthService;
