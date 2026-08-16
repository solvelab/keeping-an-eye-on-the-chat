/**
 * Configuration window creation and lifecycle management.
 */

import * as path from 'path';
import { BrowserWindow, screen, ipcMain, nativeImage } from 'electron';

let configWindow: BrowserWindow | null = null;

/**
 * Options for creating the config window.
 */
export interface ConfigWindowOptions {
  /** Enable diagnostic logging. */
  diagnostics: boolean;
  /** Open devtools on window creation. */
  devtools: boolean;
  /** Callback when user clicks Start and validation passes. */
  onStart: () => void;
  /** Callback when user cancels or closes the window. */
  onCancel: () => void;
}

/**
 * Create and show the configuration window.
 */
export function createConfigWindow(options: ConfigWindowOptions): BrowserWindow {
  const { diagnostics, devtools, onStart, onCancel } = options;

  // Center the window on the primary display
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const windowWidth = 640;
  const windowHeight = 950;

  // Use .ico on Windows, .png on other platforms
  // nativeImage.createFromPath() works better than raw path strings on Windows
  const iconExt = process.platform === 'win32' ? 'ico' : 'png';
  const iconPath = path.join(__dirname, '..', `logo.${iconExt}`);
  const icon = nativeImage.createFromPath(iconPath);

  configWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    show: true,
    title: 'Keeping an Eye on the Chat - Configuration',
    autoHideMenuBar: true,
    backgroundColor: '#0e1216',
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '..', 'preload', 'configPreload.js'),
    },
  });

  // Load the config window HTML
  const htmlPath = path.join(__dirname, '..', 'renderer', 'config', 'index.html');
  void configWindow.loadFile(htmlPath);

  if (devtools) {
    configWindow.webContents.openDevTools({ mode: 'detach' });
  }

  if (diagnostics) {
    console.info('[ConfigWindow] Created at', htmlPath);
  }

  // Handle window close (user clicked X or pressed Esc)
  configWindow.on('closed', () => {
    if (diagnostics) {
      console.info('[ConfigWindow] Closed');
    }
    configWindow = null;
    onCancel();
  });

  // Listen for start signal from renderer via IPC
  const handleConfigStarted = (): void => {
    if (diagnostics) {
      console.info('[ConfigWindow] Start signal received');
    }
    // Remove the close handler temporarily to prevent onCancel from firing
    if (configWindow) {
      configWindow.removeAllListeners('closed');
      configWindow.close();
      configWindow = null;
    }
    onStart();
  };

  ipcMain.once('config:started', handleConfigStarted);

  // Clean up IPC listener if window is closed before start
  configWindow.on('closed', () => {
    ipcMain.removeListener('config:started', handleConfigStarted);
  });

  return configWindow;
}

/**
 * Check if the configuration window is currently open.
 */
export function isConfigWindowOpen(): boolean {
  return configWindow !== null && !configWindow.isDestroyed();
}

/**
 * Focus the configuration window if it exists.
 */
export function focusConfigWindow(): void {
  if (configWindow && !configWindow.isDestroyed()) {
    if (configWindow.isMinimized()) {
      configWindow.restore();
    }
    configWindow.focus();
  }
}
