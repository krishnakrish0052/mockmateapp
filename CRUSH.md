# MockMate Desktop - Development Guide

## Project Overview
MockMate is an AI-powered interview assistance desktop application built with Electron. It provides real-time answers to interview questions while maintaining stealth capabilities.

## Build Commands
```bash
# Start development version
npm run dev

# Build for current platform
npm run build

# Build for Windows
npm run build-win

# Create distributable package
npm run dist
```

## Test Commands
```bash
# Run all tests
npm test

# Run tests with Jest
npx jest

# Run a specific test file
npx jest path/to/test-file.test.js

# Run tests in watch mode
npx jest --watch
```

## Code Style Guidelines

### Imports
- Use CommonJS require() statements
- Group imports in logical order: Node.js built-ins, external packages, internal modules
- Example:
  ```javascript
  const fs = require('fs');
  const axios = require('axios');
  const AIService = require('./services/AIService');
  ```

### Formatting
- Use 4-space indentation (no tabs)
- No semicolons at end of lines
- Use single quotes for strings
- Keep lines under 100 characters when possible
- Add a newline at the end of each file

### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes
- Use UPPER_CASE for constants
- Be descriptive with variable names

### Types and Documentation
- No explicit type annotations (JavaScript, not TypeScript)
- Use JSDoc comments for complex functions
- Document function parameters and return values when not obvious

### Error Handling
- Always wrap async operations in try/catch blocks
- Log errors with console.error() for debugging
- Provide meaningful error messages to users
- Use specific error types when appropriate

### Async/Await
- Prefer async/await over callbacks or .then()
- Always handle promise rejections
- Use Promise.all() for concurrent operations when appropriate

### Database and Security
- Always encrypt sensitive data before storing
- Close database connections properly
- Validate all user inputs
- Handle API errors gracefully with fallbacks

### GitIgnore Updates
- Add .crush directory to .gitignore for Crush working files

## Additional Notes
- This is an Electron application with separate main and renderer processes
- Services are modular and should remain loosely coupled
- Use the existing logging pattern with emojis for status indicators
- Follow the established pattern for service classes with initialize() methods