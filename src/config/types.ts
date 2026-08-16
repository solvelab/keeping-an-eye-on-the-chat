/**
 * Configuration types for the application.
 */

import type { AuthorStyle, OverlayAnchor } from '../shared/types/config';

/**
 * Source of where a configuration value came from.
 */
export type ConfigSource = 'default' | 'saved' | 'env' | 'cli';

/**
 * Configuration sections for UI organization.
 */
export type ConfigSection = 'basic' | 'overlay' | 'sound' | 'performance' | 'advanced';

/**
 * Supported UI languages.
 */
export type Language = 'en' | 'pt';

/**
 * Full application configuration.
 * Extends OverlayConfig with additional fields.
 */
export interface AppConfig {
  /** UI language preference. */
  language: Language;
  /** Display/monitor ID to show overlay (0 = primary). */
  displayId: number;
  /** Twitch chat popout URL. At least one platform URL must be set. */
  twitchChatUrl: string;
  /** Kick chat popout URL. At least one platform URL must be set. */
  kickChatUrl: string;
  /** Duration in seconds to display each message. */
  displaySeconds: number;
  /** Overlay position anchor. */
  overlayAnchor: OverlayAnchor;
  /** How the author's name is set apart from the message. */
  authorStyle: AuthorStyle;
  /** Margin in pixels from screen edge. */
  overlayMargin: number;
  /** Maximum width of chat bubble in pixels. */
  bubbleMaxWidth: number;
  /** Maximum message length before truncation. */
  maxMessageLength: number;
  /** Prefix for commands to ignore (e.g., "!"). */
  ignoreCommandPrefix: string;
  /** List of usernames to ignore (lowercase). */
  ignoreUsers: string[];
  /** Maximum queue length before dropping old messages. */
  maxQueueLength: number;
  /** Exit animation duration in milliseconds. */
  exitAnimationMs: number;
  /** Duration of attention pause before speaking (ms). 0 = disabled. */
  attentionPauseMs: number;
  /** Whether diagnostics logging is enabled. */
  diagnostics: boolean;
  /** Whether overlay debug frame is shown. */
  overlayDebug: boolean;
  /** Whether to open devtools on startup. */
  devtools: boolean;
  /** Whether notification sound is enabled. */
  notificationSoundEnabled: boolean;
  /** Path to the notification sound file (relative to assets/sounds/). */
  notificationSoundFile: string;
  /** Volume for notification sound (0-100). */
  notificationSoundVolume: number;
  /** Audio output device ID (empty string or 'default' for system default). */
  notificationSoundDevice: string;
}

/**
 * Field types supported by the config schema.
 */
export type ConfigFieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'select';

/**
 * Option for select-type fields.
 */
export interface ConfigSelectOption<T> {
  value: T;
  label: string;
}

/**
 * Metadata for a configuration field.
 * Drives validation, UI rendering, and documentation.
 */
export interface ConfigFieldMeta<T = unknown> {
  /** Field key in AppConfig. */
  key: keyof AppConfig;
  /** Human-readable label. */
  label: string;
  /** Short description for tooltips/help. */
  description: string;
  /** Data type of the field. */
  type: ConfigFieldType;
  /** Default value. */
  default: T;
  /** Environment variable name that maps to this field. */
  envVar?: string;
  /** UI section this field belongs to. */
  section: ConfigSection;
  /** Whether this field is required. */
  required?: boolean;
  /** Custom validation function. Returns error message or null. */
  validate?: (value: T) => string | null;
  /** Options for select-type fields. */
  options?: ConfigSelectOption<T>[];
  /** Minimum value for number fields. */
  min?: number;
  /** Maximum value for number fields. */
  max?: number;
  /** Placeholder text for input fields. */
  placeholder?: string;
}

/**
 * A field's metadata as it survives the IPC boundary.
 *
 * `validate` is a function and cannot be structured-cloned, so the main process
 * strips it before sending the schema to the renderer (`getSerializableSchema`).
 * The renderer must not claim to have it.
 */
export type SerializableFieldMeta = Omit<ConfigFieldMeta<unknown>, 'validate'>;

/**
 * Configuration with source tracking for each field.
 */
export interface TrackedConfig {
  /** The resolved configuration values. */
  values: AppConfig;
  /** Source of each field value. */
  sources: Record<keyof AppConfig, ConfigSource>;
}

/**
 * Stored configuration format with versioning.
 */
export interface StoredConfig {
  /** Schema version for migrations. */
  configVersion: number;
  /** ISO timestamp when config was saved. */
  savedAt: string;
  /** Partial config (only user-modified values). */
  config: Partial<AppConfig>;
}

/**
 * Preset configuration definition.
 */
export interface ConfigPreset {
  /** Unique preset identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Short description. */
  description: string;
  /** Partial config values to apply. */
  config: Partial<AppConfig>;
}

/**
 * Result of loading configuration from disk.
 */
export interface ConfigLoadResult {
  /** Loaded config (null if not found or corrupted). */
  config: Partial<AppConfig> | null;
  /** Error message if load failed. */
  error: string | null;
}

/**
 * Result of saving configuration to disk.
 */
export interface ConfigSaveResult {
  /** Whether save succeeded. */
  success: boolean;
  /** Error message if save failed. */
  error: string | null;
}

/**
 * Result of testing a Twitch connection.
 */
export interface ConnectionTestResult {
  /** Whether connection succeeded. */
  success: boolean;
  /** Error message if connection failed. */
  error: string | null;
  /** Round-trip latency in milliseconds. */
  latencyMs: number | null;
}

/**
 * Validation errors keyed by field name.
 */
export type ValidationErrors = Partial<Record<keyof AppConfig, string>>;
