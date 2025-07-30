# Potentially Unused Dependencies

The following packages are listed in `package.json` but do not appear to be directly imported or required in the JavaScript files within the `src` directory.

**Note:** This analysis is based on static code analysis of `require()` and `import` statements in `.js` files within `src`. These packages might still be used:
*   In other parts of the project (e.g., HTML files, dynamically loaded, or in non-JavaScript files).
*   As transitive dependencies (dependencies of other dependencies).
*   By native modules or build processes not directly reflected in `src` imports.

Please verify their actual usage before considering removal.

---

## Dependencies (`dependencies` section in package.json)

*   `microphone-stream`: Not found to be directly imported.
*   `microsoft-cognitiveservices-speech-sdk`: Not found to be directly imported.
*   `openai-whisper`: Not found to be directly imported.
*   `robotjs`: Not found to be directly imported.
*   `sharp`: Not found to be directly imported.
*   `smart-buffer`: Not found to be directly imported.
*   `sqlite3`: While `better-sqlite3` is used, `sqlite3` itself is not directly imported. It might be a peer dependency or an alternative.
*   `wav`: Not found to be directly imported.
*   `form-data`: Not found to be directly imported.

## Development Dependencies (`devDependencies` section in package.json)

The following `devDependencies` are correctly placed as they are typically used for build processes, testing, or development tooling, and are not expected to be imported directly into application source code:

*   `@electron/rebuild`
*   `electron-builder`
*   `jest`
*   `mock-require`
