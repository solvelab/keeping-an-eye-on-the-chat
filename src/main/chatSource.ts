/**
 * Chat observation, platform-independent.
 *
 * Every source works the same way: load a chat page in a hidden BrowserWindow,
 * inject a MutationObserver that pushes raw items onto a queue in the page, and
 * drain that queue from the main process. What differs per platform is only the
 * injected script, the domains whose load failures are worth reporting, and how
 * a DOM row becomes {id, user, text, timestamp}.
 *
 * A platform is therefore added by extending `BrowserChatSource`, not by editing
 * the code that drives it.
 */

import { BrowserWindow } from 'electron';
import { SUPPRESSED_DOMAIN_SUFFIXES, getHostname, hostnameMatches } from '../shared/hostnames';
import { BoundedIdSet, CHAT_SOURCE_SEEN_ID_LIMIT } from '../shared/boundedIdSet';
import type { Platform } from '../shared/platforms';
import type { ChatMessage, RawChatItem } from '../shared/types';

/** The global the injected script fills, read by `flushQueue`. */
export const CHAT_QUEUE_GLOBAL = '__chatQueue';

/** What an injected observer script returns when asked to attach. */
export interface ObserverResult {
  attached: boolean;
  already?: boolean;
  selector?: string;
  reason?: string;
}

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface ChatSourceOptions {
  url: string;
  onMessage?: (message: ChatMessage) => void;
  logger?: Logger;
  diagnostics?: boolean;
}

/** A source of chat messages for one platform. */
export interface ChatSource {
  readonly platform: Platform;
  start(): void;
  stop(): void;
}

/**
 * A chat source that reads a page in a hidden BrowserWindow.
 *
 * Owns the whole lifecycle — window, retry with backoff, polling, dedup and
 * normalisation. Subclasses supply only what is platform-specific.
 */
export abstract class BrowserChatSource implements ChatSource {
  /** Which platform this source reads. */
  abstract readonly platform: Platform;

  /**
   * The script injected into the page. It must attach a MutationObserver and
   * push raw items onto `window[CHAT_QUEUE_GLOBAL]`, returning an
   * {@link ObserverResult}. It is re-run until it reports `attached`.
   */
  protected abstract buildObserverScript(): string;

  /**
   * Domains that belong to this platform. A load failure on one of these is
   * worth reporting; a failure on somebody else's ad domain is not.
   */
  protected abstract readonly domainSuffixes: readonly string[];

  protected readonly url: string;
  protected readonly logger: Logger;
  protected readonly diagnostics: boolean;
  private readonly onMessage?: (message: ChatMessage) => void;

  private window: BrowserWindow | null = null;
  private poller: NodeJS.Timeout | null = null;
  private attachRetryTimer: NodeJS.Timeout | null = null;
  private attachRetryActive = false;
  private attachStart: number | null = null;
  private observerAttached = false;
  private readonly attachTimeoutMs = 10000;
  private readonly attachBackoffMs = 250;
  private readonly attachBackoffMaxMs = 2000;
  private localCounter = 0;
  // Bounded: a long stream would otherwise retain every id it ever saw.
  private readonly seenIds = new BoundedIdSet(CHAT_SOURCE_SEEN_ID_LIMIT);

  constructor({ url, onMessage, logger, diagnostics }: ChatSourceOptions) {
    this.url = url;
    this.onMessage = onMessage;
    this.logger = logger || console;
    this.diagnostics = Boolean(diagnostics);
  }

  start(): void {
    this.logDiagnostics(`Configured ${this.platform} chat URL: ${this.url ? this.url : '(empty)'}`);

    if (!this.url) {
      this.logger.info(`Chat source disabled (${this.platform}): no URL provided.`);
      return;
    }

    try {
      new URL(this.url);
    } catch {
      this.logger.warn(`Chat source disabled (${this.platform}): invalid URL.`);
      return;
    }

    this.window = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    this.logDiagnostics(`Hidden chat window created (${this.platform}).`);

    this.window.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        const hostname = getHostname(validatedURL);
        const isMainNavigation = validatedURL === this.url;
        const isSuppressed = hostname
          ? hostnameMatches(hostname, SUPPRESSED_DOMAIN_SUFFIXES)
          : false;
        const isPlatformDomain = hostname ? hostnameMatches(hostname, this.domainSuffixes) : false;

        if (isMainNavigation || (isPlatformDomain && !isSuppressed)) {
          this.logger.error(
            `Chat source navigation failed (${this.platform}, ${errorCode}): ${errorDescription} (${validatedURL})`
          );
        }
      }
    );

    this.window.webContents.on('did-finish-load', () => {
      this.logDiagnostics(`Hidden chat window finished loading (${this.platform}).`);
      this.attachObserverWithRetry();
    });

    this.window.webContents.on('dom-ready', () => {
      this.attachObserverWithRetry();
    });

    this.window.loadURL(this.url).catch((error: Error) => {
      this.logger.error(`Chat source failed to load URL (${this.platform}): ${error.message}`);
    });

    this.startPolling();
  }

  stop(): void {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }

    if (this.attachRetryTimer) {
      clearTimeout(this.attachRetryTimer);
      this.attachRetryTimer = null;
    }

    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }

    this.window = null;
    this.attachRetryActive = false;
    this.observerAttached = false;
    this.seenIds.clear();
  }

  protected logDiagnostics(message: string): void {
    if (!this.diagnostics) {
      return;
    }

    this.logger.info(`[diagnostics] ${message}`);
  }

  private attachObserverWithRetry(): void {
    if (this.observerAttached || this.attachRetryActive) {
      return;
    }

    this.attachRetryActive = true;
    this.attachStart = Date.now();
    let delay = this.attachBackoffMs;

    const attempt = async (): Promise<void> => {
      if (!this.window || this.window.isDestroyed()) {
        this.attachRetryActive = false;
        return;
      }

      const elapsed = Date.now() - (this.attachStart ?? 0);
      if (elapsed >= this.attachTimeoutMs) {
        this.logger.error(
          `Chat source observer attachment timed out after 10s (${this.platform}).`
        );
        this.attachRetryActive = false;
        return;
      }

      let result: ObserverResult | null = null;
      try {
        result = await this.installObserver();
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Chat source executeJavaScript failed while attaching observer (${this.platform}): ${err.message}`
        );
      }

      if (result && result.attached) {
        this.observerAttached = true;
        this.attachRetryActive = false;
        this.logDiagnostics(
          `MutationObserver attached (${this.platform}, ${result.selector || 'unknown selector'}).`
        );
        return;
      }

      delay = Math.min(delay * 2, this.attachBackoffMaxMs);
      this.attachRetryTimer = setTimeout(() => {
        void attempt();
      }, delay);
    };

    void attempt();
  }

  private async installObserver(): Promise<ObserverResult> {
    if (!this.window || this.window.isDestroyed()) {
      return { attached: false, reason: 'window-not-ready' };
    }

    try {
      return (await this.window.webContents.executeJavaScript(
        this.buildObserverScript()
      )) as ObserverResult;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Chat source executeJavaScript failed (${this.platform}): ${err.message}`
      );
      return { attached: false, reason: 'execute-failed' };
    }
  }

  private startPolling(): void {
    if (this.poller) {
      return;
    }

    this.poller = setInterval(() => {
      void this.flushQueue();
    }, 250);
  }

  private async flushQueue(): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    if (this.window.webContents.isLoading()) {
      return;
    }

    try {
      const items = (await this.window.webContents.executeJavaScript(
        `window.${CHAT_QUEUE_GLOBAL} ? window.${CHAT_QUEUE_GLOBAL}.splice(0) : []`
      )) as RawChatItem[];

      if (!Array.isArray(items) || items.length === 0) {
        return;
      }

      for (const item of items) {
        const message = this.normalizeMessage(item);
        if (!message) {
          continue;
        }

        this.logDiagnostics(
          `Parsed message (${this.platform}) user="${message.user}" id="${message.id}" text="${message.text}"`
        );

        if (this.seenIds.has(message.id)) {
          continue;
        }

        this.seenIds.add(message.id);
        this.onMessage?.(message);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Chat source executeJavaScript failed while reading queue (${this.platform}): ${err.message}`
      );
    }
  }

  private normalizeMessage(item: RawChatItem): ChatMessage | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const user = typeof item.user === 'string' ? item.user.trim() : '';
    const text = typeof item.text === 'string' ? item.text.trim() : '';

    if (!user || !text) {
      return null;
    }

    const rawId = typeof item.id === 'string' ? item.id.trim() : '';
    const timestamp =
      Number.isFinite(item.timestamp) && item.timestamp !== null && item.timestamp > 0
        ? item.timestamp
        : Number.isFinite(item.capturedAt)
          ? item.capturedAt
          : Date.now();

    // Namespaced by platform: two sources feed one queue, and a page's own id is
    // only unique within that page.
    const id = `${this.platform}-${rawId || this.buildLocalId(user, text, timestamp)}`;

    return { id, platform: this.platform, user, text, timestamp };
  }

  private buildLocalId(user: string, text: string, timestamp: number): string {
    this.localCounter += 1;
    const hash = this.hashString(`${user}|${text}`);
    return `local-${this.localCounter}-${timestamp}-${hash}`;
  }

  private hashString(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) + hash + value.charCodeAt(i);
      hash &= 0xffffffff;
    }
    return Math.abs(hash).toString(16);
  }
}
