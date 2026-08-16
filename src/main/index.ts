/**
 * Main process entry point.
 * Creates the configuration window first, then starts the overlay after user clicks Start.
 */

import * as path from 'path';
import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron';
import { TwitchChatSource } from './twitchChatSource';
import { KickChatSource } from './kickChatSource';
import type { ChatSource } from './chatSource';
import { setupConfigIPC, getCurrentConfig } from './ipcHandlers';
import { createConfigWindow, isConfigWindowOpen, focusConfigWindow } from './configWindow';
import { resolveTargetDisplay } from '../shared/displays';
import type { ChatMessage } from '../shared/types';
import type { AppConfig, Language } from '../config/types';

let mainWindow: BrowserWindow | null = null;
let chatSources: ChatSource[] = [];
let tray: Tray | null = null;
let isSoundMuted = false;
let currentLanguage: Language = 'en';

/**
 * Translations for the System Tray menu.
 */
const TRAY_TRANSLATIONS: Record<Language, {
  muteSound: string;
  unmuteSound: string;
  stopOverlay: string;
  startOverlay: string;
  openSettings: string;
  quit: string;
}> = {
  en: {
    muteSound: 'Mute Sound',
    unmuteSound: 'Unmute Sound',
    stopOverlay: 'Stop Overlay',
    startOverlay: 'Start Overlay',
    openSettings: 'Open Settings',
    quit: 'Quit',
  },
  pt: {
    muteSound: 'Mutar Som',
    unmuteSound: 'Desmutar Som',
    stopOverlay: 'Parar Overlay',
    startOverlay: 'Iniciar Overlay',
    openSettings: 'Abrir Configurações',
    quit: 'Sair',
  },
};

const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
const diagnosticsEnabled = process.env.DIAGNOSTICS === '1';
const devtoolsEnabled = isDev && process.env.DEVTOOLS === '1';

// Setup IPC handlers early (before any windows are created)
setupConfigIPC(diagnosticsEnabled);

/**
 * Update the tray context menu (called when mute state or language changes).
 */
const updateTrayMenu = (): void => {
  if (!tray) return;

  const t = TRAY_TRANSLATIONS[currentLanguage];

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isSoundMuted ? t.unmuteSound : t.muteSound,
      click: () => toggleMute(),
    },
    { type: 'separator' },
    {
      label: isOverlayRunning() ? t.stopOverlay : t.startOverlay,
      click: () => (isOverlayRunning() ? stopOverlay() : startOverlay()),
    },
    {
      label: t.openSettings,
      click: () => showConfigWindow(),
    },
    { type: 'separator' },
    {
      label: t.quit,
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
};

/**
 * Toggle sound mute state and notify overlay.
 */
const toggleMute = (): void => {
  isSoundMuted = !isSoundMuted;

  // Notify the overlay window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-muted', isSoundMuted);
  }

  // Update tray menu to reflect new state
  updateTrayMenu();

  if (diagnosticsEnabled) {
    console.info(`[tray] Sound ${isSoundMuted ? 'muted' : 'unmuted'}`);
  }
};

/**
 * Create the system tray icon with context menu.
 */
const createTray = (): void => {
  const iconPath = path.join(__dirname, '..', 'logo.png');
  const icon = nativeImage.createFromPath(iconPath);

  // Resize for appropriate tray icon size (16x16 on Windows/Linux)
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Keeping an Eye on the Chat');

  // Build initial menu
  updateTrayMenu();

  // Double-click opens settings
  tray.on('double-click', () => showConfigWindow());
};

/**
 * Stop every running chat source.
 *
 * One source failing to stop must not leave the others running, so each is
 * stopped independently.
 */
const stopChatSources = (): void => {
  for (const source of chatSources) {
    try {
      source.stop();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[chat] failed to stop the ${source.platform} source: ${reason}`);
    }
  }
  chatSources = [];
};

/**
 * Start a source for every configured platform.
 *
 * A platform with no URL is simply not observed. A source that throws while
 * starting is reported and skipped: the streamer's other platform keeps
 * working, which is the same containment the display sequence follows.
 */
const startChatSources = (
  config: AppConfig,
  onMessage: (message: ChatMessage) => void
): ChatSource[] => {
  const options = { diagnostics: config.diagnostics, onMessage };
  const configured: ChatSource[] = [];

  if (config.twitchChatUrl && config.twitchChatUrl.trim()) {
    configured.push(new TwitchChatSource({ url: config.twitchChatUrl, ...options }));
  }

  if (config.kickChatUrl && config.kickChatUrl.trim()) {
    configured.push(new KickChatSource({ url: config.kickChatUrl, ...options }));
  }

  if (configured.length === 0) {
    console.warn('[chat] no chat source configured; the overlay will stay empty.');
    return [];
  }

  const started: ChatSource[] = [];
  for (const source of configured) {
    try {
      source.start();
      started.push(source);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[chat] failed to start the ${source.platform} source: ${reason}`);
    }
  }

  if (config.diagnostics) {
    console.info(`[diagnostics] Chat sources started: ${started.map((s) => s.platform).join(', ') || '(none)'}`);
  }

  return started;
};

/**
 * Create the overlay window with the given configuration.
 * If an overlay already exists, it is closed first to prevent duplicates.
 */
const createOverlayWindow = (config: AppConfig): void => {
  // One teardown path, shared with the tray's Stop Overlay.
  stopOverlay();

  // Update current language from config and refresh tray menu
  currentLanguage = config.language || 'en';
  updateTrayMenu();

  // Debug overlay only if explicitly enabled in config or via env var
  const debugOverlay = config.overlayDebug || process.env.OVERLAY_DEBUG === '1';

  // Find the target display based on config (0, invalid or disconnected = primary)
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const targetDisplay = resolveTargetDisplay(displays, config.displayId, primaryDisplay);

  if (config.diagnostics) {
    console.info(
      `[diagnostics] Overlay display: configured=${JSON.stringify(config.displayId)} ` +
        `resolved=${targetDisplay.id} primary=${primaryDisplay.id}`
    );
  }

  const { width, height, x, y } = targetDisplay.workArea;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.setBounds(targetDisplay.workArea);

  // Send config to the overlay preload before loading HTML
  mainWindow.webContents.on('did-finish-load', () => {
    // The mute state lives in the main process and survives overlay restarts,
    // so a freshly created window has to be told about it. Without this, muting
    // and then restarting the overlay from Settings brought the sound back
    // while the tray menu still offered "Unmute".
    mainWindow?.webContents.send('set-muted', isSoundMuted);

    mainWindow?.webContents.send('set-config', {
      displaySeconds: config.displaySeconds,
      overlayAnchor: config.overlayAnchor,
      overlayMargin: config.overlayMargin,
      bubbleMaxWidth: config.bubbleMaxWidth,
      maxMessageLength: config.maxMessageLength,
      ignoreCommandPrefix: config.ignoreCommandPrefix,
      ignoreUsers: config.ignoreUsers,
      maxQueueLength: config.maxQueueLength,
      exitAnimationMs: config.exitAnimationMs,
      attentionPauseMs: config.attentionPauseMs,
      diagnostics: config.diagnostics,
      notificationSoundEnabled: config.notificationSoundEnabled,
      notificationSoundFile: config.notificationSoundFile,
      notificationSoundVolume: config.notificationSoundVolume,
      notificationSoundDevice: config.notificationSoundDevice,
    });
  });

  void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
    query: { debug: debugOverlay ? '1' : '0' },
  });

  if (config.devtools || devtoolsEnabled) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Start every configured chat source. They share one overlay queue.
  chatSources = startChatSources(config, (message: ChatMessage) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (config.diagnostics) {
      console.info(`[diagnostics] Sending chat-message id=${message.id}`);
    }
    mainWindow.webContents.send('chat-message', message);
  });

  // Create system tray icon for app access
  if (!tray) {
    createTray();
  }

  updateTrayMenu();
};

/**
 * Whether the overlay is on screen right now.
 *
 * Derived from the window rather than tracked in a flag: a flag can drift out of
 * step with reality, and the tray label is built from this on every rebuild.
 */
const isOverlayRunning = (): boolean => Boolean(mainWindow && !mainWindow.isDestroyed());

/**
 * Take the overlay off screen and stop watching chat.
 *
 * The app itself keeps running in the tray. This is the only teardown path —
 * `createOverlayWindow` calls it before building a replacement — so there is no
 * second place where a hidden chat window could be forgotten.
 *
 * Safe to call when nothing is running.
 */
const stopOverlay = (): void => {
  stopChatSources();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  mainWindow = null;

  updateTrayMenu();

  if (diagnosticsEnabled) {
    console.info('[tray] Overlay stopped');
  }
};

/**
 * Put the overlay back on screen with the configuration already in use.
 *
 * The wizard is not reopened: the streamer stopped the overlay, they did not ask
 * to reconfigure it. If no configuration has been resolved yet — nothing has
 * ever been started — the wizard is the only sensible answer.
 */
const startOverlay = (): void => {
  if (isOverlayRunning()) {
    return;
  }

  const tracked = getCurrentConfig();
  if (!tracked) {
    showConfigWindow();
    return;
  }

  createOverlayWindow(tracked.values);

  if (diagnosticsEnabled) {
    console.info('[tray] Overlay started');
  }
};

/**
 * Show the configuration window.
 * If already open, focuses the existing window.
 */
const showConfigWindow = (): void => {
  // If config window is already open, just focus it
  if (isConfigWindowOpen()) {
    focusConfigWindow();
    return;
  }

  createConfigWindow({
    diagnostics: diagnosticsEnabled,
    devtools: devtoolsEnabled,
    onStart: () => {
      // Get the validated config and start the overlay
      const tracked = getCurrentConfig();
      if (tracked) {
        if (diagnosticsEnabled) {
          console.info('[startup] Config window closed, starting overlay');
        }
        createOverlayWindow(tracked.values);
      }
    },
    onCancel: () => {
      // Cancelling the very first wizard means the app was never started, so it
      // quits. Once the tray exists, cancelling is just closing a window — the
      // overlay may be deliberately stopped, and quitting there would be a
      // second, unasked-for action.
      if (!tray) {
        if (diagnosticsEnabled) {
          console.info('[startup] Config cancelled, quitting');
        }
        app.quit();
      }
    },
  });
};

/**
 * Start the application.
 * Always shows config window first so user can review/modify settings.
 */
const startApp = (): void => {
  if (diagnosticsEnabled) {
    console.info('[startup] Showing config window');
  }
  showConfigWindow();
};

void app.whenReady().then(startApp);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startApp();
  }
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return;
  }

  // Without this guard, stopping the overlay would quit the app: closing the
  // last window is exactly what the tray's Stop Overlay does. Once the tray
  // exists the app lives there, and Quit is how it ends. Before the tray exists
  // — the wizard was cancelled at startup — closing the last window still quits,
  // so a cancelled launch does not leave a process behind.
  if (tray) {
    return;
  }

  app.quit();
});

app.on('before-quit', () => {
  stopChatSources();
});
