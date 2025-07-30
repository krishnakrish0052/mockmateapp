const path = require('path');
const MockMateApp = require('../../src/main');

// Mock Electron modules using jest.mock
jest.mock('electron', () => ({
    app: {
        whenReady: jest.fn(() => Promise.resolve()),
        on: jest.fn(),
        quit: jest.fn(),
        emit: jest.fn(),
        getPath: jest.fn(() => '/mock/path'),
        getAppPath: jest.fn(() => '/mock/app/path'),
    },
    BrowserWindow: jest.fn(() => ({
        loadFile: jest.fn(),
        on: jest.fn(),
        once: jest.fn((event, cb) => {
            if (event === 'ready-to-show') {
                cb(); // Immediately call ready-to-show for tests
            }
        }),
        show: jest.fn(),
        hide: jest.fn(),
        close: jest.fn(),
        setAlwaysOnTop: jest.fn(),
        setSkipTaskbar: jest.fn(),
        setIgnoreMouseEvents: jest.fn(),
        getBounds: jest.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
        webContents: {
            send: jest.fn(),
            once: jest.fn(),
            on: jest.fn(),
        },
        getNativeWindowHandle: jest.fn(() => ({})),
        setContentProtection: jest.fn(), // Added setContentProtection mock
        setBounds: jest.fn(), // Added setBounds mock
    })),
    globalShortcut: {
        register: jest.fn(),
        unregisterAll: jest.fn(),
    },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
    },
    screen: {
        getPrimaryDisplay: jest.fn(() => ({
            workAreaSize: { width: 1920, height: 1080 },
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        })),
        getAllDisplays: jest.fn(() => ([{
            id: 1,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            workArea: { x: 0, y: 0, width: 1920, height: 1080 },
            scaleFactor: 1,
            rotation: 0,
            touchSupport: 'available',
            isPrimary: true
        }])),
        on: jest.fn(),
    },
    desktopCapturer: {
        getSources: jest.fn(() => Promise.resolve([])),
    },
    clipboard: {
        writeText: jest.fn(),
        readText: jest.fn(),
    },
}));

// Mock dotenv
jest.mock('dotenv', () => ({
    config: jest.fn(),
}));

// Mock services to prevent actual file operations/network calls during main process tests
jest.mock('../../src/services/AIService', () => jest.fn(() => ({
    generateResponse: jest.fn(() => Promise.resolve({ response: 'Mock AI Response' })),
    setModel: jest.fn(),
    getAvailableModels: jest.fn(() => Promise.resolve([])),
}))
);
jest.mock('../../src/services/ScreenCaptureService', () => jest.fn(() => ({
    captureFullScreen: jest.fn(() => Promise.resolve({ success: true, imageData: 'mockImageData' })),
    captureSpecificWindow: jest.fn(() => Promise.resolve({ success: true, imageData: 'mockImageData' })),
    captureRegion: jest.fn(() => Promise.resolve({ success: true, imageData: 'mockImageData' })),
    getDisplayInfo: jest.fn(() => Promise.resolve({ success: true, displays: [] })),
    detectInterviewPlatforms: jest.fn(() => Promise.resolve({ success: true, platforms: [] })),
}))
);
jest.mock('../../src/services/OCRService', () => jest.fn(() => ({
    performOCR: jest.fn(() => Promise.resolve({ processedText: 'mock OCR text' })),
    getPerformanceStats: jest.fn(() => ({})),
    healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
}))
);
jest.mock('../../src/services/QuestionDetectionService', () => jest.fn(() => ({
    detectQuestions: jest.fn(() => Promise.resolve({ success: true, questions: [] })),
    getStats: jest.fn(() => ({})),
    healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
}))
);
jest.mock('../../src/services/DocumentIntelligenceService', () => jest.fn(() => ({
    analyzeResumeFile: jest.fn(() => Promise.resolve({ success: true, data: {} })),
    analyzeResumeText: jest.fn(() => Promise.resolve({ success: true, data: {} })),
    analyzeJobDescription: jest.fn(() => Promise.resolve({ success: true, data: {} })),
    calculateMatchScore: jest.fn(() => ({ score: 0 })),
    generateResumeInsights: jest.fn(() => Promise.resolve({})),
    generateJobInsights: jest.fn(() => Promise.resolve({})),
    generateInterviewQuestions: jest.fn(() => Promise.resolve([])),
    getPerformanceStats: jest.fn(() => ({})),
    healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
}))
);
jest.mock('../../src/services/StealthService', () => jest.fn(() => ({
    toggleStealthMode: jest.fn(() => Promise.resolve(true)),
    applyStealthMeasures: jest.fn(() => Promise.resolve()),
    getStatus: jest.fn(() => Promise.resolve({ enabled: false })),
}))
);
jest.mock('../../src/services/DatabaseService', () => jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve(true)),
    createSession: jest.fn(() => Promise.resolve({ sessionId: 'mock-session-id' })),
    endSession: jest.fn(() => Promise.resolve(true)),
    getSessions: jest.fn(() => Promise.resolve([])),
    storeQuestion: jest.fn(() => Promise.resolve({ questionId: 'mock-question-id' })),
    storeResponse: jest.fn(() => Promise.resolve({ responseId: 'mock-response-id' })),
    getQuestions: jest.fn(() => Promise.resolve([])),
    getResponses: jest.fn(() => Promise.resolve([])),
    saveUserPreferences: jest.fn(() => Promise.resolve(true)),
    getUserPreferences: jest.fn(() => Promise.resolve({})),
    storeResumeData: jest.fn(() => Promise.resolve({ resumeId: 'mock-resume-id' })),
    getResumeData: jest.fn(() => Promise.resolve({})),
    logAnalytics: jest.fn(() => Promise.resolve(true)),
    getAnalytics: jest.fn(() => Promise.resolve([])),
    getUsageStats: jest.fn(() => Promise.resolve({})),
    exportData: jest.fn(() => Promise.resolve({})),
    importData: jest.fn(() => Promise.resolve({})),
    cleanupOldData: jest.fn(() => Promise.resolve({})),
    healthCheck: jest.fn(() => Promise.resolve({ status: 'healthy' })),
    getStats: jest.fn(() => Promise.resolve({})),
}))
);

// Import the actual MockMateApp after mocks are set up


let mockMateAppInstance;

describe('MockMate Desktop Application Tests', () => {

    beforeAll(async () => {
        // Clear all mocks before each test suite
        jest.clearAllMocks();
        // Mock the initialize method to prevent actual service initialization
        // and avoid issues with unmocked dependencies during initialization.
        MockMateApp.prototype.initialize = jest.fn(async function() {
            const { app } = require('electron'); // Import app here
            await app.whenReady(); // Ensure app.whenReady is called
            this.aiService = {}; // Mock a simple object
            this.screenCaptureService = {};
            this.ocrService = {};
            this.questionDetectionService = {};
            this.documentIntelligenceService = {};
            this.stealthService = {};
            this.databaseService = { initialize: jest.fn() };
            this.isInitialized = true;
            console.log('MockMate AI initialized successfully');

            // Call the original methods that register IPC handlers and shortcuts
            this.createControlWindow();
            this.createResponseWindow();
            this.setupGlobalShortcuts();
            this.setupIPCHandlers();
            this.setupModelIPCHandlers();
        });
        mockMateAppInstance = new MockMateApp();
        await mockMateAppInstance.initialize();
    });

    afterAll(() => {
        // Clean up mocks
        jest.restoreAllMocks();
    });

    it('should initialize the application and services', async () => {
        const { app } = require('electron'); // Re-require to get the mocked version
        expect(app.whenReady).toHaveBeenCalledTimes(1);
        expect(mockMateAppInstance.isInitialized).toBe(true);
        expect(mockMateAppInstance.aiService).toBeDefined();
        expect(mockMateAppInstance.databaseService).toBeDefined();
        expect(mockMateAppInstance.stealthService).toBeDefined();
        expect(mockMateAppInstance.screenCaptureService).toBeDefined();
        expect(mockMateAppInstance.ocrService).toBeDefined();
        expect(mockMateAppInstance.questionDetectionService).toBeDefined();
        expect(mockMateAppInstance.documentIntelligenceService).toBeDefined();
        expect(mockMateAppInstance.databaseService.initialize).toHaveBeenCalledTimes(1);
        // Expect these methods to be called on the instance, not directly on the class
        expect(mockMateAppInstance.createControlWindow).toHaveBeenCalledTimes(1);
        expect(mockMateAppInstance.setupGlobalShortcuts).toHaveBeenCalledTimes(1);
        expect(mockMateAppInstance.setupIPCHandlers).toHaveBeenCalledTimes(1);
        expect(mockMateAppInstance.setupStealthIPCHandlers).toHaveBeenCalledTimes(1);
        expect(mockMateAppInstance.setupDatabaseIPCHandlers).toHaveBeenCalledTimes(1);
        expect(mockMateAppInstance.setupModelIPCHandlers).toHaveBeenCalledTimes(1);
    });

    it('should register global shortcuts', () => {
        const { globalShortcut } = require('electron'); // Re-require to get the mocked version
        expect(globalShortcut.register).toHaveBeenCalledWith('Shift+S', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Z', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+X', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Q', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+A', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+I', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+C', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+M', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+.', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+,', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+-', expect.any(Function));
        expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+=', expect.any(Function));
    });

    it('should handle IPC events', () => {
        const { ipcMain } = require('electron'); // Re-require to get the mocked version
        expect(ipcMain.handle).toHaveBeenCalledWith('generate-ai-response', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('set-model', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('get-models', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('open-file-dialog', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('process-resume', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('capture-screen', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('capture-window', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('capture-region', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('get-display-info', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('detect-interview-platforms', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('analyze-screen-content', expect.any(Function));
        expect(ipcMain.on).toHaveBeenCalledWith('toggle-system-sound', expect.any(Function));
        expect(ipcMain.on).toHaveBeenCalledWith('toggle-microphone', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('get-current-model', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('set-model-from-window', expect.any(Function));
        expect(ipcMain.on).toHaveBeenCalledWith('close-model-window', expect.any(Function));
        expect(ipcMain.on).toHaveBeenCalledWith('hide-model-window', expect.any(Function));
        expect(ipcMain.on).toHaveBeenCalledWith('model-selection-changed', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('perform-ocr', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('detect-questions', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('get-ocr-stats', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('get-question-detection-stats', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('health-check', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('analyze-resume-file', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('analyze-resume-text', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('analyze-job-description', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('calculate-match-score', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('generate-resume-insights', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('generate-job-insights', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('generate-interview-questions', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('get-document-intelligence-stats', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('batch-analyze-resumes', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('process-resume-advanced', expect.any(Function));
        expect(mockIpcMain.on).toHaveBeenCalledWith('end-session', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('create-session', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('end-session-db', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-sessions', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('store-question', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('store-response', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-questions', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-responses', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('save-user-preferences', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-user-preferences', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('store-resume-data', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-resume-data', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('log-analytics', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-analytics', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-usage-stats', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('export-data', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('import-data', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('cleanup-old-data', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('database-health-check', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-database-stats', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-available-models', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('initialize-session', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-question-history', expect.any(Function));
    });

    it('should handle app lifecycle events', async () => {
        const { app, globalShortcut } = require('electron'); // Re-require to get the mocked version
        // Simulate app ready event
        await app.whenReady();
        expect(mockMateAppInstance.isInitialized).toBe(true);

        // Simulate window-all-closed event
        app.emit('window-all-closed');
        expect(app.quit).toHaveBeenCalledTimes(1);

        // Simulate activate event
        app.emit('activate');
        // Expect initialize to be called again if no windows are open
        expect(mockMateAppInstance.initialize).toHaveBeenCalledTimes(2);

        // Simulate will-quit event
        app.emit('will-quit');
        expect(globalShortcut.unregisterAll).toHaveBeenCalledTimes(1);
    });
});