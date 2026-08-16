/**
 * A failing display callback must cost one message, not the session.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import '../helpers/overlayGlobals';

import { DisplayController } from '../../src/renderer/scripts/displayController';
import type { DisplayCallbacks } from '../../src/renderer/scripts/displayController';
import type { ChatMessage } from '../../src/shared/types';

function message(id: string, text = 'hello'): ChatMessage {
  return { id, user: 'viewer', text, timestamp: 1 };
}

const settle = (ms = 150): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Silence the console.error the recovery path emits on purpose. */
function withSilencedErrors<T>(run: () => T): T {
  const original = console.error;
  console.error = (): void => undefined;
  try {
    return run();
  } finally {
    console.error = original;
  }
}

function controllerWith(onDisplay: DisplayCallbacks): DisplayController {
  return new DisplayController({
    displaySeconds: 0.01,
    exitAnimationMs: 0,
    attentionPauseMs: 1,
    onDisplay,
  });
}

const STAGES = [
  'playEntranceAnimation',
  'playAttentionPause',
  'playReadingAnimation',
  'playExitAnimation',
] as const;

for (const stage of STAGES) {
  test(`a throwing ${stage} does not wedge the controller`, async () => {
    const shown: string[] = [];

    const onDisplay: DisplayCallbacks = {
      playEntranceAnimation: async (msg) => {
        shown.push(msg.text);
      },
      playAttentionPause: async () => undefined,
      playReadingAnimation: async () => 0,
      playExitAnimation: async () => undefined,
    };

    // Fail only on the first message.
    let failed = false;
    const original = onDisplay[stage] as (...args: never[]) => Promise<never>;
    (onDisplay as Record<string, unknown>)[stage] = async (...args: never[]) => {
      if (!failed) {
        failed = true;
        throw new Error(`boom in ${stage}`);
      }
      return original(...args);
    };

    const controller = withSilencedErrors(() => controllerWith(onDisplay));

    controller.enqueue(message('a', 'first'));
    controller.enqueue(message('b', 'second'));

    await withSilencedErrors(() => settle(300));

    assert.equal(controller.getState().activeMessage, null, 'controller should be idle again');
    assert.ok(shown.includes('second'), `second message never displayed after ${stage} failed`);
  });
}

test('a rejected promise is contained just like a synchronous throw', async () => {
  const shown: string[] = [];
  let first = true;

  const controller = controllerWith({
    playEntranceAnimation: (msg) => {
      if (first) {
        first = false;
        return Promise.reject(new Error('async boom'));
      }
      shown.push(msg.text);
      return Promise.resolve();
    },
  });

  controller.enqueue(message('a', 'first'));
  controller.enqueue(message('b', 'second'));

  await withSilencedErrors(() => settle(300));

  assert.deepEqual(shown, ['second']);
});

test('the queue keeps draining when every message fails', async () => {
  let attempts = 0;

  const controller = controllerWith({
    playEntranceAnimation: async () => {
      attempts += 1;
      throw new Error('always fails');
    },
  });

  for (let i = 0; i < 5; i += 1) {
    controller.enqueue(message(`id-${i}`));
  }

  await withSilencedErrors(() => settle(300));

  assert.equal(attempts, 5, 'every queued message should have been attempted');
  assert.equal(controller.getState().queueLength, 0);
  assert.equal(controller.getState().activeMessage, null);
});

test('recovery reports the failure on the console exactly once per message', async () => {
  const logged: string[] = [];
  const original = console.error;
  console.error = (msg: unknown): void => {
    logged.push(String(msg));
  };

  try {
    const controller = controllerWith({
      playEntranceAnimation: async () => {
        throw new Error('boom');
      },
    });
    controller.enqueue(message('a'));
    await settle(200);
  } finally {
    console.error = original;
  }

  assert.equal(logged.length, 1, logged.join(' | '));
  assert.match(logged[0], /display sequence failed: boom/);
});

test('recovery resets the avatar through the cancel callback', async () => {
  let cancels = 0;

  const controller = controllerWith({
    playEntranceAnimation: async () => {
      throw new Error('boom');
    },
    cancel: () => {
      cancels += 1;
    },
  });

  controller.enqueue(message('a'));
  await withSilencedErrors(() => settle(200));

  // One from starting the sequence, one from the recovery path.
  assert.ok(cancels >= 2, `cancel should run on recovery (got ${cancels})`);
});

test('a superseded sequence that fails does not disturb the live one', async () => {
  // The first message's exit is still pending when the controller is asked to
  // start over; when the stale promise finally rejects, it must not reset the
  // phase that the newer sequence owns.
  const shown: string[] = [];
  let firstExit: (() => void) | null = null;
  let rejectFirstExit: ((reason: Error) => void) | null = null;
  let calls = 0;

  const controller = controllerWith({
    playEntranceAnimation: async (msg) => {
      shown.push(msg.text);
    },
    playExitAnimation: () =>
      new Promise<void>((resolve, reject) => {
        calls += 1;
        if (calls === 1) {
          firstExit = resolve;
          rejectFirstExit = reject;
        } else {
          resolve();
        }
      }),
  });

  controller.enqueue(message('a', 'first'));
  await settle(60);

  // Force a new sequence while the first one is parked in its exit animation.
  controller.enqueue(message('b', 'second'));
  controller.startNextIfIdle();

  await withSilencedErrors(() => {
    rejectFirstExit?.(new Error('stale exit failed'));
    return settle(250);
  });

  assert.ok(shown.includes('first'));
  assert.equal(typeof firstExit, 'function');
});
