/**
 * Message queueing, filtering and display sequencing in the overlay.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DisplayController } from '../../src/renderer/scripts/displayController';
import type { DisplayControllerOptions } from '../../src/renderer/scripts/displayController';
import type { ChatMessage } from '../../src/shared/types';

/** Build a chat message with sensible defaults. */
function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'id-1', user: 'viewer', text: 'hello', timestamp: 1, ...overrides };
}

/**
 * A callback that never settles. Used to park the controller in the 'showing'
 * phase so queue behavior can be asserted without any pending timer.
 */
const never = (): Promise<never> => new Promise<never>(() => undefined);

/** Controller parked on the first message, so the queue can be inspected. */
function parkedController(options: DisplayControllerOptions = {}): DisplayController {
  return new DisplayController({
    displaySeconds: 5,
    exitAnimationMs: 0,
    attentionPauseMs: 0,
    onDisplay: { playEntranceAnimation: never },
    ...options,
  });
}

test('enqueue: rejects a message without a string id', () => {
  const controller = parkedController();

  controller.enqueue(undefined as unknown as ChatMessage);
  controller.enqueue({ user: 'viewer', text: 'hi' } as unknown as ChatMessage);

  assert.equal(controller.getState().totalReceived, 0);
});

test('enqueue: deduplicates by id', () => {
  const controller = parkedController();

  controller.enqueue(message({ id: 'a' }));
  controller.enqueue(message({ id: 'a', text: 'different text' }));

  assert.equal(controller.getState().totalReceived, 1);
});

test('enqueue: ignores users on the ignore list, case-insensitively', () => {
  const controller = parkedController({ ignoreUsers: ['NightBot'] });

  controller.enqueue(message({ id: 'a', user: 'nightbot' }));

  const state = controller.getState();
  assert.equal(state.ignoredCount, 1);
  assert.equal(state.totalDisplayed, 0);
  assert.equal(state.activeMessage, null);
});

test('enqueue: ignores messages starting with the command prefix', () => {
  const controller = parkedController({ ignoreCommandPrefix: '!' });

  controller.enqueue(message({ id: 'a', text: '!uptime' }));

  assert.equal(controller.getState().ignoredCount, 1);
});

test('enqueue: an empty command prefix disables command filtering', () => {
  const controller = parkedController({ ignoreCommandPrefix: '' });

  controller.enqueue(message({ id: 'a', text: '!uptime' }));

  const state = controller.getState();
  assert.equal(state.ignoredCount, 0);
  assert.equal(state.activeMessage?.text, '!uptime');
});

test('enqueue: truncates messages longer than the configured maximum', () => {
  const controller = parkedController({ maxMessageLength: 10 });

  controller.enqueue(message({ id: 'a', text: 'abcdefghijklmnop' }));

  const state = controller.getState();
  assert.equal(state.truncatedCount, 1);
  assert.equal(state.activeMessage?.text, 'abcdefghij…');
});

test('enqueue: a message exactly at the limit is not truncated', () => {
  const controller = parkedController({ maxMessageLength: 10 });

  controller.enqueue(message({ id: 'a', text: '0123456789' }));

  const state = controller.getState();
  assert.equal(state.truncatedCount, 0);
  assert.equal(state.activeMessage?.text, '0123456789');
});

test('enqueue: drops the oldest queued message when the queue overflows', () => {
  const controller = parkedController({ maxQueueLength: 2 });

  // The first message becomes active immediately; the rest queue up.
  controller.enqueue(message({ id: 'a', text: 'first' }));
  controller.enqueue(message({ id: 'b', text: 'second' }));
  controller.enqueue(message({ id: 'c', text: 'third' }));
  controller.enqueue(message({ id: 'd', text: 'fourth' }));

  const state = controller.getState();
  assert.equal(state.activeMessage?.text, 'first');
  assert.equal(state.queueLength, 2);
  assert.equal(state.droppedCount, 1);
  assert.equal(state.totalReceived, 4);
});

test('enqueue: trims surrounding whitespace from user and text', () => {
  const controller = parkedController();

  controller.enqueue(message({ id: 'a', user: '  viewer  ', text: '  hello  ' }));

  const state = controller.getState();
  assert.equal(state.activeMessage?.user, 'viewer');
  assert.equal(state.activeMessage?.text, 'hello');
});

test('constructor: falls back to safe values for invalid options', () => {
  const controller = new DisplayController({
    displaySeconds: Number.NaN,
    maxMessageLength: -5,
    maxQueueLength: 0,
    ignoreUsers: undefined,
    onDisplay: { playEntranceAnimation: never },
  });

  controller.enqueue(message({ id: 'a', text: 'x'.repeat(200) }));

  // maxMessageLength fell back to 140, so a 200-char message is truncated.
  assert.equal(controller.getState().truncatedCount, 1);
});

test('sequence: runs entrance, attention, reading and exit in order, then idles', async () => {
  const calls: string[] = [];

  const controller = new DisplayController({
    displaySeconds: 0.01,
    exitAnimationMs: 0,
    attentionPauseMs: 1,
    onDisplay: {
      playEntranceAnimation: async () => {
        calls.push('entrance');
      },
      playAttentionPause: async () => {
        calls.push('attention');
      },
      playReadingAnimation: async () => {
        calls.push('reading');
        return 0;
      },
      playExitAnimation: async () => {
        calls.push('exit');
      },
    },
  });

  controller.enqueue(message({ id: 'a' }));
  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.deepEqual(calls, ['entrance', 'attention', 'reading', 'exit']);
  assert.equal(controller.getState().activeMessage, null);
  assert.equal(controller.getState().totalDisplayed, 1);
});

test('sequence: a queued message is displayed after the previous one exits', async () => {
  const shown: string[] = [];

  const controller = new DisplayController({
    displaySeconds: 0.01,
    exitAnimationMs: 0,
    attentionPauseMs: 0,
    onDisplay: {
      playEntranceAnimation: async (msg: ChatMessage) => {
        shown.push(msg.text);
      },
    },
  });

  controller.enqueue(message({ id: 'a', text: 'first' }));
  controller.enqueue(message({ id: 'b', text: 'second' }));

  await new Promise((resolve) => setTimeout(resolve, 200));

  assert.deepEqual(shown, ['first', 'second']);
  assert.equal(controller.getState().totalDisplayed, 2);
  assert.equal(controller.getState().queueLength, 0);
});

test('sequence: attention pause is skipped when configured to zero', async () => {
  const calls: string[] = [];

  const controller = new DisplayController({
    displaySeconds: 0.01,
    exitAnimationMs: 0,
    attentionPauseMs: 0,
    onDisplay: {
      playAttentionPause: async () => {
        calls.push('attention');
      },
    },
  });

  controller.enqueue(message({ id: 'a' }));
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.deepEqual(calls, []);
});
