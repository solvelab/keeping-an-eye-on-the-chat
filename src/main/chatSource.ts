import { BrowserWindow } from 'electron';
import {
  SUPPRESSED_DOMAIN_SUFFIXES,
  TWITCH_DOMAIN_SUFFIXES,
  getHostname,
  hostnameMatches
} from '../shared/hostnames';
import { BoundedIdSet, CHAT_SOURCE_SEEN_ID_LIMIT } from '../shared/boundedIdSet';
import type { ChatMessage, RawChatItem } from '../shared/types';

const DEFAULT_CONTAINER_SELECTORS = [
  '[data-test-selector="chat-scrollable-area__message-container"]',
  '[data-a-target="chat-scrollable-area__message-container"]',
  '[role="log"]',
  '.chat-scrollable-area__message-container'
];

const DEFAULT_MESSAGE_SELECTORS = [
  '[data-a-target="chat-line-message"]',
  '[data-test-selector="chat-line-message"]',
  '[data-a-target="chat-message"]',
  '.chat-line__message'
];

const DEFAULT_USER_SELECTORS = [
  '[data-a-target="chat-message-username"]',
  '[data-test-selector="chat-message-username"]',
  '.chat-author__display-name'
];

const DEFAULT_TEXT_SELECTORS = [
  '[data-a-target="chat-message-text"]',
  '[data-test-selector="chat-message-text"]',
  '.chat-line__message-body'
];

const DEFAULT_IGNORE_SELECTORS = [
  '[data-a-target="user-notice-line"]',
  '[data-a-target="chat-deleted-message"]',
  '[data-a-target="chat-line-delete-message"]',
  '.chat-line__status'
];

const DEFAULT_TIMESTAMP_SELECTORS = ['time', '[data-a-target="chat-timestamp"]'];

interface ObserverConfig {
  containerSelectors: string[];
  messageSelectors: string[];
  userSelectors: string[];
  textSelectors: string[];
  ignoreSelectors: string[];
  timestampSelectors: string[];
}

interface ObserverResult {
  attached: boolean;
  already?: boolean;
  selector?: string;
  reason?: string;
}

interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface TwitchChatSourceOptions {
  url: string;
  onMessage?: (message: ChatMessage) => void;
  logger?: Logger;
  diagnostics?: boolean;
}

const OBSERVER_CONFIG: ObserverConfig = {
  containerSelectors: DEFAULT_CONTAINER_SELECTORS,
  messageSelectors: DEFAULT_MESSAGE_SELECTORS,
  userSelectors: DEFAULT_USER_SELECTORS,
  textSelectors: DEFAULT_TEXT_SELECTORS,
  ignoreSelectors: DEFAULT_IGNORE_SELECTORS,
  timestampSelectors: DEFAULT_TIMESTAMP_SELECTORS
};

const buildObserverScript = (config: ObserverConfig): string => `(() => {
  const config = ${JSON.stringify(config)};
  const stateKey = '__twitchChatObserverState';

  if (!window[stateKey]) {
    window[stateKey] = { attached: false, attachAttempts: 0, selector: null };
  }

  const state = window[stateKey];
  if (state.attached) {
    return { attached: true, already: true, selector: state.selector };
  }

  state.attachAttempts += 1;
  window.__twitchChatQueue = window.__twitchChatQueue || [];
  window.__twitchChatSeen = window.__twitchChatSeen || new WeakSet();

  const isElement = (node) => node && node.nodeType === Node.ELEMENT_NODE;

  const findContainer = () => {
    const selectors = config.containerSelectors || [];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) {
        return { node, selector };
      }
    }
    return null;
  };

  const containerMatch = findContainer();
  if (!containerMatch) {
    return { attached: false, reason: 'container-not-found' };
  }

  const messageSelectors = (config.messageSelectors || []).filter(Boolean);
  if (messageSelectors.length === 0) {
    return { attached: false, reason: 'no-message-selectors' };
  }
  const selectorList = messageSelectors.join(',');

  const ignoreSelectors = (config.ignoreSelectors || []).filter(Boolean);
  const userSelectors = (config.userSelectors || []).filter(Boolean);
  const textSelectors = (config.textSelectors || []).filter(Boolean);
  const timestampSelectors = (config.timestampSelectors || []).filter(Boolean);

  const matchesAny = (node, selectors) =>
    selectors.some((selector) => node.matches(selector));

  const queryAny = (node, selectors) => {
    for (const selector of selectors) {
      const match = node.querySelector(selector);
      if (match) {
        return match;
      }
    }
    return null;
  };

  const isSystemNotice = (node) => {
    if (!isElement(node)) {
      return true;
    }

    if (ignoreSelectors.length === 0) {
      return false;
    }

    return matchesAny(node, ignoreSelectors) || Boolean(queryAny(node, ignoreSelectors));
  };

  const getUser = (node) => {
    const userEl = queryAny(node, userSelectors);
    return userEl ? userEl.textContent.trim() : '';
  };

  const getText = (node) => {
    const textEl = queryAny(node, textSelectors);
    if (textEl) {
      return textEl.textContent.trim();
    }

    const fragments = node.querySelectorAll('.text-fragment');
    if (fragments.length === 0) {
      return '';
    }

    return Array.from(fragments)
      .map((fragment) => fragment.textContent)
      .join('')
      .trim();
  };

  const getId = (node) => {
    return (
      node.getAttribute('data-id') ||
      node.getAttribute('data-message-id') ||
      node.getAttribute('id') ||
      ''
    );
  };

  const getTimestamp = (node) => {
    const timeEl = queryAny(node, timestampSelectors);
    if (!timeEl) {
      return null;
    }

    const datetime = timeEl.getAttribute('datetime');
    if (!datetime) {
      return null;
    }

    const parsed = Date.parse(datetime);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const enqueueMessage = (node) => {
    if (isSystemNotice(node)) {
      return;
    }

    const user = getUser(node);
    const text = getText(node);

    if (!user || !text) {
      return;
    }

    window.__twitchChatQueue.push({
      id: getId(node),
      user,
      text,
      timestamp: getTimestamp(node),
      capturedAt: Date.now()
    });
  };

  const collectMessageNodes = (node) => {
    if (!isElement(node)) {
      return [];
    }

    const nodes = [];
    if (node.matches(selectorList)) {
      nodes.push(node);
    }

    node.querySelectorAll(selectorList).forEach((match) => nodes.push(match));
    return nodes;
  };

  const handleNode = (node) => {
    const nodes = collectMessageNodes(node);
    for (const messageNode of nodes) {
      if (window.__twitchChatSeen.has(messageNode)) {
        continue;
      }

      window.__twitchChatSeen.add(messageNode);
      enqueueMessage(messageNode);
    }
  };

  const markExisting = () => {
    containerMatch.node.querySelectorAll(selectorList).forEach((node) => {
      window.__twitchChatSeen.add(node);
    });
  };

  markExisting();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        try {
          handleNode(added);
        } catch (_) {
          // Best-effort extraction; ignore malformed nodes.
        }
      }
    }
  });

  observer.observe(containerMatch.node, { childList: true, subtree: true });
  state.attached = true;
  state.selector = containerMatch.selector;

  return { attached: true, selector: containerMatch.selector };
})();`;

export class TwitchChatSource {
  private readonly url: string;
  private readonly onMessage?: (message: ChatMessage) => void;
  private readonly logger: Logger;
  private readonly diagnostics: boolean;
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
  private readonly observerConfig: ObserverConfig = OBSERVER_CONFIG;

  constructor({ url, onMessage, logger, diagnostics }: TwitchChatSourceOptions) {
    this.url = url;
    this.onMessage = onMessage;
    this.logger = logger || console;
    this.diagnostics = Boolean(diagnostics);
  }

  start(): void {
    this.logDiagnostics(`Configured TWITCH_CHAT_URL: ${this.url ? this.url : '(empty)'}`);

    if (!this.url) {
      this.logger.info('Chat source disabled: no URL provided.');
      return;
    }

    try {
      new URL(this.url);
    } catch {
      this.logger.warn('Chat source disabled: invalid URL.');
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

    this.logDiagnostics('Hidden chat window created.');

    this.window.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        const hostname = getHostname(validatedURL);
        const isMainNavigation = validatedURL === this.url;
        const isSuppressed = hostname
          ? hostnameMatches(hostname, SUPPRESSED_DOMAIN_SUFFIXES)
          : false;
        const isTwitchDomain = hostname
          ? hostnameMatches(hostname, TWITCH_DOMAIN_SUFFIXES)
          : false;

        if (isMainNavigation || (isTwitchDomain && !isSuppressed)) {
          this.logger.error(
            `Chat source navigation failed (${errorCode}): ${errorDescription} (${validatedURL})`
          );
        }
      }
    );

    this.window.webContents.on('did-finish-load', () => {
      this.logDiagnostics('Hidden chat window finished loading.');
      this.attachObserverWithRetry();
    });

    this.window.webContents.on('dom-ready', () => {
      this.attachObserverWithRetry();
    });

    this.window.loadURL(this.url).catch((error: Error) => {
      this.logger.error(`Chat source failed to load URL: ${error.message}`);
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

  private logDiagnostics(message: string): void {
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
        this.logger.error('Chat source observer attachment timed out after 10s.');
        this.attachRetryActive = false;
        return;
      }

      let result: ObserverResult | null = null;
      try {
        result = await this.installObserver();
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Chat source executeJavaScript failed while attaching observer: ${err.message}`
        );
      }

      if (result && result.attached) {
        this.observerAttached = true;
        this.attachRetryActive = false;
        this.logDiagnostics(
          `MutationObserver attached (${result.selector || 'unknown selector'}).`
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
        buildObserverScript(this.observerConfig)
      )) as ObserverResult;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Chat source executeJavaScript failed: ${err.message}`);
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
        'window.__twitchChatQueue ? window.__twitchChatQueue.splice(0) : []'
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
          `Parsed message user="${message.user}" id="${message.id}" text="${message.text}"`
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
        `Chat source executeJavaScript failed while reading queue: ${err.message}`
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

    const id = rawId || this.buildLocalId(user, text, timestamp);

    return { id, user, text, timestamp };
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
