/**
 * IPC handlers for configuration operations.
 */

import { ipcMain, dialog, BrowserWindow, shell, screen } from 'electron';
import type { AppConfig, TrackedConfig, ValidationErrors } from '../config/types';
import { ConfigStore } from '../config/store';
import { mergeConfig, validateConfig, diffFromDefaults } from '../config/merge';
import { getDefaults, PRESETS, applyPreset } from '../config/defaults';
import { CONFIG_SCHEMA, CONFIG_SECTIONS, SECTION_META } from '../config/schema';
import { testTwitchConnection } from './testConnection';
import { isTwitchUrl } from '../shared/hostnames';

let configStore: ConfigStore;
let currentTrackedConfig: TrackedConfig | null = null;
let diagnosticsEnabled = false;
let displayIndicatorWindow: BrowserWindow | null = null;
let displayIndicatorTimer: NodeJS.Timeout | null = null;

/**
 * Close the display indicator and cancel its auto-close timer.
 *
 * The timer has to be cancelled together with the window: a leftover timer from
 * a previous indicator would fire while the *new* one is on screen and close it
 * early, which is what happened when switching monitors quickly.
 */
function closeDisplayIndicator(): void {
  if (displayIndicatorTimer) {
    clearTimeout(displayIndicatorTimer);
    displayIndicatorTimer = null;
  }

  if (displayIndicatorWindow && !displayIndicatorWindow.isDestroyed()) {
    displayIndicatorWindow.close();
  }

  displayIndicatorWindow = null;
}

/**
 * Create a serializable version of the schema (without functions).
 */
function getSerializableSchema(): Record<string, unknown> {
  const serializable: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(CONFIG_SCHEMA)) {
    // Copy all properties except 'validate' function
    const { validate, ...rest } = field;
    serializable[key] = rest;
  }

  return serializable;
}

/**
 * Initialize and register all config-related IPC handlers.
 */
export function setupConfigIPC(diagnostics = false): void {
  diagnosticsEnabled = diagnostics;
  configStore = new ConfigStore(diagnostics);

  // Get schema metadata for UI rendering (serializable, no functions)
  ipcMain.handle('config:getSchema', () => {
    return {
      schema: getSerializableSchema(),
      sections: CONFIG_SECTIONS,
      sectionMeta: SECTION_META,
      presets: PRESETS,
    };
  });

  // Load merged config with source tracking
  ipcMain.handle('config:load', () => {
    const { config: saved, error } = configStore.load();

    const tracked = mergeConfig({
      saved,
      diagnostics: diagnosticsEnabled,
    });

    currentTrackedConfig = tracked;

    return {
      config: tracked.values,
      sources: tracked.sources,
      loadError: error,
      isFirstRun: saved === null && error === null,
    };
  });

  // Validate config values
  ipcMain.handle('config:validate', (_event, config: AppConfig): ValidationErrors => {
    return validateConfig(config);
  });

  // Save config to disk
  ipcMain.handle('config:save', (_event, config: Partial<AppConfig>) => {
    // Save only the diff from defaults to minimize storage
    const toSave = diffFromDefaults(config as AppConfig);
    return configStore.save(toSave);
  });

  // Reset config to defaults
  ipcMain.handle('config:reset', () => {
    return configStore.reset();
  });

  // Test Twitch connection
  ipcMain.handle('config:testConnection', async (_event, url: string) => {
    return testTwitchConnection(url, diagnosticsEnabled);
  });

  // Apply a preset.
  //
  // Returns the preset's *partial* values. Merging is the renderer's job,
  // because only the wizard knows the unsaved form state the user is editing;
  // returning a full config here is what used to wipe twitchChatUrl.
  ipcMain.handle('config:applyPreset', (_event, presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);

    if (!preset) {
      return { success: false, error: 'Preset not found' };
    }

    return { success: true, config: { ...preset.config } };
  });

  // Get defaults
  ipcMain.handle('config:getDefaults', () => {
    return getDefaults();
  });

  // Open file dialog to select audio file
  ipcMain.handle('config:selectAudioFile', async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);

    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Select Audio File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };

    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  });

  // Open external URL in default browser
  ipcMain.on('config:openExternal', (_event, url: string) => {
    // Only allow https URLs for security
    if (url && url.startsWith('https://')) {
      shell.openExternal(url);
    }
  });

  // Get available displays for multi-monitor support
  ipcMain.handle('config:getDisplays', () => {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();

    // Always log display info for debugging multi-monitor issues
    console.info(`[Displays] Found ${displays.length} display(s):`);
    displays.forEach((d, i) => {
      console.info(`  [${i}] id=${d.id}, size=${d.bounds.width}x${d.bounds.height}, pos=(${d.bounds.x},${d.bounds.y}), primary=${d.id === primary.id}`);
    });

    // Sort: primary first, then by position (left to right, top to bottom)
    const sorted = displays.slice().sort((a, b) => {
      if (a.id === primary.id) return -1;
      if (b.id === primary.id) return 1;
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
      return a.bounds.y - b.bounds.y;
    });

    return sorted.map((d, index) => ({
      id: d.id,
      label:
        d.id === primary.id
          ? `${d.bounds.width}x${d.bounds.height} (Primary)`
          : `${d.bounds.width}x${d.bounds.height} (#${index + 1})`,
      isPrimary: d.id === primary.id,
      bounds: d.bounds,
    }));
  });

  // Show a visual indicator on a specific display (for preview when selecting)
  ipcMain.handle('config:showDisplayIndicator', (_event, displayId: number) => {
    // Close any existing indicator, cancelling its pending auto-close
    closeDisplayIndicator();

    // Find the target display
    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find((d) => d.id === displayId);
    if (!targetDisplay) {
      return { success: false, error: 'Display not found' };
    }

    const { x, y, width, height } = targetDisplay.bounds;

    // Create a frameless, transparent window with a colored border
    displayIndicatorWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    displayIndicatorWindow.setIgnoreMouseEvents(true);
    displayIndicatorWindow.setAlwaysOnTop(true, 'screen-saver');

    // Load inline HTML with animated border indicator
    const indicatorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            background: transparent;
            overflow: hidden;
          }
          .indicator {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 8px solid #00ff88;
            border-radius: 8px;
            animation: pulse 0.5s ease-in-out 3, fadeOut 0.5s ease-out 2s forwards;
            box-shadow: 0 0 40px rgba(0, 255, 136, 0.5), inset 0 0 40px rgba(0, 255, 136, 0.1);
          }
          .label {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #00ff88;
            padding: 20px 40px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 32px;
            font-weight: bold;
            animation: fadeOut 0.5s ease-out 2s forwards;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes fadeOut {
            to { opacity: 0; }
          }
        </style>
      </head>
      <body>
        <div class="indicator"></div>
        <div class="label">Overlay Here</div>
      </body>
      </html>
    `;

    displayIndicatorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(indicatorHtml)}`);

    // Auto-close after 2.5 seconds
    displayIndicatorTimer = setTimeout(() => {
      displayIndicatorTimer = null;
      closeDisplayIndicator();
    }, 2500);

    return { success: true };
  });

  // Start the overlay (called when user clicks Start)
  ipcMain.handle('config:start', async (_event, config: AppConfig) => {
    const errors = validateConfig(config);
    if (Object.keys(errors).length > 0) {
      return { success: false, errors };
    }

    // Save only the diff from defaults
    const toSave = diffFromDefaults(config);
    const saveResult = configStore.save(toSave);
    if (!saveResult.success) {
      return { success: false, errors: { _save: saveResult.error || 'Failed to save' } };
    }

    // Update tracked config with full values
    currentTrackedConfig = {
      values: config,
      sources: currentTrackedConfig?.sources || ({} as Record<keyof AppConfig, 'saved'>),
    };

    if (diagnosticsEnabled) {
      console.info('[IPC] Config start requested, validation passed');
    }

    return { success: true };
  });
}

/**
 * Get the current merged configuration.
 */
export function getCurrentConfig(): TrackedConfig | null {
  return currentTrackedConfig;
}

/**
 * Set the current configuration (used after config window closes).
 */
export function setCurrentConfig(config: AppConfig): void {
  currentTrackedConfig = {
    values: config,
    sources: currentTrackedConfig?.sources || ({} as Record<keyof AppConfig, 'saved'>),
  };
}

/**
 * Check if we can start without showing the config UI.
 * Returns true if TWITCH_CHAT_URL is provided via env/cli.
 */
export function canStartWithoutUI(): boolean {
  const { config: saved } = configStore.load();
  const tracked = mergeConfig({ saved, diagnostics: diagnosticsEnabled });

  // Can start if twitchChatUrl is present and valid
  const url = tracked.values.twitchChatUrl;
  if (!url || !url.trim()) {
    return false;
  }

  return isTwitchUrl(url);
}

/**
 * Load and merge configuration for direct startup (no config window).
 */
export function loadConfigForStartup(): TrackedConfig {
  const { config: saved } = configStore.load();
  const tracked = mergeConfig({ saved, diagnostics: diagnosticsEnabled });
  currentTrackedConfig = tracked;
  return tracked;
}
