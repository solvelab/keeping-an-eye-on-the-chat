/**
 * Fixed-capacity deduplication cache.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BoundedIdSet,
  CHAT_SOURCE_SEEN_ID_LIMIT,
  OVERLAY_SEEN_ID_LIMIT,
} from '../../src/shared/boundedIdSet';

test('deduplicates inside the retention window', () => {
  const seen = new BoundedIdSet(10);

  seen.add('a');
  seen.add('a');

  assert.equal(seen.has('a'), true);
  assert.equal(seen.size, 1);
});

test('never grows past its capacity', () => {
  const seen = new BoundedIdSet(5);

  for (let i = 0; i < 1000; i += 1) {
    seen.add(`id-${i}`);
  }

  assert.equal(seen.size, 5);
  assert.equal(seen.capacity, 5);
});

test('evicts the oldest entries first', () => {
  const seen = new BoundedIdSet(3);

  seen.add('a');
  seen.add('b');
  seen.add('c');
  seen.add('d');

  assert.equal(seen.has('a'), false, 'oldest should have been evicted');
  assert.equal(seen.has('b'), true);
  assert.equal(seen.has('c'), true);
  assert.equal(seen.has('d'), true);
});

test('re-adding a known id does not refresh its position', () => {
  // Insertion order is what eviction follows; a repeat is a no-op, so the id
  // stays as old as it was. This keeps eviction predictable.
  const seen = new BoundedIdSet(3);

  seen.add('a');
  seen.add('b');
  seen.add('a');
  seen.add('c');
  seen.add('d');

  assert.equal(seen.has('a'), false);
  assert.equal(seen.size, 3);
});

test('an evicted id is accepted again', () => {
  const seen = new BoundedIdSet(2);

  seen.add('a');
  seen.add('b');
  seen.add('c');
  assert.equal(seen.has('a'), false);

  seen.add('a');
  assert.equal(seen.has('a'), true);
});

test('clear forgets everything but keeps the capacity', () => {
  const seen = new BoundedIdSet(4);

  seen.add('a');
  seen.add('b');
  seen.clear();

  assert.equal(seen.size, 0);
  assert.equal(seen.has('a'), false);
  assert.equal(seen.capacity, 4);
});

test('a capacity of 1 keeps only the most recent id', () => {
  const seen = new BoundedIdSet(1);

  seen.add('a');
  seen.add('b');

  assert.equal(seen.has('a'), false);
  assert.equal(seen.has('b'), true);
});

test('an invalid capacity falls back to the default instead of throwing', () => {
  for (const bad of [0, -5, Number.NaN, undefined as unknown as number]) {
    const seen = new BoundedIdSet(bad);
    assert.equal(seen.capacity, 1000, `capacity ${String(bad)} should fall back`);
  }
});

test('a fractional capacity is floored', () => {
  assert.equal(new BoundedIdSet(7.9).capacity, 7);
});

test('the shipped limits are large enough for their duplicate windows', () => {
  // The overlay's queue tops out at 500 (schema max for maxQueueLength) and the
  // chat source polls every 250 ms, so both windows are far smaller than these.
  assert.equal(OVERLAY_SEEN_ID_LIMIT, 500);
  assert.equal(CHAT_SOURCE_SEEN_ID_LIMIT, 2000);
  assert.ok(CHAT_SOURCE_SEEN_ID_LIMIT > OVERLAY_SEEN_ID_LIMIT);
});
