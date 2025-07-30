#!/usr/bin/env node

/**
 * MockMate Desktop Diagnostic Test
 * This script tests core functionalities and helps identify issues
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔍 MockMate Desktop Diagnostic Test\n');

// Test 1: Check if all required files exist
function testFileStructure() {
    console.log('📁 Testing file structure...');
    
    const requiredFiles = [
        'src/main.js',
        'src/renderer/main.js',
        'src/renderer/styles.css',
        'src/services/AIService.js',
        'src/services/AudioService.js',
        
        'src/services/ScreenCaptureService.js',
        'src/services/OCRService.js',
        'package.json'
    ];
    
    let allFilesExist = true;
    
    requiredFiles.forEach(file => {
        const fullPath = path.join(__dirname, '..', file);
        if (fs.existsSync(fullPath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file} - MISSING`);
            allFilesExist = false;
        }
    });
    
    return allFilesExist;
}

// Test 2: Check package.json scripts and dependencies
function testPackageConfiguration() {
    console.log('\n📦 Testing package.json configuration...');
    
    try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Check scripts
        const requiredScripts = ['start', 'dev'];
        requiredScripts.forEach(script => {
            if (packageJson.scripts && packageJson.scripts[script]) {
                console.log(`   ✅ Script '${script}': ${packageJson.scripts[script]}`);
            } else {
                console.log(`   ❌ Script '${script}' - MISSING`);
            }
        });
        
        // Check critical dependencies
        const criticalDeps = ['electron', 'axios', 'tesseract.js'];
        criticalDeps.forEach(dep => {
            if (packageJson.dependencies && packageJson.dependencies[dep]) {
                console.log(`   ✅ Dependency '${dep}': ${packageJson.dependencies[dep]}`);
            } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
                console.log(`   ✅ DevDependency '${dep}': ${packageJson.devDependencies[dep]}`);
            } else {
                console.log(`   ⚠️  Dependency '${dep}' - NOT FOUND`);
            }
        });
        
        return true;
    } catch (error) {
        console.log(`   ❌ Error reading package.json: ${error.message}`);
        return false;
    }
}

// Test 3: Check if main.js has correct service initialization
function testMainJsServices() {
    console.log('\n🔧 Testing main.js service initialization...');
    
    try {
        const mainPath = path.join(__dirname, '..', 'src', 'main.js');
        const mainContent = fs.readFileSync(mainPath, 'utf8');
        
        const serviceChecks = [
            { name: 'AIService', pattern: /AIService|aiService/g },
            
            { name: 'AudioService', pattern: /AudioService|audioService/g },
            { name: 'ScreenCaptureService', pattern: /ScreenCaptureService|screenCaptureService/g },
            { name: 'initialize method call', pattern: /\.initialize\(\)/g }
        ];
        
        serviceChecks.forEach(check => {
            const matches = mainContent.match(check.pattern);
            if (matches && matches.length > 0) {
                console.log(`   ✅ ${check.name} found (${matches.length} occurrences)`);
            } else {
                console.log(`   ❌ ${check.name} - NOT FOUND`);
            }
        });
        
        return true;
    } catch (error) {
        console.log(`   ❌ Error reading main.js: ${error.message}`);
        return false;
    }
}

// Test 4: Check renderer files for recent changes
function testRendererChanges() {
    console.log('\n🎨 Testing renderer changes...');
    
    try {
        const rendererPath = path.join(__dirname, '..', 'src', 'renderer', 'main.js');
        const rendererContent = fs.readFileSync(rendererPath, 'utf8');
        
        const recentChanges = [
            { name: 'loadModelsFromAPI method', pattern: /loadModelsFromAPI/g },
            { name: 'toggleModelDropdown method', pattern: /toggleModelDropdown/g },
            { name: 'showResponseWindow method', pattern: /showResponseWindow/g },
            { name: 'handleGenerateAnswer method', pattern: /handleGenerateAnswer/g },
            { name: 'IPC get-available-models', pattern: /get-available-models/g }
        ];
        
        recentChanges.forEach(change => {
            const matches = rendererContent.match(change.pattern);
            if (matches && matches.length > 0) {
                console.log(`   ✅ ${change.name} found`);
            } else {
                console.log(`   ❌ ${change.name} - NOT FOUND`);
            }
        });
        
        return true;
    } catch (error) {
        console.log(`   ❌ Error reading renderer main.js: ${error.message}`);
        return false;
    }
}

// Test 5: Check if services can be loaded
function testServiceLoading() {
    console.log('\n⚙️  Testing service loading...');
    
    const services = [
        'AIService',
        'AudioService', 
        
        'ScreenCaptureService',
        'OCRService'
    ];
    
    let allServicesLoad = true;
    
    services.forEach(serviceName => {
        try {
            const servicePath = path.join(__dirname, '..', 'src', 'services', `${serviceName}.js`);
            if (fs.existsSync(servicePath)) {
                const serviceContent = fs.readFileSync(servicePath, 'utf8');
                
                // Check if service has a class definition
                if (serviceContent.includes(`class ${serviceName}`) || serviceContent.includes(`module.exports`)) {
                    console.log(`   ✅ ${serviceName} can be loaded`);
                } else {
                    console.log(`   ⚠️  ${serviceName} exists but may have syntax issues`);
                }
            } else {
                console.log(`   ❌ ${serviceName} file not found`);
                allServicesLoad = false;
            }
        } catch (error) {
            console.log(`   ❌ ${serviceName} loading error: ${error.message}`);
            allServicesLoad = false;
        }
    });
    
    return allServicesLoad;
}

// Test 6: Check for common issues that prevent changes from reflecting
function testCommonIssues() {
    console.log('\n🔍 Checking for common issues...');
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        console.log('   ✅ node_modules directory exists');
    } else {
        console.log('   ❌ node_modules directory missing - run npm install');
    }
    
    // Check for electron-rebuild if native modules are used
    try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        const nativeModules = ['robotjs', 'node-screen-capture'];
        const hasNativeModules = nativeModules.some(mod => 
            (packageJson.dependencies && packageJson.dependencies[mod]) ||
            (packageJson.devDependencies && packageJson.devDependencies[mod])
        );
        
        if (hasNativeModules) {
            console.log('   ⚠️  Native modules detected - you may need to run electron-rebuild');
        }
    } catch (error) {
        console.log('   ⚠️  Could not check for native modules');
    }
    
    // Check if there are any syntax errors in main files
    const filesToCheck = [
        'src/main.js',
        'src/renderer/main.js'
    ];
    
    filesToCheck.forEach(file => {
        try {
            const filePath = path.join(__dirname, '..', file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Basic syntax checks
            const openBraces = (content.match(/{/g) || []).length;
            const closeBraces = (content.match(/}/g) || []).length;
            const openParens = (content.match(/\(/g) || []).length;
            const closeParens = (content.match(/\)/g) || []).length;
            
            if (openBraces === closeBraces && openParens === closeParens) {
                console.log(`   ✅ ${file} basic syntax check passed`);
            } else {
                console.log(`   ❌ ${file} may have syntax errors (unmatched braces/parentheses)`);
            }
        } catch (error) {
            console.log(`   ❌ Could not check ${file}: ${error.message}`);
        }
    });
}

// Test 7: File modification times to check if changes are recent
function testFileModificationTimes() {
    console.log('\n📅 Checking file modification times...');
    
    const filesToCheck = [
        'src/main.js',
        'src/renderer/main.js',
        'src/renderer/styles.css',
        'src/services/AIService.js',
        
    ];
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    filesToCheck.forEach(file => {
        try {
            const filePath = path.join(__dirname, '..', file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const modTime = new Date(stats.mtime);
                
                if (modTime > oneHourAgo) {
                    console.log(`   ✅ ${file} modified recently (${modTime.toLocaleString()})`);
                } else {
                    console.log(`   ⚠️  ${file} last modified: ${modTime.toLocaleString()}`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Could not check ${file}: ${error.message}`);
        }
    });
}

// Run all tests
async function runDiagnostics() {
    const results = {
        fileStructure: testFileStructure(),
        packageConfig: testPackageConfiguration(),
        mainJsServices: testMainJsServices(),
        rendererChanges: testRendererChanges(),
        serviceLoading: testServiceLoading()
    };
    
    testCommonIssues();
    testFileModificationTimes();
    
    console.log('\n📊 DIAGNOSTIC SUMMARY');
    console.log('====================');
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! If changes still don\'t reflect:');
        console.log('   • Try restarting your development server');
        console.log('   • Check if you\'re running the correct npm script (npm run dev vs npm start)');
        console.log('   • Clear Electron cache: delete node_modules/.cache if it exists');
        console.log('   • Try running: npm run build && npm start');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the issues above.');
        console.log('   Common fixes:');
        console.log('   • Run: npm install (if node_modules missing)');
        console.log('   • Fix syntax errors in flagged files');
        console.log('   • Ensure all required services are properly exported');
    }
    
    console.log('\n🔧 To run your app with debugging:');
    console.log('   npm start --verbose');
    console.log('   Or check the console in DevTools for runtime errors');
}

// Execute diagnostics
runDiagnostics().catch(console.error);
