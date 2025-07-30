# MockMate AI - 100% Stealth Interview Assistant

A sophisticated AI-powered desktop application designed to provide real-time assistance during technical interviews with advanced stealth capabilities.

## 🚀 Features

### Core Functionality
- **Real-time Audio Transcription**: Microphone and system audio capture with speech-to-text
- **AI-Powered Responses**: Context-aware answers using Pollination API (Gemini Pro, GPT-4 Turbo, Claude 3.5)
- **Screen Analysis**: OCR-based question extraction from screen content
- **Resume & Job Description Processing**: Contextual AI responses based on your background
- **Global Hotkeys**: System-wide keyboard shortcuts for seamless control

### Stealth Capabilities
- **Invisible to Alt+Tab**: Windows hidden from task switcher
- **Screen Share Protection**: Excluded from screen capture (Windows 10 2004+)
- **Process Disguising**: Legitimate-looking process names
- **Always on Top**: Overlays above all applications
- **Transparent UI**: Glass-morphism design with transparency

### AI Models Supported
- Gemini Pro (Google)
- GPT-4 Turbo (OpenAI)
- Claude 3.5 Sonnet (Anthropic)
- Llama 3 70B (Meta)
- Mixtral 8x7B (Mistral AI)

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- Windows 10/11
- FFmpeg (for system audio capture)

### Quick Setup
```bash
# Clone and navigate to directory
cd E:\mockmatedesktop

# Install dependencies
npm install

# Start the application
npm start
```

### Dependencies Installation
```bash
# Core dependencies (automatically installed)
npm install electron@28.0.0
npm install axios@1.6.2
npm install tesseract.js@5.0.4
npm install screenshot-desktop@1.15.0
npm install sharp@0.33.1
npm install electron-localshortcut@3.2.1
npm install node-record-lpcm16@1.0.1
npm install electron-store@8.1.0
npm install pdf-parse@1.1.1
npm install mammoth@1.9.1
```

### Optional Enhancements
```bash
# For better .doc file support
npm install textract

# For enhanced Windows integration
npm install robotjs@0.6.0
npm install node-window-manager@2.2.4
```

## ⌨️ Hotkeys

| Hotkey | Function |
|--------|----------|
| `Shift+S` | Toggle System Sound Capture |
| `Ctrl+Z` | Trigger AI Answer Generation |
| `Ctrl+X` | Hide/Show Windows |
| `Ctrl+Q` | Toggle Microphone |
| `Ctrl+A` | Analyze Screen (OCR) |
| `Ctrl+I` | Focus Question Input |
| `Ctrl+C` | Clear Transcription Area |
| `Ctrl+>` | Move Windows Left |
| `Ctrl+<` | Move Windows Right |
| `Ctrl+-` | Decrease Window Size |
| `Ctrl+=` | Increase Window Size |
| `Enter` | Submit Question (when input focused) |

## 🎯 Usage Guide

### 1. Initial Setup
1. Launch the application: `npm start`
2. Two windows will appear:
   - **Control Panel**: Main interface (top center)
   - **Response Window**: AI responses (below control panel)

### 2. Upload Context Files
- **Resume**: Click "Upload Resume" to process PDF/DOCX/TXT files
- **Job Description**: Upload job posting for contextual responses
- **Company Info**: Enter company name and position details

### 3. Audio Capture
- **Microphone**: Enable to capture your voice and interviewer questions
- **System Sound**: Capture audio from video calls (Teams, Zoom, etc.)
- Real-time transcription appears in the listening area

### 4. Screen Analysis
- Use `Ctrl+A` to capture and analyze screen content
- Automatically extracts interview questions from:
  - Video call chat windows
  - Shared documents
  - Online coding platforms
  - Interview question displays

### 5. AI Response Generation
- **Automatic**: Triggered when questions are detected
- **Manual**: Use `Ctrl+Z` or click "Generate Answer"
- **Contextual**: Responses based on your resume and job requirements
- **Concise**: Focused answers under 150 words

### 6. Stealth Operation
- Windows automatically hide from:
  - Windows taskbar
  - Alt+Tab switcher
  - Screen sharing (when supported)
- Process appears as legitimate Windows service
- Always stays on top during interviews

## 🔧 Configuration

### AI Model Selection
Access the dropdown in the control panel to switch between:
- **Gemini Pro**: Best for technical questions
- **GPT-4 Turbo**: Comprehensive responses
- **Claude 3.5**: Detailed explanations
- **Llama 3**: Open-source alternative
- **Mixtral**: Fast responses

### Audio Settings
```javascript
// Microphone configuration
sampleRate: 16000
channels: 1
threshold: 0.5

// System audio (requires FFmpeg)
format: 'dshow'
codec: 'pcm_s16le'
```

### Stealth Configuration
```javascript
// Window properties
alwaysOnTop: true
skipTaskbar: true
transparent: true
frame: false

// Screen capture exclusion (Windows 10 2004+)
setWindowDisplayAffinity: WDA_EXCLUDEFROMCAPTURE
```

## 🏗️ Architecture

### Core Components
- **Main Process** (`src/main.js`): Electron app lifecycle
- **AI Service** (`src/services/AIService.js`): Pollination API integration
- **Audio Service** (`src/services/AudioService.js`): Audio capture and transcription
- **Context Service** (`src/services/ContextService.js`): Resume/job processing
- **Stealth Service** (`src/services/StealthService.js`): Windows hiding capabilities

### File Structure
```
E:\mockmatedesktop\
├── src/
│   ├── main.js                 # Main application
│   └── services/
│       ├── AIService.js        # AI integration
│       ├── AudioService.js     # Audio processing
│       ├── ContextService.js   # File processing
│       └── StealthService.js   # Stealth capabilities
├── mockmate-control-panel.html # Main UI
├── mockmate-response-window.html # Response display
├── package.json                # Dependencies
└── README.md                   # This file
```

## 🔒 Privacy & Security

### Data Handling
- **Local Processing**: Resume and job descriptions processed locally
- **API Calls**: Only questions sent to AI services
- **No Persistence**: Transcriptions not saved to disk
- **Memory Cleanup**: Temporary files automatically deleted

### Stealth Considerations
- Designed for legitimate interview assistance
- Respects interviewer privacy (no recording saved)
- Invisible operation during screen sharing
- Process disguising for discretion

## 🚨 Troubleshooting

### Common Issues

#### Audio Not Working
```bash
# Install audio dependencies
npm install node-record-lpcm16 --force

# For system audio on Windows
# Install FFmpeg from https://ffmpeg.org/
```

#### OCR Not Recognizing Text
```bash
# Reinstall Tesseract
npm uninstall tesseract.js
npm install tesseract.js@5.0.4
```

#### Stealth Mode Not Working
- Ensure Windows 10 version 2004+ for screen capture exclusion
- Run as administrator for enhanced stealth features
- Check Windows Security settings for process hiding permissions

#### AI Responses Not Generated
- Verify internet connection
- Check Pollination API status
- Ensure valid model selection
- Review console for API errors

### Debug Mode
```bash
# Run with debugging enabled
set NODE_ENV=development && npm start
```

### Log Files
- Main logs: Console output
- Error logs: Automatic console error reporting
- Audio logs: Real-time transcription status

## 🔮 Advanced Configuration

### Custom AI Prompts
Modify `src/services/AIService.js`:
```javascript
buildPrompt(context) {
    // Customize prompt structure
    let prompt = `Expert interview response for ${context.company}...`;
    return prompt;
}
```

### Audio Quality Settings
Adjust in `src/services/AudioService.js`:
```javascript
const options = {
    sampleRate: 44100,    // Higher quality
    channels: 2,          // Stereo
    threshold: 0.3        // More sensitive
};
```

### Stealth Enhancements
Add to `src/services/StealthService.js`:
```javascript
enableAdvancedStealth() {
    // Custom Windows API integrations
    // Process injection techniques
    // Registry modifications
}
```

## 📄 License

MIT License - See LICENSE file for details.

## ⚠️ Disclaimer

This software is designed for legitimate interview preparation and assistance. Users are responsible for ensuring compliance with interview policies and applicable laws. The stealth features are intended for privacy and discretion, not for deceptive practices.

## 🆘 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Ensure all dependencies are correctly installed
4. Verify system compatibility (Windows 10/11)

---

**MockMate AI** - Your intelligent, invisible interview companion. 🚀
