const { app, BrowserWindow, desktopCapturer, session, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// uiohook-napi: global mouse + keyboard hooks (N-API, no rebuild needed)
let uIOhook = null;
let UiohookKey = null;
try {
  const mod = require('uiohook-napi');
  uIOhook = mod.uIOhook;
  UiohookKey = mod.UiohookKey;
} catch {
  console.warn('[Auralis] uiohook-napi unavailable — falling back to globalShortcut (keyboard only).');
}
const MCPManager = require('./mcp-manager');
const SkillsManager = require('./skills-manager');
const MemoryManager = require('./memory-manager');
const AuthManager = require('./auth-manager');

const mcpManager = new MCPManager();
const skillsManager = new SkillsManager();
const memoryManager = new MemoryManager();
const authManager = new AuthManager();

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// ── Activation hotkey ─────────────────────────────────────────────────────────
const DEFAULT_HOTKEY_CONFIG = {
  modifiers: { ctrl: false, alt: true, shift: true, meta: false },
  uiohookKey: 'A',      // UiohookKey enum name  (null when mouseButton is set)
  mouseButton: null,    // uiohook-napi button number (null when key is set)
  display: 'Alt + Shift + A',
};

let hotkeyConfig = { ...DEFAULT_HOTKEY_CONFIG };

function getHotkeyConfigPath() {
  return path.join(app.getPath('userData'), 'hotkey-config.json');
}

function loadHotkeyConfig() {
  try {
    const p = getHotkeyConfigPath();
    if (fs.existsSync(p)) {
      hotkeyConfig = { ...DEFAULT_HOTKEY_CONFIG, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
    }
  } catch (e) {
    console.error('[Auralis] Failed to load hotkey config:', e);
  }
}

function saveHotkeyConfig(config) {
  try {
    fs.writeFileSync(getHotkeyConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Auralis] Failed to save hotkey config:', e);
  }
}

// Build reverse map: uiohook keycode number → UiohookKey enum name (e.g. 30 → 'A')
let keycodeToName = {};
function buildKeycodeMap() {
  if (!UiohookKey) return;
  keycodeToName = {};
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (typeof code === 'number' && !(code in keycodeToName)) {
      keycodeToName[code] = name;
    }
  }
}

function eventMatchesHotkey(event) {
  const cfg = hotkeyConfig;
  const modOk =
    !!event.ctrlKey  === cfg.modifiers.ctrl  &&
    !!event.altKey   === cfg.modifiers.alt   &&
    !!event.shiftKey === cfg.modifiers.shift &&
    !!event.metaKey  === cfg.modifiers.meta;
  if (!modOk) return false;

  if (cfg.mouseButton !== null && event.button !== undefined) {
    return event.button === cfg.mouseButton;
  }
  if (cfg.uiohookKey !== null && event.keycode !== undefined) {
    return keycodeToName[event.keycode] === cfg.uiohookKey;
  }
  return false;
}

async function triggerActivationHotkey() {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    const primaryDisplay = screen.getPrimaryDisplay();
    const primarySource =
      sources.find(s => s.display_id === primaryDisplay.id.toString()) || sources[0];

    if (primarySource) {
      selectedSourceId = primarySource.id;
      if (mainWindow) {
        mainWindow.webContents.send('hotkey-triggered', selectedSourceId);
        if (!miniWindow) createMiniWindow();
        else miniWindow.show();
        if (!mainWindow.isMinimized()) mainWindow.minimize();
      }
    }
  } catch (e) {
    console.error('[Auralis] Failed to trigger activation hotkey:', e);
  }
}

function startHookListener() {
  loadHotkeyConfig();

  if (uIOhook) {
    buildKeycodeMap();
    uIOhook.on('keydown', (e) => {
      if (eventMatchesHotkey(e)) triggerActivationHotkey();
    });
    uIOhook.on('mousedown', (e) => {
      if (hotkeyConfig.mouseButton !== null && eventMatchesHotkey(e)) triggerActivationHotkey();
    });
    uIOhook.start();
    console.log('[Auralis] Global hook listener started (uiohook-napi).');
  } else {
    registerGlobalShortcutFallback();
  }
}

// Keyboard-only fallback used when uiohook-napi is absent
function registerGlobalShortcutFallback() {
  const { modifiers, uiohookKey } = hotkeyConfig;
  if (!uiohookKey) return;
  const parts = [];
  if (modifiers.ctrl)  parts.push('Ctrl');
  if (modifiers.alt)   parts.push('Alt');
  if (modifiers.shift) parts.push('Shift');
  if (modifiers.meta)  parts.push('Super');
  parts.push(uiohookKey);
  const accelerator = parts.join('+');
  globalShortcut.unregisterAll();
  try {
    globalShortcut.register(accelerator, () => triggerActivationHotkey());
    console.log('[Auralis] Fallback globalShortcut registered:', accelerator);
  } catch (e) {
    console.error('[Auralis] Failed to register fallback shortcut:', accelerator, e);
  }
}

let selectedSourceId = null;
let mainWindow = null;
let miniWindow = null;
let overlayWindow = null;
let tray = null;

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

// Protocol Registration
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('auralis', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('auralis');
}


function createMiniWindow() {
  if (miniWindow) return;

  miniWindow = new BrowserWindow({
    width: 380,
    height: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // Ensure transparency on Windows
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const miniURL = !app.isPackaged
    ? 'https://localhost:3001/?mode=mini'
    : url.format({
      pathname: path.join(__dirname, '../build/index.html'),
      protocol: 'file:',
      slashes: true,
      query: { mode: 'mini' }
    });

  miniWindow.loadURL(miniURL);

  miniWindow.on('closed', () => {
    miniWindow = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      showMainWindow();
    }
  });

  // Create window on ready
  app.whenReady().then(() => {
    session.defaultSession.clearCache().then(() => {
      console.log('Cache cleared!');
    });

    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        let selectedSource = null;
        if (selectedSourceId) {
          selectedSource = sources.find(source => source.id === selectedSourceId);
          selectedSourceId = null; // Reset for next time
        }

        if (!selectedSource) {
          selectedSource = sources.find(source => source.name === 'Entire Screen' || source.name === 'Screen 1') || sources[0];
        }

        if (selectedSource) {
          callback({ video: selectedSource, audio: 'loopback' });
        } else {
          callback({ video: null, audio: null });
        }
      }).catch((error) => {
        console.error('Error getting screen sources:', error);
        callback({ video: null, audio: null });
      });
    });

    createWindow();
    createTray();
    startHookListener();
    mcpManager.initialize();
  });
}



ipcMain.on('main-window-command', (event, { cmd, data }) => {
  if (cmd === 'setMenuBarVisibility' && mainWindow) {
    mainWindow.setMenuBarVisibility(data);
    mainWindow.setAutoHideMenuBar(!data);
  }
  if (mainWindow) {
    mainWindow.webContents.send('main-window-command', { cmd, data });
  }
});

ipcMain.on('set-mini-window-active', (event, active) => {
  if (active) {
    if (!miniWindow) createMiniWindow();
    else miniWindow.show();
  } else {
    if (miniWindow) miniWindow.hide();
  }
});

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 300, height: 300 } });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }));
});

ipcMain.on('set-selected-source', (event, id) => {
  selectedSourceId = id;
});

ipcMain.handle('get-active-display-source', async () => {
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  const source = sources.find(s => s.display_id === activeDisplay.id.toString()) || sources[0];
  return source ? { id: source.id, name: source.name } : null;
});

// Screen overlay IPC Handlers
function createOrShowOverlay(displayBounds) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setBounds(displayBounds);
    overlayWindow.show();
    return;
  }
  overlayWindow = new BrowserWindow({
    x: displayBounds.x,
    y: displayBounds.y,
    width: displayBounds.width,
    height: displayBounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    webPreferences: { contextIsolation: true },
  });
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

ipcMain.handle('show-screen-overlay', async () => {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  createOrShowOverlay(display.bounds);
});

ipcMain.handle('hide-screen-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
});

// MCP IPC Handlers
ipcMain.handle('mcp-get-tools', async () => {
  return await mcpManager.getTools();
});

ipcMain.handle('mcp-call-tool', async (event, { name, args }) => {
  return await mcpManager.callTool(name, args);
});

ipcMain.handle('mcp-get-config', () => {
  return mcpManager.getConfig();
});

ipcMain.handle('mcp-set-config', async (event, config) => {
  await mcpManager.setConfig(config);
  return true;
});

ipcMain.handle('mcp-add-server-json', async (event, jsonString) => {
  return await mcpManager.addServerJson(jsonString);
});

// Skills IPC Handlers
ipcMain.handle('skills-get-all', async () => {
  return await skillsManager.listSkills();
});

ipcMain.handle('skills-save', async (event, skillData) => {
  return await skillsManager.saveSkill(skillData);
});

ipcMain.handle('skills-delete', async (event, { id }) => {
  return await skillsManager.deleteSkill(id);
});

// Memory IPC Handlers
ipcMain.handle('memory-get-global', async () => {
  return memoryManager.getGlobalMemory();
});

ipcMain.handle('memory-get-workspace', async () => {
  return memoryManager.getWorkspaceMemory();
});

ipcMain.handle('memory-add', async (event, { scope, text }) => {
  return memoryManager.addMemoryItem(scope, text);
});

ipcMain.handle('memory-delete', async (event, { id }) => {
  return memoryManager.deleteMemoryItem(id);
});

// Auth IPC Handlers
ipcMain.handle('auth-save-api-key', async (event, apiKey) => {
  return await authManager.saveApiKey(apiKey);
});

ipcMain.handle('auth-get-api-key', async () => {
  return await authManager.getApiKey();
});

// Hotkey IPC Handlers
ipcMain.handle('hotkey-get-config', () => hotkeyConfig);

ipcMain.handle('hotkey-set-config', (event, newConfig) => {
  hotkeyConfig = { ...DEFAULT_HOTKEY_CONFIG, ...newConfig };
  saveHotkeyConfig(hotkeyConfig);
  // If uiohook is running it picks up the new config automatically (just compares on next event).
  // For the globalShortcut fallback we must re-register.
  if (!uIOhook) registerGlobalShortcutFallback();
  return true;
});

ipcMain.on('open-external', (event, url) => {
  const { shell } = require('electron');
  if (!isSafeExternalUrl(url)) {
    console.warn('Blocked unsafe external URL');
    return;
  }
  shell.openExternal(url);
});

// Workspaces IPC Handlers
ipcMain.handle('workspaces-get', async () => {
  return memoryManager.getWorkspaces();
});

ipcMain.handle('workspaces-select', async () => {
  return await memoryManager.selectWorkspace();
});

ipcMain.handle('workspaces-set', async (event, { path }) => {
  memoryManager.setWorkspace(path);
  return true;
});

ipcMain.handle('memory-list-files', async () => {
  return await memoryManager.listWorkspaceFiles();
});

ipcMain.handle('memory-get-metadata', async (event, { path }) => {
  return await memoryManager.getFileMetadata(path);
});


if (!app.isPackaged && process.env.AURALIS_ALLOW_INSECURE_CERTS === 'true') {
  console.warn('Insecure TLS mode enabled for development.');
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;

  const iconPath = path.join(__dirname, 'favicon.ico');
  let trayIcon = nativeImage.createFromPath(iconPath);
  // Resize to standard tray dimensions
  trayIcon = trayIcon.resize({ width: 16, height: 16 });
  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Auralis');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Auralis',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        tray.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click (Windows) restores the window
  tray.on('double-click', () => showMainWindow());
  // Single click (macOS / Linux) restores the window
  tray.on('click', () => showMainWindow());
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 920,
    height: 690,
    autoHideMenuBar: true, // Hide by default
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // Keep running when minimized
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(
    !app.isPackaged
      ? 'https://localhost:3001'
      : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true,
      })
  );

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (event) => {
    // If mini window is active, we might want to just quit everything
    app.quit();
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
    mainWindow.webContents.send('main-window-command', { cmd: 'window-state-changed', data: 'minimized' });
  });

  mainWindow.on('restore', () => {
    mainWindow.webContents.send('main-window-command', { cmd: 'window-state-changed', data: 'restored' });
  });

  mainWindow.on('show', () => {
    mainWindow.webContents.send('main-window-command', { cmd: 'window-state-changed', data: 'restored' });
  });
}

// app.whenReady() moved inside single instance lock block

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (uIOhook) {
    try { uIOhook.stop(); } catch (_) {}
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// The tray icon keeps the app alive — only quit via the tray "Exit" menu item
// or when the main window's close button is clicked.
app.on('window-all-closed', () => {
  // If the tray is active, keep running; otherwise quit normally.
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, clicking the dock icon should show the window (it may be hidden).
  if (mainWindow) {
    showMainWindow();
  } else {
    createWindow();
  }
});
