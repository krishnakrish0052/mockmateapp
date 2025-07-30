# MockMate AI: Implementation Tasks

This document outlines the tasks required to transform MockMate AI into a fully functional, real-world application, addressing the user's specific requests.

## Phase 1: Initial Setup & Codebase Refinement

### Task 1.1: Consolidate Renderer Logic
*   **Problem:** Duplication of `MockMateController` logic between `mockmate-control-panel.html` (embedded script) and `src/renderer/main.js`. The `src/renderer/main.js` version is more complete and uses IPC correctly.
*   **Action:**
    1.  Remove the embedded `<script>` content from `mockmate-control-panel.html`.
    2.  Ensure `mockmate-control-panel.html` correctly loads `src/renderer/main.js` as its primary script.
    3.  Verify that all UI interactions and IPC calls are handled exclusively by `src/renderer/main.js`.
*   **Status:** Completed.

### Task 1.2: Remove Demo and Simulated Code
*   **Problem:** Placeholder or simulated functionalities exist.
*   **Action:**
    1.  In `src/renderer/main.js`, remove or refactor `startSimulatedTranscription()` and any related calls, replacing it with actual microphone/system sound transcription logic.
    2.  Review `src/services/AIService.js` to ensure no "demo" models are hardcoded if dynamic fetching is intended (this will be addressed more fully in Phase 4).
    3.  Review all files for any other explicit "demo" or "simulated" comments/code and remove/replace them.
*   **Status:** Completed.

## Phase 2: UI Enhancements

### Task 2.1: Increase Width of Company and Job Description Fields
*   **Problem:** The "Company" and "Job Description" input fields in the header of the main window (`mockmate-control-panel.html`) are too narrow.
*   **Action:**
    1.  Locate the CSS rules for `.company-input` and `.job-input` in `mockmate-control-panel.html`.
    2.  Increase their `width` property by approximately 40% while maintaining responsiveness. Adjust `max-width` or `flex-basis` as needed.
*   **Status:** Completed.

### Task 2.2: Make AI Response Window Always Visible
*   **Problem:** The AI response window currently appears only when a response is generated.
*   **Action:**
    1.  Modify `src/main.js` to create the `responseWindow` during initial application setup (`initialize()` method).
    2.  Ensure the `responseWindow` is set to `show: true` and remains open by default.
    3.  Update `showLoadingResponse()` and `updateResponseWindow()` in `src/main.js` to send data to the existing window instead of creating/closing it.
    4.  Remove the close button and its associated JavaScript logic from `mockmate-response-window.html`.
*   **Status:** Completed.

### Task 2.3: Add Margin and Dynamic Height to Response Window
*   **Problem:** The response window needs a margin from the main window and its height should dynamically adjust to content, becoming scrollable if it exceeds screen height.
*   **Action:**
    1.  Adjust the `responseY` calculation in `src/main.js` to include a margin.
    2.  Modify `createResponseWindow` in `src/main.js` to set an initial height and listen for resize requests from the renderer.
    3.  Add an IPC handler in `src/main.js` to receive the content height from the renderer and resize the window accordingly, up to a maximum screen-dependent height.
    4.  Modify `mockmate-response-window.html` to dynamically calculate its content height and send it to the main process, and ensure its content area is scrollable.
*   **Status:** Completed.

### Task 2.4: Change Copy Button to Close Button in Response Window Header
*   **Problem:** The response window header has a copy button, but a close button is desired.
*   **Action:**
    1.  Change the `id`, `title`, and `material-icons` of the button in the `response-actions` div in `mockmate-response-window.html`.
    2.  Update the JavaScript event listener for the button to call a `closeWindow` function, and implement that function to send an IPC message to the main process to close the window.
*   **Status:** Completed.

### Task 2.5: Decrease Header Size of Response Window
*   **Problem:** The header of the response window is too large.
*   **Action:**
    1.  Adjust the `min-height` and `padding` properties of the `.response-header` CSS rule in `mockmate-response-window.html` by 50%.
*   **Status:** Completed.

## Phase 3: Core Functionality Fixes & Debugging

### Task 3.1: Fix OCR Functionality (Tesseract Only)
*   **Problem:** OCR is not working, and cloud providers are no longer desired.
*   **Action:**
    1.  **Remove Cloud OCR Providers:** Modify `src/services/OCRService.js` to remove all code related to Azure, Google, and AWS Vision APIs. Ensure Tesseract is the only OCR provider.
    2.  **Verify Tesseract Setup:** Ensure `tesseract.js` is correctly installed and its dependencies are met for local OCR.
    3.  **Add Comprehensive Logging:** Add detailed logging within `src/services/OCRService.js` to trace execution flow and identify errors during Tesseract OCR operations.
    4.  **Test OCR Functionality:** Test OCR functionality independently (e.g., using the temporary IPC handler in `main.js` and a test image).
*   **Status:** In Progress.

### Task 3.2: Implement System Sound Capture and Transcription
*   **Problem:** System Sound capture is not working and needs a specific implementation flow.
*   **Action:**
    1.  **FFmpeg Setup:** Ensure FFmpeg is correctly installed and its path is detectable by `src/services/SystemAudioService.js`. Implement robust download/installation logic if not found.
    2.  **`node-wasapi` Integration (Conceptual):** Research and integrate `node-wasapi` (or a suitable alternative for Windows system audio capture) into `src/services/SystemAudioService.js`. This will replace the current FFmpeg-based capture for real-time audio streaming.
    3.  **Audio Buffer Accumulation:** Implement logic in `src/services/SystemAudioService.js` to accumulate audio data into a buffer.
    4.  **Whisper Engine Integration:** Integrate a Whisper engine (e.g., `whisper-node` or a similar local/API-based solution) into `src/services/SpeechService.js` for transcribing the accumulated audio buffer.
    5.  **Real-time Transcription:** Implement a mechanism to continuously transcribe chunks of the audio buffer and send the transcribed text via IPC to the renderer process.
    6.  **Logging:** Add comprehensive logging to `src/services/SystemAudioService.js` and `src/services/SpeechService.js` to monitor audio capture, buffering, and transcription.
*   **Status:** Not Started.

### Task 3.3: Implement Microphone Capture and Transcription
*   **Problem:** Microphone input is not working and needs a specific implementation flow.
*   **Action:**
    1.  **`node-record-lpcm16` Integration:** Integrate `node-record-lpcm16` into `src/services/AudioService.js` for capturing microphone input. This will replace the Web Speech API approach for robust local recording.
    2.  **Audio Buffer Accumulation:** Implement logic in `src/services/AudioService.js` to accumulate microphone audio data into a buffer.
    3.  **Whisper Engine Integration:** Ensure the Whisper engine integrated in `src/services/SpeechService.js` can also process audio from the microphone buffer.
    4.  **Real-time Transcription:** Implement a mechanism to continuously transcribe chunks of the microphone audio buffer and send the transcribed text via IPC to the renderer process.
    5.  **Logging:** Add comprehensive logging to `src/services/AudioService.js` and `src/services/SpeechService.js` to monitor microphone capture, buffering, and transcription.
*   **Status:** Not Started.

### Task 3.4: Fix Model Window Display
*   **Problem:** The model selection window is not showing.
*   **Action:**
    1.  Debug `createModelWindow` and `showModelWindow` in `src/main.js` to ensure the `BrowserWindow` is being created and shown correctly.
    2.  Verify IPC communication for `toggle-model-window` and `hide-model-window` between `src/renderer/main.js` and `src/main.js`.
    3.  Ensure `mockmate-model-window.html` is correctly loaded and its `ipcRenderer` listeners are active.
*   **Status:** Not Started.

### Task 3.5: Fix Generate Answers Functionality
*   **Problem:** AI answer generation is not working.
*   **Action:**
    1.  Verify `process.env.POLLINATION_API_KEY` is correctly set and accessible in `src/services/AIService.js`.
    2.  Add extensive logging within `src/services/AIService.js` (especially in `generateResponse` and `generateResponseFallback`) to capture API request/response details and any errors from the Pollinations API.
    3.  Ensure the `prompt` being sent to the AI is well-formed and contains all necessary context.
    4.  Debug `handleGenerateAnswer` in `src/renderer/main.js` to ensure the `context` object is correctly assembled and sent via IPC.
*   **Status:** Not Started.

### Task 3.6: Fix Analyze Screen Functionality
*   **Problem:** Screen analysis is not working.
*   **Action:**
    1.  Verify screen capture permissions are granted to the Electron application.
    2.  Debug `captureFullScreen` in `src/services/ScreenCaptureService.js` to ensure it successfully captures screen data.
    3.  Trace the flow from `handleAnalyzeScreen` in `src/renderer/main.js` through `capture-screen` IPC, `analyze-screen-content` IPC, `OCRService.js`, and `QuestionDetectionService.js`.
    4.  Ensure the `OCRService` and `QuestionDetectionService` are correctly processing the captured image data and extracting questions.
*   **Status:** Not Started.

## Phase 4: Pollinations.ai Model Integration

### Task 4.1: Dynamically Fetch Models from Pollinations API
*   **Problem:** The model list is hardcoded in `mockmate-model-window.html` and `src/renderer/main.js`, and `AIService.js`'s `getAvailableModels` returns hardcoded values.
*   **Action:**
    1.  Modify `src/services/AIService.js`'s `fetchAvailableModels` method to make an actual `axios.get` call to `https://text.pollinations.ai/models`.
    2.  Ensure `getAvailableModels` in `AIService.js` returns the dynamically fetched list.
    3.  Update `src/renderer/main.js`'s `loadModelsFromAPI` to correctly use the IPC call to `get-available-models` and populate the custom model selector.
    4.  Update `mockmate-model-window.html` to receive the dynamic model list from `src/main.js` (via IPC) and populate its dropdown accordingly.
*   **Status:** Not Started.

## Phase 5: AI Response Flow Refinement

### Task 5.1: Enhance AI Prompt with Contextual Information
*   **Problem:** Ensure company name, job description, and resume details are fully utilized for 100% accurate and related AI answers.
*   **Action:**
    1.  Review `src/services/AIService.js`'s `buildPrompt` method.
    2.  Ensure that `context.company`, `context.jobDescription`, and `context.resumeSkills` (or similar resume data extracted by `DocumentIntelligenceService`) are consistently passed from `src/main.js` to `AIService.js` when `generate-ai-response` is invoked.
    3.  Refine the prompt templates in `AIService.js` (`getBehavioralPromptTemplate`, `getTechnicalPromptTemplate`) to explicitly instruct the AI to leverage the provided company, job, and resume context for more tailored responses.
    4.  Consider adding a mechanism to pass more detailed resume data (e.g., specific projects, experience summaries) to the AI prompt if `DocumentIntelligenceService` extracts them.
*   **Status:** Not Started.

## Phase 6: Testing & Verification

### Task 6.1: Run Project Build and Linting
*   **Problem:** Ensure code quality and adherence to project standards after modifications.
*   **Action:**
    1.  Identify the project's build, linting, and type-checking commands (e.g., `npm run build`, `npm run lint`, `tsc`).
    2.  Execute these commands and resolve any reported errors or warnings.
*   **Status:** Not Started.

### Task 6.2: Comprehensive Functional Testing
*   **Problem:** Verify all features work as expected.
*   **Action:**
    1.  Manually test all functionalities:
        *   UI elements (buttons, inputs, model selector).
        *   Hotkeys.
        *   Upload Resume (with various file types).
        *   Analyze Screen (with different screen contents).
        *   Mic and System Sound (ensure transcription works).
        *   Generate Answers (with different questions and contexts).
        *   AI Response Display (check content, formatting, copy/close).
        *   Model Selection (ensure dynamic list and selection works).
    2.  Verify that "demo" and "simulated" aspects are completely removed.
*   **Status:** Not Started.
