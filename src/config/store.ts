/**
 * Configuration persistence layer.
 * Handles loading, saving, and backup of configuration.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { AppConfig, ConfigLoadResult, ConfigSaveResult, StoredConfig } from './types';
import { CONFIG_VERSION } from './schema';

const CONFIG_FILENAME = 'config.json';
const BACKUP_FILENAME = 'config.backup.json';

/**
 * Configuration store for persisting user settings.
 */
export class ConfigStore {
  private readonly configPath: string;
  private readonly backupPath: string;
  private readonly diagnostics: boolean;

  /**
   * @param diagnostics Enable diagnostic logging.
   * @param userDataPath Directory holding the config files. Defaults to Electron's
   *   `userData` path; tests pass a temporary directory so the store can run
   *   outside an Electron runtime.
   */
  constructor(diagnostics = false, userDataPath?: string) {
    const baseDir = userDataPath ?? app.getPath('userData');
    this.configPath = path.join(baseDir, CONFIG_FILENAME);
    this.backupPath = path.join(baseDir, BACKUP_FILENAME);
    this.diagnostics = diagnostics;
  }

  /**
   * Load configuration from disk.
   * Attempts backup recovery on corruption.
   */
  load(): ConfigLoadResult {
    this.log('Loading config from:', this.configPath);

    if (!fs.existsSync(this.configPath)) {
      this.log('No config file found (first run)');
      return { config: null, error: null };
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const stored = JSON.parse(raw) as StoredConfig;

      // Version check for future migrations
      if (stored.configVersion !== CONFIG_VERSION) {
        this.log(`Config version mismatch: ${stored.configVersion} -> ${CONFIG_VERSION}`);
        // Future: add migration logic here
      }

      this.log('Config loaded successfully');
      return { config: stored.config, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('Failed to load config:', message);

      // Attempt to restore from backup
      return this.loadFromBackup(message);
    }
  }

  /**
   * Attempt to load from backup file.
   */
  private loadFromBackup(originalError: string): ConfigLoadResult {
    this.log('Attempting to load from backup');

    if (!fs.existsSync(this.backupPath)) {
      return {
        config: null,
        error: `Config corrupted: ${originalError}. No backup available.`,
      };
    }

    try {
      const raw = fs.readFileSync(this.backupPath, 'utf-8');
      const stored = JSON.parse(raw) as StoredConfig;
      this.log('Restored config from backup');

      // Restore the backup as the main config
      this.saveInternal(stored.config, false);

      return {
        config: stored.config,
        error: `Config restored from backup. Original error: ${originalError}`,
      };
    } catch (backupErr) {
      const backupMessage = backupErr instanceof Error ? backupErr.message : String(backupErr);
      return {
        config: null,
        error: `Both config and backup are corrupted. Original: ${originalError}. Backup: ${backupMessage}`,
      };
    }
  }

  /**
   * Save configuration to disk.
   * Creates a backup of the previous config before saving.
   */
  save(config: Partial<AppConfig>): ConfigSaveResult {
    return this.saveInternal(config, true);
  }

  /**
   * Internal save with optional backup creation.
   */
  private saveInternal(config: Partial<AppConfig>, createBackup: boolean): ConfigSaveResult {
    try {
      // Create backup of existing config first
      if (createBackup && fs.existsSync(this.configPath)) {
        try {
          fs.copyFileSync(this.configPath, this.backupPath);
          this.log('Backup created');
        } catch (backupErr) {
          // Log but don't fail - backup is best-effort
          this.log('Failed to create backup:', backupErr);
        }
      }

      const stored: StoredConfig = {
        configVersion: CONFIG_VERSION,
        savedAt: new Date().toISOString(),
        config,
      };

      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.writeFileAtomic(this.configPath, JSON.stringify(stored, null, 2));
      this.log('Config saved successfully');

      return { success: true, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('Failed to save config:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Write a file so that it is never observed half-written.
   *
   * Writing straight to the destination leaves a truncated `config.json` if the
   * process dies mid-write; the backup can recover from that, but a temp file
   * plus a rename prevents it instead. `rename` is atomic within a filesystem,
   * and the temp file sits in the same directory to guarantee that.
   */
  private writeFileAtomic(targetPath: string, contents: string): void {
    const tempPath = `${targetPath}.${process.pid}.tmp`;

    try {
      fs.writeFileSync(tempPath, contents, 'utf-8');
      fs.renameSync(tempPath, targetPath);
    } catch (err) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Best-effort cleanup; the original error is what matters.
      }
      throw err;
    }
  }

  /**
   * Reset configuration to defaults.
   * Backs up the current config before resetting.
   */
  reset(): ConfigSaveResult {
    try {
      if (fs.existsSync(this.configPath)) {
        // Move to backup before deleting
        try {
          fs.copyFileSync(this.configPath, this.backupPath);
        } catch {
          // Ignore backup errors
        }
        fs.unlinkSync(this.configPath);
        this.log('Config reset (backup preserved)');
      }
      return { success: true, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('Failed to reset config:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Get the path to the config file.
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get the path to the backup file.
   */
  getBackupPath(): string {
    return this.backupPath;
  }

  /**
   * Check if a saved config exists.
   */
  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Log a message if diagnostics are enabled.
   */
  private log(...args: unknown[]): void {
    if (this.diagnostics) {
      console.info('[ConfigStore]', ...args);
    }
  }
}
