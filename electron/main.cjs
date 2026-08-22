const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork, exec } = require('child_process');

const startupTimes = {
  appReady: null,
  backendStart: null,
  windowReady: null,
  totalStartup: null
};

function logStartupTime(event, time = null) {
  const timestamp = time || Date.now();
  startupTimes[event] = timestamp;
  console.log(`[Startup] ${event}: ${timestamp}ms`);
  
  if (event === 'totalStartup') {
    const totalTime = timestamp;
    console.log(`[Startup] Total startup time: ${totalTime}ms`);
  }
}

const appStartTime = Date.now();

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

let mainWindow;
let splashWindow;
let serverProcess;
let backendPort = null;
let resolveBackendPort;
const backendPortPromise = new Promise((resolve) => {
  resolveBackendPort = resolve;
});

ipcMain.handle('get-backend-port', async () => {
  console.log('[Main] get-backend-port requested');
  if (backendPort !== null) {
    return backendPort;
  }
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Backend port request timed out')), 10000);
  });

  try {
    return await Promise.race([backendPortPromise, timeoutPromise]);
  } catch (err) {
    console.error('[Main] Failed to get backend port:', err);
    return 3001;
  }
});

ipcMain.handle('save-configuration', async (_event, payload) => {
  if (!payload || typeof payload.contents !== 'string') {
    throw new Error('Invalid configuration export payload');
  }

  const suggestedName = typeof payload.suggestedName === 'string' && payload.suggestedName.length > 0
    ? payload.suggestedName
    : 'gemini-ssh-config.json';
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'JSON 配置备份', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, payload.contents, 'utf8');
  return { canceled: false, path: result.filePath };
});

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
  }

  mainWindow.once('ready-to-show', () => {
    logStartupTime('windowReady');
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const backendStartTime = Date.now();
  const appDataDir = app.getPath('userData');
  fs.mkdirSync(path.join(appDataDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(appDataDir, 'backups'), { recursive: true });
  let backendDist;
  
  if (app.isPackaged) {
    backendDist = path.join(process.resourcesPath, 'backend', 'index.cjs');
  } else {
    backendDist = path.join(__dirname, '../back/dist/main.js');
  }
  
  console.log('[Main] Backend dist path:', backendDist);
  
  if (!fs.existsSync(backendDist)) {
    console.error('[Main] Backend dist not found at:', backendDist);
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
        APP_DATA_DIR: appDataDir,
        PORT: app.isPackaged ? '0' : '3001',
        NODE_ENV: app.isPackaged ? 'production' : 'development'
      },
      stdio: ['inherit', 'pipe', 'pipe', 'ipc']
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
        resolveBackendPort = null;
      }
      const backendTime = Date.now() - backendStartTime;
      logStartupTime('backendStart', backendTime);
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

function createMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    }] : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close', label: '关闭' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function killBackend() {
  if (serverProcess) {
    console.log('[Main] Killing backend process...');
    if (process.platform === 'win32') {
      try {
        exec(`taskkill /pid ${serverProcess.pid} /T /F`);
      } catch (e) {
        serverProcess.kill();
      }
    } else {
      serverProcess.kill();
    }
    serverProcess = null;
  }
}

app.whenReady().then(() => {
  logStartupTime('appReady');
  createSplashWindow();
  createMenu();
  
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
  logStartupTime('totalStartup');
  killBackend();
});
