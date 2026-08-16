/**
 * Kick row parsing.
 *
 * `extractKickMessage` is the function the injected script actually runs — it is
 * stringified into the page — so these tests exercise the shipped code rather
 * than a copy of it.
 *
 * The fixtures are the row shapes observed on a live Kick chat during spike #40:
 * a row body's children are [timestamp, author, ":", text].
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { extractKickMessage } from '../../src/main/kickChatSource';

test('parses a normal message', () => {
  const parts = ['11:46 PM', 'gfin', ':', 'ou um buff de alguma coisa'];

  assert.deepEqual(extractKickMessage(parts), {
    user: 'gfin',
    text: 'ou um buff de alguma coisa',
  });
});

test('joins a message split across several elements', () => {
  // Links, mentions and inline elements arrive as separate children.
  const parts = ['11:46 PM', 'viewer', ':', 'look at ', 'this link', ' now'];

  assert.deepEqual(extractKickMessage(parts), {
    user: 'viewer',
    text: 'look at this link now',
  });
});

test('drops an emote-only message', () => {
  // The body is <img> elements, so textContent is empty. The Twitch source
  // drops these too, so this is parity rather than a Kick-specific loss.
  const parts = ['11:48 PM', 'xxXStazXxx', ':', ''];

  assert.equal(extractKickMessage(parts), null);
});

test('drops an event row, which has no separator', () => {
  // Subscriptions, host notices and moderation actions look like this.
  assert.equal(extractKickMessage(['Sent by somebody', 'a pinned announcement']), null);
  assert.equal(extractKickMessage(['somebody just subscribed']), null);
});

test('drops a row whose separator comes first, leaving no author', () => {
  assert.equal(extractKickMessage([':', 'orphaned text']), null);
});

test('trims the author and the message', () => {
  assert.deepEqual(extractKickMessage(['', '  viewer  ', ':', '  hello  ']), {
    user: 'viewer',
    text: 'hello',
  });
});

test('uses the first separator, so a colon inside the message is kept', () => {
  const parts = ['11:46 PM', 'viewer', ':', 'ratio is 3:1 here'];

  assert.deepEqual(extractKickMessage(parts), { user: 'viewer', text: 'ratio is 3:1 here' });
});

test('a message whose text is only a colon is still a message', () => {
  // The first ":" is the separator; whatever follows is what the viewer typed,
  // and someone typing just ":" has said something. Dropping it would be the bug.
  assert.deepEqual(extractKickMessage(['11:46 PM', 'viewer', ':', ':']), {
    user: 'viewer',
    text: ':',
  });
});

test('an author of only whitespace is not a message', () => {
  assert.equal(extractKickMessage(['11:46 PM', '   ', ':', 'hello']), null);
});

test('handles malformed input without throwing', () => {
  assert.equal(extractKickMessage([]), null);
  assert.equal(extractKickMessage(undefined as unknown as string[]), null);
  assert.equal(extractKickMessage(null as unknown as string[]), null);
  assert.equal(extractKickMessage('nope' as unknown as string[]), null);
});

test('the timestamp element does not become the author', () => {
  // The author is whatever sits immediately before the separator, so a hidden
  // or missing timestamp cannot shift it.
  assert.deepEqual(extractKickMessage(['viewer', ':', 'no timestamp element']), {
    user: 'viewer',
    text: 'no timestamp element',
  });
});
