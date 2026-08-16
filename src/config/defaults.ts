/**
 * Default configuration values and presets.
 */

import type { AppConfig, ConfigPreset } from './types';
import { CONFIG_SCHEMA } from './schema';

/**
 * Build default configuration from schema.
 * Ensures defaults are always in sync with schema definitions.
 */
export function getDefaults(): AppConfig {
  const defaults: Partial<AppConfig> = {};

  for (const [key, meta] of Object.entries(CONFIG_SCHEMA)) {
    (defaults as Record<string, unknown>)[key] = meta.default;
  }

  return defaults as AppConfig;
}

/**
 * The settings a preset is allowed to control.
 *
 * Presets describe a *timing profile* and nothing else. Everything outside this
 * list — the Twitch URL above all, plus language, monitor, position and sound —
 * belongs to the user and survives applying one.
 */
export const PRESET_KEYS = [
  'displaySeconds',
  'maxQueueLength',
  'maxMessageLength',
  'exitAnimationMs',
  'attentionPauseMs',
] as const satisfies readonly (keyof AppConfig)[];

/**
 * The schema's own values for the preset keys.
 *
 * Read from `CONFIG_SCHEMA` rather than written out again, so changing a
 * default in one place cannot leave the "Default" preset behind.
 */
function schemaDefaultsForPresetKeys(): Partial<AppConfig> {
  const values: Partial<AppConfig> = {};

  for (const key of PRESET_KEYS) {
    (values as Record<string, unknown>)[key] = CONFIG_SCHEMA[key].default;
  }

  return values;
}

/**
 * Built-in configuration presets.
 *
 * All three declare exactly the same keys — stock, fast, cozy — so picking one
 * is always a complete choice of timing profile rather than a partial nudge.
 */
export const PRESETS: readonly ConfigPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Restores the standard timing, leaving your other settings alone',
    config: schemaDefaultsForPresetKeys(),
  },
  {
    id: 'fast-chat',
    name: 'Fast-Paced Chat',
    description: 'Shorter display times for active chats with many messages',
    config: {
      displaySeconds: 3,
      maxQueueLength: 100,
      maxMessageLength: 100,
      exitAnimationMs: 250,
      attentionPauseMs: 500,
    },
  },
  {
    id: 'cozy',
    name: 'Cozy Stream',
    description: 'Longer display times for relaxed streams with slower chat',
    config: {
      displaySeconds: 8,
      maxQueueLength: 20,
      maxMessageLength: 200,
      exitAnimationMs: 500,
      attentionPauseMs: 1500,
    },
  },
];

/**
 * Get a preset by ID.
 */
export function getPreset(id: string): ConfigPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/**
 * Apply a preset to defaults, returning a full config.
 */
export function applyPreset(presetId: string): AppConfig {
  const defaults = getDefaults();
  const preset = getPreset(presetId);

  if (!preset) {
    return defaults;
  }

  return { ...defaults, ...preset.config };
}
