/**
 * Configuration merge logic with source tracking.
 * Implements deterministic precedence: defaults -> saved -> env -> cli
 */

import type { AppConfig, ConfigSource, TrackedConfig, ValidationErrors } from './types';
import { CONFIG_SCHEMA } from './schema';
import { getDefaults } from './defaults';

/**
 * Environment variables record type.
 */
type EnvRecord = Record<string, string | undefined>;

/**
 * Options for merging configuration.
 */
export interface MergeOptions {
  /** Default values (optional, uses schema defaults if not provided). */
  defaults?: AppConfig;
  /** Saved configuration from disk. */
  saved?: Partial<AppConfig> | null;
  /** Environment variables (defaults to process.env). */
  env?: EnvRecord;
  /** CLI/runtime flag overrides. */
  cli?: Partial<AppConfig>;
  /** Enable diagnostic logging. */
  diagnostics?: boolean;
}

/**
 * Parse an environment variable value to the expected type.
 */
function parseEnvValue(raw: string, type: string): unknown {
  switch (type) {
    case 'number': {
      const num = Number(raw);
      return Number.isFinite(num) ? num : null;
    }
    case 'boolean':
      return raw === '1' || raw.toLowerCase() === 'true';
    case 'string[]':
      return raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    case 'string':
    case 'select':
    default:
      return raw;
  }
}

/**
 * Merge configuration from multiple sources with source tracking.
 *
 * Precedence (later sources override earlier):
 * 1. Schema defaults
 * 2. Saved config from disk
 * 3. Environment variables
 * 4. CLI/runtime flags
 */
export function mergeConfig(options: MergeOptions = {}): TrackedConfig {
  const { defaults = getDefaults(), saved, env = process.env, cli = {}, diagnostics = false } = options;

  const values: Partial<AppConfig> = {};
  const sources: Partial<Record<keyof AppConfig, ConfigSource>> = {};

  for (const [key, meta] of Object.entries(CONFIG_SCHEMA)) {
    const k = key as keyof AppConfig;
    let value: unknown = defaults[k];
    let source: ConfigSource = 'default';

    // Layer 2: Saved config from disk
    if (saved && saved[k] !== undefined) {
      value = saved[k];
      source = 'saved';
    }

    // Layer 3: Environment variables
    if (meta.envVar && env[meta.envVar] !== undefined && env[meta.envVar] !== '') {
      const envValue = parseEnvValue(env[meta.envVar]!, meta.type);
      if (envValue !== null) {
        value = envValue;
        source = 'env';
      }
    }

    // Layer 4: CLI/runtime flags
    if (cli[k] !== undefined) {
      value = cli[k];
      source = 'cli';
    }

    (values as Record<string, unknown>)[k] = value;
    sources[k] = source;

    if (diagnostics && source !== 'default') {
      console.info(`[ConfigMerge] ${k}: ${JSON.stringify(value)} (source: ${source})`);
    }
  }

  return {
    values: values as AppConfig,
    sources: sources as Record<keyof AppConfig, ConfigSource>,
  };
}

/**
 * Validate a configuration object.
 * Returns an object with field keys as keys and error messages as values.
 */
export function validateConfig(config: AppConfig): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const [key, meta] of Object.entries(CONFIG_SCHEMA)) {
    const k = key as keyof AppConfig;
    const value = config[k];

    // Required field check
    if (meta.required) {
      if (value === undefined || value === null || value === '') {
        errors[k] = `${meta.label} is required`;
        continue;
      }
    }

    // Skip validation for empty optional fields
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Custom validation function
    if (meta.validate) {
      const error = meta.validate(value);
      if (error) {
        errors[k] = error;
      }
    }
  }

  applyCrossFieldRules(config, errors);

  return errors;
}

/**
 * Rules that no single field can express.
 *
 * A per-field `required` cannot say "at least one of these", so the platform
 * URLs are validated together: the app has nothing to observe when both are
 * empty, but either one alone is a complete configuration.
 */
function applyCrossFieldRules(config: AppConfig, errors: ValidationErrors): void {
  const twitch = typeof config.twitchChatUrl === 'string' ? config.twitchChatUrl.trim() : '';
  const kick = typeof config.kickChatUrl === 'string' ? config.kickChatUrl.trim() : '';

  if (twitch === '' && kick === '') {
    const message = 'Enter a Twitch or a Kick chat URL';
    // Reported on both fields, so whichever one the user is looking at says so.
    errors.twitchChatUrl = message;
    errors.kickChatUrl = message;
  }
}

/**
 * Create a partial config containing only fields that differ from defaults.
 * Used when saving to disk to minimize stored data.
 */
export function diffFromDefaults(config: AppConfig): Partial<AppConfig> {
  const defaults = getDefaults();
  const diff: Partial<AppConfig> = {};

  for (const key of Object.keys(CONFIG_SCHEMA) as (keyof AppConfig)[]) {
    const value = config[key];
    const defaultValue = defaults[key];

    // Compare arrays specially
    if (Array.isArray(value) && Array.isArray(defaultValue)) {
      if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
        (diff as Record<string, unknown>)[key] = value;
      }
    } else if (value !== defaultValue) {
      (diff as Record<string, unknown>)[key] = value;
    }
  }

  return diff;
}
