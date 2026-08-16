/**
 * Kick chat source.
 *
 * Kick offers no semantic hook for the author or the message text — only
 * Tailwind utility classes, which change with the design. The spike measured
 * `span.font-bold` matching 27 of 28 rows and returning the `":"` separator, so
 * a selector chain here would look healthy and extract punctuation.
 *
 * Extraction is therefore **structural**, anchored on the two things that carry
 * meaning rather than styling:
 *
 *   - `[data-index]` on each row, which is a monotonically increasing message
 *     counter (restarting at 0 on every page load, hence the attach token)
 *   - the literal `:` element that separates author from text
 *
 * The list is virtualised: a sliding window of about thirty rows, old ones
 * removed as new arrive. Added rows are fresh elements rather than recycled
 * ones, so the WeakSet of seen nodes stays sound.
 *
 * Nothing here holds on to a DOM node between scans. Kick replaces the wrapper
 * that holds the rows shortly after the page becomes interactive: an observer
 * bound to the wrapper it found at attach time reports `attached: true`, sits on
 * a detached node and delivers nothing, with no error anywhere. That was
 * measured, not imagined — 698 ms to attach, then 0 rows observed for two
 * minutes while the live wrapper held 31. So rows are re-resolved on every scan,
 * the observer watches the container subtree, and a watchdog re-binds if the
 * container itself is ever swapped.
 */

import { KICK_DOMAIN_SUFFIXES } from '../shared/hostnames';
import { BrowserChatSource } from './chatSource';
import type { Platform } from '../shared/platforms';

/** Where the message list lives. These are the page's only stable hooks. */
const KICK_CONTAINER_SELECTORS = ['#chatroom-messages', '[data-testid="chatroom-messages"]'];

/**
 * Split a row's parts into author and text.
 *
 * Takes the `textContent` of the row body's children, in order, and finds the
 * literal ":" that separates author from message. Structural on purpose: the
 * spike measured `span.font-bold` matching 27 of 28 rows and returning that
 * separator, so matching by class is how you get punctuation instead of a name.
 *
 * Returns null for anything that is not a chat message — event rows have no
 * separator, and emote-only messages have no text, which the Twitch source
 * drops as well.
 *
 * Pure and free of closures: it is stringified into the injected script, so the
 * page runs exactly the code these tests exercise.
 */
export function extractKickMessage(partTexts: string[]): { user: string; text: string } | null {
  if (!Array.isArray(partTexts)) {
    return null;
  }

  let separator = -1;
  for (let i = 0; i < partTexts.length; i += 1) {
    if (typeof partTexts[i] === 'string' && partTexts[i].trim() === ':') {
      separator = i;
      break;
    }
  }

  // A separator at 0 would leave no author before it.
  if (separator <= 0) {
    return null;
  }

  const user = String(partTexts[separator - 1]).trim();

  let text = '';
  for (let i = separator + 1; i < partTexts.length; i += 1) {
    text += String(partTexts[i]);
  }
  text = text.trim();

  if (!user || !text) {
    return null;
  }

  return { user: user, text: text };
}


const buildKickObserverScript = (containerSelectors: string[]): string => `(() => {
  const containerSelectors = ${JSON.stringify(containerSelectors)};
  // The very same function the unit tests exercise, shipped into the page.
  const extractKickMessage = ${extractKickMessage.toString()};
  const stateKey = '__chatObserverState';

  if (!window[stateKey]) {
    window[stateKey] = {
      attached: false,
      attachAttempts: 0,
      selector: null,
      token: null,
      boundTo: null,
      watchdog: null
    };
  }

  const state = window[stateKey];
  if (state.attached) {
    return { attached: true, already: true, selector: state.selector };
  }

  state.attachAttempts += 1;
  window.__chatQueue = window.__chatQueue || [];
  window.__chatSeen = window.__chatSeen || new WeakSet();

  const findContainer = () => {
    for (const selector of containerSelectors) {
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

  // The scroll container holds a single spacer wrapper; rows are its children.
  // Kick swaps that wrapper after hydration, so it is looked up on every scan
  // and never stored.
  const currentRows = (container) => {
    const inner = container ? container.firstElementChild : null;
    return inner ? Array.prototype.slice.call(inner.children) : [];
  };

  // Wait for the wrapper before binding: attaching to an empty container would
  // make the first rows to render look like new traffic and replay the backlog.
  if (!containerMatch.node.firstElementChild) {
    return { attached: false, reason: 'no-inner-wrapper' };
  }

  // data-index restarts at 0 on every page load, so on its own it is not unique.
  // A token minted here makes ids unique for the life of this observation.
  if (!state.token) {
    state.token = Math.random().toString(36).slice(2, 10);
  }

  const rowBody = (row) => {
    const first = row.firstElementChild;
    return first ? first.firstElementChild : null;
  };

  /**
   * A row is a chat message when its body contains the ":" separator. Event
   * rows — subscriptions, host notices, moderation — do not, and are skipped
   * the way the Twitch source skips system notices.
   */
  const parseRow = (row) => {
    if (!row || row.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const body = rowBody(row);
    if (!body) {
      return null;
    }

    const partTexts = Array.prototype.slice
      .call(body.children)
      .map(function (child) { return child.textContent; });

    const parsed = extractKickMessage(partTexts);
    if (!parsed) {
      return null;
    }

    const index = row.getAttribute('data-index');

    return {
      id: index === null ? '' : state.token + '-' + index,
      user: parsed.user,
      text: parsed.text,
      // Kick renders a localised clock string, not a machine-readable datetime,
      // and hides it by default. capturedAt is the honest timestamp.
      timestamp: null,
      capturedAt: Date.now()
    };
  };

  const enqueueRow = (row) => {
    if (window.__chatSeen.has(row)) {
      return;
    }
    window.__chatSeen.add(row);

    const item = parseRow(row);
    if (item) {
      window.__chatQueue.push(item);
    }
  };

  // Everything already on screen is backlog, not new traffic. Runs on the first
  // bind and on every re-bind, so a wrapper swap replays no history.
  const markExisting = (container) => {
    for (const row of currentRows(container)) {
      window.__chatSeen.add(row);
    }
  };

  /**
   * Enqueue whatever is on screen and not yet seen.
   *
   * Driven by mutations rather than reading them: a mutation says "something
   * changed", and the rows are then re-resolved from the live DOM. Reading the
   * added nodes instead would tie this to one wrapper and to where in the tree
   * the insertion happened.
   */
  const scan = () => {
    const container = document.querySelector(state.selector);
    if (!container) {
      return;
    }
    for (const row of currentRows(container)) {
      try {
        enqueueRow(row);
      } catch (_) {
        // Best-effort extraction; ignore malformed rows.
      }
    }
  };

  // Synchronous: a scan walks about two dozen rows, so deferring it to coalesce
  // bursts would add a second mechanism to reason about and buy nothing.
  const observer = new MutationObserver(scan);

  const bind = (container) => {
    observer.disconnect();
    markExisting(container);
    // subtree: true because the wrapper between the container and the rows is
    // replaced; childList on the container alone would miss every message.
    observer.observe(container, { childList: true, subtree: true });
    state.boundTo = container;
  };

  // Set before binding: the scan and the watchdog both resolve the container
  // through it.
  state.selector = containerMatch.selector;

  bind(containerMatch.node);

  // The container is stable in practice, but so was the wrapper below it. If it
  // is ever replaced, re-bind instead of going quiet.
  //
  // A safety net, not the mechanism: this page is hidden, and Chromium throttles
  // timers on hidden pages, so the real interval may be far longer than asked.
  // Message delivery does not depend on it — that runs off the observer, whose
  // callbacks are microtasks.
  if (state.watchdog) {
    clearInterval(state.watchdog);
  }
  state.watchdog = setInterval(() => {
    const container = document.querySelector(state.selector);
    if (container && container !== state.boundTo) {
      bind(container);
    }
  }, 2000);

  state.attached = true;

  return { attached: true, selector: containerMatch.selector };
})();`;

export class KickChatSource extends BrowserChatSource {
  readonly platform: Platform = 'kick';
  protected readonly domainSuffixes = KICK_DOMAIN_SUFFIXES;

  protected buildObserverScript(): string {
    return buildKickObserverScript(KICK_CONTAINER_SELECTORS);
  }
}
