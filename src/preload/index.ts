/**
 * Preload script for the overlay window.
 * Receives configuration from main process or falls back to environment variables.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ChatMessage, OverlayAnchor, OverlayConfig } from '../shared/types';

// Default values (used as fallback if main process config is not available)
const DEFAULT_DISPLAY_SECONDS = 5;
const DEFAULT_BUBBLE_MAX_WIDTH = 420;
const DEFAULT_MAX_MESSAGE_LENGTH = 140;
const DEFAULT_IGNORE_COMMAND_PREFIX = '!';
const DEFAULT_MAX_QUEUE_LENGTH = 50;
const DEFAULT_OVERLAY_ANCHOR: OverlayAnchor = 'bottom-left';
const DEFAULT_OVERLAY_MARGIN = 24;
const DEFAULT_EXIT_ANIMATION_MS = 400;
// Must match src/config/schema.ts -> attentionPauseMs.default
const DEFAULT_ATTENTION_PAUSE_MS = 500;
const DEFAULT_NOTIFICATION_SOUND_ENABLED = true;
const DEFAULT_NOTIFICATION_SOUND_FILE = '';
const DEFAULT_NOTIFICATION_SOUND_VOLUME = 50;
const DEFAULT_NOTIFICATION_SOUND_DEVICE = '';

const ALLOWED_ANCHORS = new Set<OverlayAnchor>([
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-right',
]);

// Config received from main process (set via IPC)
let mainProcessConfig: OverlayConfig | null = null;
let configResolvers: Array<(config: OverlayConfig) => void> = [];

/** Exposed for tests: how many waiters are still registered. */
export const __pendingConfigResolvers = (): number => configResolvers.length;

// Listen for config from main process
ipcRenderer.on('set-config', (_event, config: OverlayConfig) => {
  mainProcessConfig = config;
  // Resolve any pending waitForConfig promises
  for (const resolve of configResolvers) {
    resolve(config);
  }
  configResolvers = [];
});

/**
 * Parse config from environment variables (fallback).
 */
function parseEnvConfig(): OverlayConfig {
  const displaySecondsRaw = process.env.DISPLAY_SECONDS;
  const parsedSeconds = Number(displaySecondsRaw);
  const displaySeconds =
    Number.isFinite(parsedSeconds) && parsedSeconds > 0
      ? parsedSeconds
      : DEFAULT_DISPLAY_SECONDS;

  const overlayAnchorRaw = (process.env.OVERLAY_ANCHOR || '') as OverlayAnchor;
  const overlayAnchor: OverlayAnchor = ALLOWED_ANCHORS.has(overlayAnchorRaw)
    ? overlayAnchorRaw
    : DEFAULT_OVERLAY_ANCHOR;

  const overlayMarginRaw = Number.parseInt(process.env.OVERLAY_MARGIN || '', 10);
  const overlayMargin = Number.isFinite(overlayMarginRaw)
    ? Math.max(0, overlayMarginRaw)
    : DEFAULT_OVERLAY_MARGIN;

  const bubbleMaxWidthRaw = Number.parseInt(process.env.BUBBLE_MAX_WIDTH || '', 10);
  const bubbleMaxWidth = Number.isFinite(bubbleMaxWidthRaw)
    ? Math.max(120, bubbleMaxWidthRaw)
    : DEFAULT_BUBBLE_MAX_WIDTH;

  const maxMessageLengthRaw = Number.parseInt(process.env.MAX_MESSAGE_LENGTH || '', 10);
  const maxMessageLength = Number.isFinite(maxMessageLengthRaw)
    ? Math.max(1, maxMessageLengthRaw)
    : DEFAULT_MAX_MESSAGE_LENGTH;

  const ignoreCommandPrefixRaw = process.env.IGNORE_COMMAND_PREFIX;
  const ignoreCommandPrefix =
    ignoreCommandPrefixRaw === undefined ? DEFAULT_IGNORE_COMMAND_PREFIX : ignoreCommandPrefixRaw;

  const ignoreUsersRaw = process.env.IGNORE_USERS || '';
  const ignoreUsers = ignoreUsersRaw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  const maxQueueLengthRaw = Number.parseInt(process.env.MAX_QUEUE_LENGTH || '', 10);
  const maxQueueLength = Number.isFinite(maxQueueLengthRaw)
    ? Math.max(1, maxQueueLengthRaw)
    : DEFAULT_MAX_QUEUE_LENGTH;

  const exitAnimationMsRaw = Number.parseInt(process.env.EXIT_ANIMATION_MS || '', 10);
  const exitAnimationMs = Number.isFinite(exitAnimationMsRaw)
    ? Math.max(0, exitAnimationMsRaw)
    : DEFAULT_EXIT_ANIMATION_MS;

  const attentionPauseMsRaw = Number.parseInt(process.env.ATTENTION_PAUSE_MS || '', 10);
  const attentionPauseMs = Number.isFinite(attentionPauseMsRaw)
    ? Math.max(0, attentionPauseMsRaw)
    : DEFAULT_ATTENTION_PAUSE_MS;

  const diagnostics = process.env.DIAGNOSTICS === '1';

  // Default to true if not explicitly disabled (env var not set or not '0')
  const notificationSoundEnabled =
    process.env.NOTIFICATION_SOUND_ENABLED === undefined
      ? DEFAULT_NOTIFICATION_SOUND_ENABLED
      : process.env.NOTIFICATION_SOUND_ENABLED !== '0';

  const notificationSoundFileRaw = process.env.NOTIFICATION_SOUND_FILE;
  const notificationSoundFile = notificationSoundFileRaw || DEFAULT_NOTIFICATION_SOUND_FILE;

  const notificationSoundVolumeRaw = Number.parseInt(process.env.NOTIFICATION_SOUND_VOLUME || '', 10);
  const notificationSoundVolume = Number.isFinite(notificationSoundVolumeRaw)
    ? Math.max(0, Math.min(100, notificationSoundVolumeRaw))
    : DEFAULT_NOTIFICATION_SOUND_VOLUME;

  const notificationSoundDevice = process.env.NOTIFICATION_SOUND_DEVICE || DEFAULT_NOTIFICATION_SOUND_DEVICE;

  return {
    displaySeconds,
    overlayAnchor,
    overlayMargin,
    bubbleMaxWidth,
    maxMessageLength,
    ignoreCommandPrefix,
    ignoreUsers,
    maxQueueLength,
    exitAnimationMs,
    attentionPauseMs,
    diagnostics,
    notificationSoundEnabled,
    notificationSoundFile,
    notificationSoundVolume,
    notificationSoundDevice,
  };
}

type MessageHandler = (message: ChatMessage) => void;
type MuteHandler = (muted: boolean) => void;

contextBridge.exposeInMainWorld('overlayChat', {
  onMessage: (handler: MessageHandler): void => {
    if (typeof handler !== 'function') {
      return;
    }

    ipcRenderer.on('chat-message', (_event, message: ChatMessage) => {
      handler(message);
    });
  },
  onMuteChange: (handler: MuteHandler): void => {
    if (typeof handler !== 'function') {
      return;
    }

    ipcRenderer.on('set-muted', (_event, muted: boolean) => {
      handler(muted);
    });
  },
  getConfig: (): OverlayConfig => {
    // Prefer config from main process, fall back to env vars
    if (mainProcessConfig) {
      return mainProcessConfig;
    }
    return parseEnvConfig();
  },
  waitForConfig: (timeoutMs = 2000): Promise<OverlayConfig> => {
    // If config already received, return immediately
    if (mainProcessConfig) {
      return Promise.resolve(mainProcessConfig);
    }
    // Otherwise wait for it with a timeout
    return new Promise((resolve) => {
      // Registered and removed by identity. The previous version looked up
      // `resolve`, which is not what was pushed, so `indexOf` always returned
      // -1 and the stale entry was kept forever.
      const settle = (config: OverlayConfig): void => {
        clearTimeout(timeout);
        resolve(config);
      };

      const timeout = setTimeout(() => {
        const index = configResolvers.indexOf(settle);
        if (index >= 0) {
          configResolvers.splice(index, 1);
        }
        resolve(parseEnvConfig());
      }, timeoutMs);

      configResolvers.push(settle);
    });
  },
});
