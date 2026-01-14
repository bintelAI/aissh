const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;
let backendPort = null;
let resolveBackendPort;
const backendPortPromise = new Promise((resolve) => {
  resolveBackendPort = resolve;
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

ipcMain.handle('get-backend-port', async () => {
  console.log('[Main] get-backend-port requested');
  if (backendPort !== null) {
    return backendPort;
  }
  
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Backend port request timed out')), 10000);
  });

  try {
    return await Promise.race([backendPortPromise, timeoutPromise]);
  } catch (err) {
    console.error('[Main] Failed to get backend port:', err);
    return 3001; // Fallback to default
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: 'hiddenInset', // Mac style
    backgroundColor: '#000000',
  });

  if (!app.isPackaged) {
    // In dev, we wait for Vite to serve
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In prod, we load the index.html
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  let backendDist;
  
  if (app.isPackaged) {
    // In production, backend is bundled in extraResources
    // Note: On Mac, process.resourcesPath is usually Contents/Resources
    backendDist = path.join(process.resourcesPath, 'backend', 'index.cjs');
  } else {
    // In development
    backendDist = path.join(__dirname, '../back/dist/main.js');
  }
  
  console.log('[Main] Backend dist path:', backendDist);
  
  // Check if backend dist exists
  if (!fs.existsSync(backendDist)) {
    console.error('[Main] Backend dist not found at:', backendDist);
    // Try alternative path if packaged
    if (app.isPackaged) {
        const altPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'index.cjs');
        console.log('[Main] Checking alternative path:', altPath);
        if (fs.existsSync(altPath)) {
            backendDist = altPath;
        }
    }
  }

  console.log('[Main] Starting backend process...');
  try {
    const backendRoot = path.dirname(backendDist);
    
    // Check file stats
    try {
        const stats = fs.statSync(backendDist);
        console.log(`[Main] Backend file size: ${stats.size} bytes`);
    } catch (e) {
        console.error(`[Main] Error reading backend file stats: ${e.message}`);
    }

    serverProcess = fork(backendDist, [], {
      cwd: backendRoot,
      env: { 
        ...process.env, 
        PORT: app.isPackaged ? '0' : '3001', // Use 0 for random port in production
        NODE_ENV: app.isPackaged ? 'production' : 'development'
      },
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'] // Capture stdout/stderr
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        console.log(`[Backend STDOUT] ${data}`);
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        console.error(`[Backend STDERR] ${data}`);
      });
    }

  serverProcess.on('message', (msg) => {
    console.log('[Main] Backend message:', msg);
    if (msg && msg.type === 'server-port') {
      backendPort = msg.port;
      if (resolveBackendPort) {
        resolveBackendPort(msg.port);
        resolveBackendPort = null; // Only resolve once
      }
      console.log(`[Main] Backend is now running on port: ${backendPort}`);
    }
  });
    
    serverProcess.on('error', (err) => {
      console.error('Backend process error:', err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code} and signal ${signal}`);
    });
  } catch (err) {
    console.error('Failed to fork backend process:', err);
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
