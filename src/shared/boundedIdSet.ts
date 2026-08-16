/**
 * A fixed-capacity, insertion-ordered set of message ids.
 *
 * Deduplication only needs a short window: duplicates come from the 250 ms poll
 * overlap and from re-attaching the DOM observer, both bounded in time. An
 * unbounded Set, by contrast, retains every id of a multi-hour stream in both
 * the main and renderer processes — memory that never comes back.
 */

/** Retention for the overlay, an order of magnitude above the largest queue. */
export const OVERLAY_SEEN_ID_LIMIT = 500;

/** Retention for the chat source, which sees unfiltered traffic. */
export const CHAT_SOURCE_SEEN_ID_LIMIT = 2000;

/** Used when a caller does not care about the exact capacity. */
const DEFAULT_MAX_SIZE = 1000;

export class BoundedIdSet {
  private readonly ids = new Set<string>();
  private readonly maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    const parsed = Number(maxSize);
    this.maxSize = Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_MAX_SIZE;
  }

  /** Whether the id is still inside the retention window. */
  has(id: string): boolean {
    return this.ids.has(id);
  }

  /**
   * Remember an id, evicting the oldest ones once the capacity is exceeded.
   *
   * A JS `Set` iterates in insertion order, so the first value is always the
   * oldest.
   */
  add(id: string): void {
    if (this.ids.has(id)) {
      return;
    }

    this.ids.add(id);

    while (this.ids.size > this.maxSize) {
      const oldest = this.ids.values().next();
      if (oldest.done) {
        break;
      }
      this.ids.delete(oldest.value);
    }
  }

  /** Forget everything. */
  clear(): void {
    this.ids.clear();
  }

  /** Number of ids currently retained. */
  get size(): number {
    return this.ids.size;
  }

  /** Configured capacity. */
  get capacity(): number {
    return this.maxSize;
  }
}

// The overlay loads this file through a <script> tag (it has no module loader),
// so the class is published on window. Reached through globalThis because this
// module is also compiled for the main process, which has no DOM types.
const browserWindow = (globalThis as unknown as { window?: Record<string, unknown> }).window;

if (browserWindow) {
  browserWindow.boundedIdSet = {
    BoundedIdSet,
    OVERLAY_SEEN_ID_LIMIT,
    CHAT_SOURCE_SEEN_ID_LIMIT,
  };
}
