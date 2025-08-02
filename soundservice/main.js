const { app, BrowserWindow, desktopCapturer, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Intercept getDisplayMedia
  session.defaultSession.setDisplayMediaRequestHandler((_, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
      callback({
        video: sources[0],   // required placeholder
        audio: 'loopback'    // Windows system audio
      });
    });
  });

  win.loadFile('renderer.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const FFmpeg = require('fluent-ffmpeg');
FFmpeg.setFfmpegPath(ffmpegPath);

ipcMain.handle('write-webm', async (_, buffer) => {
  const tmpWebm = require('path').join(require('os').tmpdir(), 'tmp.webm');
  fs.writeFileSync(tmpWebm, buffer);

  const { filePath } = await dialog.showSaveDialog({
    defaultPath: 'system-audio.wav',
    filters: [{ name: 'WAV files', extensions: ['wav'] }]
  });

  if (!filePath) return null;

  await new Promise((resolve, reject) => {
    FFmpeg(tmpWebm)
      .outputOptions([
        '-f wav',
        '-ar 44100',
        '-ac 1',
        '-sample_fmt s16'
      ])
      .save(filePath)
      .on('end', resolve)
      .on('error', reject);
  });

  fs.unlinkSync(tmpWebm);
  return filePath;
});