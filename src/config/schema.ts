/**
 * Unified configuration schema.
 * Single source of truth for validation, defaults, and UI metadata.
 */

import { isKickUrl, isTwitchUrl } from '../shared/hostnames';
import type { AppConfig, ConfigFieldMeta, ConfigSection } from './types';

/**
 * Current schema version. Increment when making breaking changes.
 */
export const CONFIG_VERSION = 1;

/**
 * Ordered list of configuration sections for UI rendering.
 */
export const CONFIG_SECTIONS: readonly ConfigSection[] = [
  'basic',
  'overlay',
  'sound',
  'performance',
  'advanced',
] as const;

/**
 * Section display names and descriptions.
 */
export const SECTION_META: Record<ConfigSection, { title: string; description: string }> = {
  basic: {
    title: 'Basic Settings',
    description: 'Essential configuration to get started',
  },
  overlay: {
    title: 'Overlay Settings',
    description: 'Customize the appearance and position of the chat bubble',
  },
  sound: {
    title: 'Sound',
    description: 'Notification sound settings',
  },
  performance: {
    title: 'Performance',
    description: 'Message filtering and queue settings',
  },
  advanced: {
    title: 'Advanced Settings',
    description: 'Developer and debugging options',
  },
};

/**
 * Complete configuration schema with validation and UI metadata.
 * Note: 'language' field is handled separately via the UI toggle (US/BR flags),
 * not rendered as a form field, but still part of AppConfig for persistence.
 */
export const CONFIG_SCHEMA: Record<keyof AppConfig, ConfigFieldMeta<AppConfig[keyof AppConfig]>> = {
  // Language is managed by the toggle buttons, not rendered as a form field
  language: {
    key: 'language',
    label: 'Language',
    description: 'UI language preference',
    type: 'select',
    default: 'en',
    section: 'basic',
    options: [
      { value: 'en', label: 'English' },
      { value: 'pt', label: 'Português' },
    ],
  },

  // Display selection for multi-monitor setups (0 = use primary display)
  displayId: {
    key: 'displayId',
    label: 'Display',
    description: 'Which monitor to show the overlay on',
    type: 'select',
    default: 0,
    section: 'overlay',
    options: [
      { value: 0, label: 'Primary Display' },
      // Additional options populated dynamically at runtime
    ],
  },

  twitchChatUrl: {
    key: 'twitchChatUrl',
    label: 'Twitch Chat URL',
    description:
      'The popout chat URL from your Twitch channel (e.g., https://www.twitch.tv/popout/yourname/chat?popout=)',
    type: 'string',
    default: '',
    envVar: 'TWITCH_CHAT_URL',
    section: 'basic',
    placeholder: 'https://www.twitch.tv/popout/yourname/chat?popout=',
    validate: (value: unknown): string | null => {
      const str = value as string;
      if (!str || !str.trim()) {
        // Emptiness is settled across both platform URLs, not per field.
        return null;
      }
      let url: URL;
      try {
        url = new URL(str);
      } catch {
        return 'Invalid URL format';
      }
      // Suffix match, not substring: twitch.tv.attacker.example must not pass.
      if (!isTwitchUrl(str)) {
        return 'URL must be from twitch.tv';
      }
      if (!url.pathname.includes('/popout/') && !url.pathname.includes('/chat')) {
        return 'URL should be a Twitch chat popout URL';
      }
      return null;
    },
  },

  kickChatUrl: {
    key: 'kickChatUrl',
    label: 'Kick Chat URL',
    description:
      'The popout chat URL from your Kick channel (e.g., https://kick.com/popout/yourname/chat)',
    type: 'string',
    default: '',
    envVar: 'KICK_CHAT_URL',
    section: 'basic',
    placeholder: 'https://kick.com/popout/yourname/chat',
    validate: (value: unknown): string | null => {
      const str = value as string;
      if (!str || !str.trim()) {
        // Emptiness is settled across both platform URLs, not per field.
        return null;
      }
      let url: URL;
      try {
        url = new URL(str);
      } catch {
        return 'Invalid URL format';
      }
      // Suffix match, not substring: kick.com.attacker.example must not pass.
      if (!isKickUrl(str)) {
        return 'URL must be from kick.com';
      }
      if (!url.pathname.includes('/popout/') && !url.pathname.includes('/chat')) {
        return 'URL should be a Kick chat popout URL';
      }
      return null;
    },
  },

  displaySeconds: {
    key: 'displaySeconds',
    label: 'Display Duration',
    description: 'How long each message is shown on screen (in seconds)',
    type: 'number',
    default: 5,
    envVar: 'DISPLAY_SECONDS',
    section: 'overlay',
    min: 1,
    max: 60,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 1 || num > 60) {
        return 'Must be between 1 and 60 seconds';
      }
      return null;
    },
  },

  overlayAnchor: {
    key: 'overlayAnchor',
    label: 'Overlay Position',
    description: 'Where the chat bubble appears on screen',
    type: 'select',
    default: 'bottom-left',
    envVar: 'OVERLAY_ANCHOR',
    section: 'overlay',
    options: [
      { value: 'bottom-left', label: 'Bottom Left' },
      { value: 'bottom-right', label: 'Bottom Right' },
      { value: 'top-left', label: 'Top Left' },
      { value: 'top-right', label: 'Top Right' },
    ],
    validate: (value: unknown): string | null => {
      const allowed = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
      if (!allowed.includes(value as string)) {
        return 'Invalid overlay position';
      }
      return null;
    },
  },

  overlayMargin: {
    key: 'overlayMargin',
    label: 'Screen Margin',
    description: 'Distance from screen edge (in pixels)',
    type: 'number',
    default: 24,
    envVar: 'OVERLAY_MARGIN',
    section: 'overlay',
    min: 0,
    max: 200,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 0 || num > 200) {
        return 'Must be between 0 and 200 pixels';
      }
      return null;
    },
  },

  bubbleMaxWidth: {
    key: 'bubbleMaxWidth',
    label: 'Bubble Max Width',
    description: 'Maximum width of the chat bubble (in pixels)',
    type: 'number',
    default: 420,
    envVar: 'BUBBLE_MAX_WIDTH',
    section: 'overlay',
    min: 120,
    max: 800,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 120 || num > 800) {
        return 'Must be between 120 and 800 pixels';
      }
      return null;
    },
  },

  maxMessageLength: {
    key: 'maxMessageLength',
    label: 'Max Message Length',
    description: 'Messages longer than this will be truncated with an ellipsis',
    type: 'number',
    default: 140,
    envVar: 'MAX_MESSAGE_LENGTH',
    section: 'performance',
    min: 10,
    max: 500,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 10 || num > 500) {
        return 'Must be between 10 and 500 characters';
      }
      return null;
    },
  },

  ignoreCommandPrefix: {
    key: 'ignoreCommandPrefix',
    label: 'Ignore Command Prefix',
    description: 'Messages starting with this prefix are ignored (leave empty to disable)',
    type: 'string',
    default: '!',
    envVar: 'IGNORE_COMMAND_PREFIX',
    section: 'performance',
    placeholder: '!',
  },

  ignoreUsers: {
    key: 'ignoreUsers',
    label: 'Ignored Users',
    description: 'Comma-separated list of usernames to ignore (e.g., "nightbot, streamelements")',
    type: 'string[]',
    default: [],
    envVar: 'IGNORE_USERS',
    section: 'performance',
    placeholder: 'nightbot, streamelements',
  },

  maxQueueLength: {
    key: 'maxQueueLength',
    label: 'Max Queue Length',
    description: 'Maximum number of messages waiting to be displayed. Oldest are dropped when full.',
    type: 'number',
    default: 50,
    envVar: 'MAX_QUEUE_LENGTH',
    section: 'advanced',
    min: 1,
    max: 500,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 1 || num > 500) {
        return 'Must be between 1 and 500';
      }
      return null;
    },
  },

  exitAnimationMs: {
    key: 'exitAnimationMs',
    label: 'Exit Animation Duration',
    description: 'Duration of the exit animation (in milliseconds). Set to 0 to disable.',
    type: 'number',
    default: 400,
    envVar: 'EXIT_ANIMATION_MS',
    section: 'advanced',
    min: 0,
    max: 2000,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 0 || num > 2000) {
        return 'Must be between 0 and 2000 milliseconds';
      }
      return null;
    },
  },

  attentionPauseMs: {
    key: 'attentionPauseMs',
    label: 'Attention Pause',
    description: 'Pause before avatar starts speaking, creating an "I arrived" effect (in ms). Set to 0 to disable.',
    type: 'number',
    default: 500,
    envVar: 'ATTENTION_PAUSE_MS',
    section: 'overlay',
    min: 0,
    max: 3000,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 0 || num > 3000) {
        return 'Must be between 0 and 3000 milliseconds';
      }
      return null;
    },
  },

  diagnostics: {
    key: 'diagnostics',
    label: 'Enable Diagnostics',
    description: 'Log detailed diagnostic information to the console',
    type: 'boolean',
    default: false,
    envVar: 'DIAGNOSTICS',
    section: 'advanced',
  },

  overlayDebug: {
    key: 'overlayDebug',
    label: 'Overlay Debug Mode',
    description: 'Show a visible frame around the overlay for positioning',
    type: 'boolean',
    default: false,
    envVar: 'OVERLAY_DEBUG',
    section: 'advanced',
  },

  devtools: {
    key: 'devtools',
    label: 'Open DevTools',
    description: 'Open developer tools on startup (for debugging)',
    type: 'boolean',
    default: false,
    envVar: 'DEVTOOLS',
    section: 'advanced',
  },

  notificationSoundEnabled: {
    key: 'notificationSoundEnabled',
    label: 'Enable Notification Sound',
    description: 'Play a sound when a new message appears',
    type: 'boolean',
    default: true,
    envVar: 'NOTIFICATION_SOUND_ENABLED',
    section: 'sound',
  },

  notificationSoundDevice: {
    key: 'notificationSoundDevice',
    label: 'Audio Output Device',
    description: 'Select which audio device to play the notification sound',
    type: 'string',
    default: '',
    envVar: 'NOTIFICATION_SOUND_DEVICE',
    section: 'sound',
    placeholder: 'System Default',
  },

  notificationSoundFile: {
    key: 'notificationSoundFile',
    label: 'Notification Sound',
    description: 'Full path to an audio file to play when a message appears',
    type: 'string',
    default: '',
    envVar: 'NOTIFICATION_SOUND_FILE',
    section: 'sound',
    placeholder: '',
  },

  notificationSoundVolume: {
    key: 'notificationSoundVolume',
    label: 'Sound Volume',
    description: 'Volume level for the notification sound (0-100%)',
    type: 'number',
    default: 50,
    envVar: 'NOTIFICATION_SOUND_VOLUME',
    section: 'sound',
    min: 0,
    max: 100,
    validate: (value: unknown): string | null => {
      const num = value as number;
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        return 'Must be between 0 and 100';
      }
      return null;
    },
  },
};
