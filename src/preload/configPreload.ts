/**
 * Preload script for the configuration window.
 * Exposes a configAPI to the renderer for config operations.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig,
  ConfigSource,
  ConfigFieldMeta,
  ConfigPreset,
  ConfigSection,
  ValidationErrors,
  ConnectionTestResult,
  ConfigSaveResult,
} from '../config/types';

/**
 * Schema data returned from main process.
 */
interface SchemaData {
  schema: Record<keyof AppConfig, ConfigFieldMeta<unknown>>;
  sections: readonly ConfigSection[];
  sectionMeta: Record<ConfigSection, { title: string; description: string }>;
  presets: readonly ConfigPreset[];
}

/**
 * Load result returned from main process.
 */
interface LoadResult {
  config: AppConfig;
  sources: Record<keyof AppConfig, ConfigSource>;
  loadError: string | null;
  isFirstRun: boolean;
}

/**
 * Start result returned from main process.
 */
interface StartResult {
  success: boolean;
  errors?: ValidationErrors;
}

/**
 * Preset apply result.
 *
 * `config` holds only the keys the preset declares — the renderer merges them
 * onto the configuration currently being edited.
 */
interface PresetResult {
  success: boolean;
  config?: Partial<AppConfig>;
  error?: string;
}

/**
 * Audio file selection result.
 */
interface SelectAudioFileResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
}

/**
 * Display information for multi-monitor support.
 */
interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Display indicator result.
 */
interface DisplayIndicatorResult {
  success: boolean;
  error?: string;
}

/**
 * Configuration API exposed to the renderer.
 */
interface ConfigAPI {
  /** Get the configuration schema and presets. */
  getSchema: () => Promise<SchemaData>;
  /** Load the merged configuration with source tracking. */
  load: () => Promise<LoadResult>;
  /** Validate a configuration object. */
  validate: (config: AppConfig) => Promise<ValidationErrors>;
  /** Save configuration to disk. */
  save: (config: Partial<AppConfig>) => Promise<ConfigSaveResult>;
  /** Reset configuration to defaults. */
  reset: () => Promise<ConfigSaveResult>;
  /** Test connection to a Twitch chat URL. */
  testConnection: (url: string) => Promise<ConnectionTestResult>;
  /** Apply a preset configuration. */
  applyPreset: (presetId: string) => Promise<PresetResult>;
  /** Get default configuration values. */
  getDefaults: () => Promise<AppConfig>;
  /** Start the overlay with the given configuration. */
  start: (config: AppConfig) => Promise<StartResult>;
  /** Notify main process that the overlay should start. */
  notifyStarted: () => void;
  /** Open file dialog to select an audio file. */
  selectAudioFile: () => Promise<SelectAudioFileResult>;
  /** Open URL in default browser. */
  openExternal: (url: string) => void;
  /** Get available displays for multi-monitor support. */
  getDisplays: () => Promise<DisplayInfo[]>;
  /** Show a visual indicator on a specific display. */
  showDisplayIndicator: (displayId: number) => Promise<DisplayIndicatorResult>;
}

// Expose the config API to the renderer
contextBridge.exposeInMainWorld('configAPI', {
  getSchema: (): Promise<SchemaData> => ipcRenderer.invoke('config:getSchema'),

  load: (): Promise<LoadResult> => ipcRenderer.invoke('config:load'),

  validate: (config: AppConfig): Promise<ValidationErrors> =>
    ipcRenderer.invoke('config:validate', config),

  save: (config: Partial<AppConfig>): Promise<ConfigSaveResult> =>
    ipcRenderer.invoke('config:save', config),

  reset: (): Promise<ConfigSaveResult> => ipcRenderer.invoke('config:reset'),

  testConnection: (url: string): Promise<ConnectionTestResult> =>
    ipcRenderer.invoke('config:testConnection', url),

  applyPreset: (presetId: string): Promise<PresetResult> =>
    ipcRenderer.invoke('config:applyPreset', presetId),

  getDefaults: (): Promise<AppConfig> => ipcRenderer.invoke('config:getDefaults'),

  start: (config: AppConfig): Promise<StartResult> => ipcRenderer.invoke('config:start', config),

  notifyStarted: (): void => {
    ipcRenderer.send('config:started');
  },

  selectAudioFile: (): Promise<SelectAudioFileResult> =>
    ipcRenderer.invoke('config:selectAudioFile'),

  openExternal: (url: string): void => {
    ipcRenderer.send('config:openExternal', url);
  },

  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('config:getDisplays'),

  showDisplayIndicator: (displayId: number): Promise<DisplayIndicatorResult> =>
    ipcRenderer.invoke('config:showDisplayIndicator', displayId),
} as ConfigAPI);
