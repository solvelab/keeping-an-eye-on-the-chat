/**
 * Global type declarations for the configuration wizard.
 *
 * The wizard has no module bundler: every file is loaded by its own <script>
 * tag and publishes itself on `window`. These declarations are how TypeScript
 * sees that wiring.
 */

import type {
  AppConfig,
  ConfigPreset,
  ConfigSaveResult,
  ConfigSection,
  ConnectionTestResult,
  SerializableFieldMeta,
  ValidationErrors,
} from '../../../config/types';

/** A monitor the overlay can be placed on. */
export interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

/** Schema metadata for rendering the form, as it survives the IPC boundary. */
export interface SchemaData {
  schema: Record<keyof AppConfig, SerializableFieldMeta>;
  sections: readonly ConfigSection[];
  sectionMeta: Record<ConfigSection, { title: string; description: string }>;
  presets: readonly ConfigPreset[];
}

/** Result of loading the merged configuration. */
export interface LoadResult {
  config: AppConfig;
  sources: Record<keyof AppConfig, 'default' | 'saved' | 'env' | 'cli'>;
  loadError: string | null;
  isFirstRun: boolean;
}

/** Result of asking the main process to start the overlay. */
export interface StartResult {
  success: boolean;
  errors?: ValidationErrors;
}

/** Result of applying a preset: the preset's own keys, nothing else. */
export interface PresetResult {
  success: boolean;
  config?: Partial<AppConfig>;
  error?: string;
}

/** Result of the audio file picker. */
export interface SelectAudioFileResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
}

/** Result of flashing the monitor indicator. */
export interface DisplayIndicatorResult {
  success: boolean;
  error?: string;
}

/** Everything the preload exposes to the wizard. */
export interface ConfigAPI {
  getSchema: () => Promise<SchemaData>;
  load: () => Promise<LoadResult>;
  validate: (config: AppConfig) => Promise<ValidationErrors>;
  save: (config: Partial<AppConfig>) => Promise<ConfigSaveResult>;
  reset: () => Promise<ConfigSaveResult>;
  testConnection: (url: string) => Promise<ConnectionTestResult>;
  applyPreset: (presetId: string) => Promise<PresetResult>;
  getDefaults: () => Promise<AppConfig>;
  start: (config: AppConfig) => Promise<StartResult>;
  notifyStarted: () => void;
  selectAudioFile: () => Promise<SelectAudioFileResult>;
  openExternal: (url: string) => void;
  getDisplays: () => Promise<DisplayInfo[]>;
  showDisplayIndicator: (displayId: number) => Promise<DisplayIndicatorResult>;
}

declare global {
  interface Window {
    configAPI: ConfigAPI;
    configValues: typeof import('./configValues');
    configForm: typeof import('./configForm');
    /** Generated from the locale JSON by scripts/copy-assets.js. */
    configTranslations: Record<string, Record<string, string>>;
  }
}

export {};
