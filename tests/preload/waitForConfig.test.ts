/**
 * The overlay preload's config handshake.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Must come first: the preload requires `electron` at import time.
import { electronStub } from '../helpers/electronStub';

import { __pendingConfigResolvers } from '../../src/preload/index';
import type { OverlayConfig } from '../../src/shared/types';

const overlayChat = () =>
  electronStub.exposed.overlayChat as unknown as {
    getConfig: () => OverlayConfig;
    waitForConfig: (timeoutMs?: number) => Promise<OverlayConfig>;
    onMessage: (handler: unknown) => void;
    onMuteChange: (handler: unknown) => void;
  };

const CONFIG = { displaySeconds: 7, overlayAnchor: 'top-left' } as unknown as OverlayConfig;

test('the preload exposes overlayChat on the main world', () => {
  const api = overlayChat();

  assert.equal(typeof api.getConfig, 'function');
  assert.equal(typeof api.waitForConfig, 'function');
  assert.equal(typeof api.onMessage, 'function');
  assert.equal(typeof api.onMuteChange, 'function');
});

test('waitForConfig falls back to env config when the main process is silent', async () => {
  const before = __pendingConfigResolvers();

  const config = await overlayChat().waitForConfig(20);

  // Env fallback: schema-independent defaults compiled into the preload.
  assert.equal(config.displaySeconds, 5);
  assert.equal(config.overlayAnchor, 'bottom-left');

  // THE LEAK: the timeout used to look up `resolve` rather than the wrapper it
  // had actually pushed, so indexOf returned -1 and the entry was never removed.
  assert.equal(
    __pendingConfigResolvers(),
    before,
    'the timed-out waiter must be removed from the resolver list'
  );
});

test('repeated timeouts do not accumulate waiters', async () => {
  const before = __pendingConfigResolvers();

  await Promise.all([
    overlayChat().waitForConfig(10),
    overlayChat().waitForConfig(10),
    overlayChat().waitForConfig(10),
  ]);

  assert.equal(__pendingConfigResolvers(), before);
});

test('waitForConfig resolves with the config the main process sends', async () => {
  const pending = overlayChat().waitForConfig(1000);

  assert.equal(__pendingConfigResolvers(), 1, 'the waiter should be registered');

  electronStub.emit('set-config', CONFIG);
  const config = await pending;

  assert.equal(config.displaySeconds, 7);
  assert.equal(__pendingConfigResolvers(), 0, 'delivering config drains the waiter list');
});

test('once config has arrived, waitForConfig resolves immediately', async () => {
  const config = await overlayChat().waitForConfig(0);

  assert.equal(config.displaySeconds, 7);
  assert.equal(overlayChat().getConfig().displaySeconds, 7);
});
