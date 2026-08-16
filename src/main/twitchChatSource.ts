/**
 * Twitch chat source.
 *
 * Twitch exposes semantic hooks — data-a-target="chat-message-username" and
 * friends — so extraction is a chain of selectors with fallbacks, which is what
 * this injected script is.
 */

import { TWITCH_DOMAIN_SUFFIXES } from '../shared/hostnames';
import { BrowserChatSource } from './chatSource';
import type { Platform } from '../shared/platforms';


/** Selector chains, in priority order. Twitch's DOM is not an API. */
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

/** The selector chains handed to the injected script. */
interface ObserverConfig {
  containerSelectors: string[];
  messageSelectors: string[];
  userSelectors: string[];
  textSelectors: string[];
  ignoreSelectors: string[];
  timestampSelectors: string[];
}

const OBSERVER_CONFIG: ObserverConfig = {
  containerSelectors: DEFAULT_CONTAINER_SELECTORS,
  messageSelectors: DEFAULT_MESSAGE_SELECTORS,
  userSelectors: DEFAULT_USER_SELECTORS,
  textSelectors: DEFAULT_TEXT_SELECTORS,
  ignoreSelectors: DEFAULT_IGNORE_SELECTORS,
  timestampSelectors: DEFAULT_TIMESTAMP_SELECTORS
};

const buildTwitchObserverScript = (config: ObserverConfig): string => `(() => {
  const config = ${JSON.stringify(config)};
  const stateKey = '__chatObserverState';

  if (!window[stateKey]) {
    window[stateKey] = { attached: false, attachAttempts: 0, selector: null };
  }

  const state = window[stateKey];
  if (state.attached) {
    return { attached: true, already: true, selector: state.selector };
  }

  state.attachAttempts += 1;
  window.__chatQueue = window.__chatQueue || [];
  window.__chatSeen = window.__chatSeen || new WeakSet();

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

    window.__chatQueue.push({
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
      if (window.__chatSeen.has(messageNode)) {
        continue;
      }

      window.__chatSeen.add(messageNode);
      enqueueMessage(messageNode);
    }
  };

  const markExisting = () => {
    containerMatch.node.querySelectorAll(selectorList).forEach((node) => {
      window.__chatSeen.add(node);
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

export class TwitchChatSource extends BrowserChatSource {
  readonly platform: Platform = 'twitch';
  protected readonly domainSuffixes = TWITCH_DOMAIN_SUFFIXES;

  protected buildObserverScript(): string {
    return buildTwitchObserverScript(OBSERVER_CONFIG);
  }
}
