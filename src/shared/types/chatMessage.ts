import type { Platform } from '../platforms';

/**
 * Represents a normalized chat message from any chat source.
 */
export interface ChatMessage {
  /**
   * Unique identifier, namespaced by platform so two sources feeding the same
   * queue cannot collide. Taken from the page when it offers one, generated
   * locally otherwise.
   */
  id: string;
  /** Which platform the message came from. */
  platform: Platform;
  /** Display name of the message author. */
  user: string;
  /** Text content of the message. */
  text: string;
  /** Unix timestamp in milliseconds when the message was sent or captured. */
  timestamp: number;
}

/**
 * Raw message item as extracted from a chat page's DOM by the injected script.
 *
 * Platform-independent: the source adds the platform and namespaces the id.
 */
export interface RawChatItem {
  id: string;
  user: string;
  text: string;
  timestamp: number | null;
  capturedAt: number;
}
