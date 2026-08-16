/**
 * Global type declarations for config window.
 */

interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

interface ConfigAPI {
  getSchema: () => Promise<any>;
  load: () => Promise<any>;
  validate: (config: any) => Promise<Record<string, string>>;
  save: (config: any) => Promise<{ success: boolean; error: string | null }>;
  reset: () => Promise<{ success: boolean; error: string | null }>;
  testConnection: (url: string) => Promise<{
    success: boolean;
    error: string | null;
    latencyMs: number | null;
  }>;
  applyPreset: (presetId: string) => Promise<{
    success: boolean;
    config?: any;
    error?: string;
  }>;
  getDefaults: () => Promise<any>;
  start: (config: any) => Promise<{
    success: boolean;
    errors?: Record<string, string>;
  }>;
  notifyStarted: () => void;
  selectAudioFile: () => Promise<{
    success: boolean;
    canceled?: boolean;
    filePath?: string;
  }>;
  openExternal: (url: string) => void;
  getDisplays: () => Promise<DisplayInfo[]>;
  showDisplayIndicator: (displayId: number) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    configAPI: ConfigAPI;
    configValues: typeof import('./configValues');
  }
}

export {};
