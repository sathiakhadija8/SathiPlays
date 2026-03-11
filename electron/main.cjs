const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const APP_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const PORT = Number(new URL(APP_URL).port || 3000);
let serverProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1300,
    minHeight: 900,
    maxWidth: 1300,
    maxHeight: 900,
    resizable: false,
    backgroundColor: '#0D0A22',
    title: 'SathiPlays',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  void win.loadURL(APP_URL);
}

function waitForServer(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for server on port ${port}`));
          return;
        }
        setTimeout(check, 300);
      });
    };
    check();
  });
}

async function ensureServer() {
  if (!app.isPackaged) return;

  const serverScript = path.join(app.getAppPath(), 'electron', '.app', 'server.js');
  serverProcess = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: 'ignore',
  });

  await waitForServer(PORT);
}

app.whenReady().then(() => {
  ensureServer()
    .then(createWindow)
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to boot embedded server:', error);
      app.quit();
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }
});
