/**
 * Resolution of the monitor the overlay is created on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDisplayId, resolveTargetDisplay } from '../../src/shared/displays';

const PRIMARY = { id: 1 };
const SECOND = { id: 2528732444 };
const DISPLAYS = [PRIMARY, SECOND];

test('normalizeDisplayId: passes finite numbers through', () => {
  assert.equal(normalizeDisplayId(0), 0);
  assert.equal(normalizeDisplayId(2528732444), 2528732444);
});

test('normalizeDisplayId: parses the numeric strings written by older versions', () => {
  assert.equal(normalizeDisplayId('2528732444'), 2528732444);
  assert.equal(normalizeDisplayId(' 42 '), 42);
});

test('normalizeDisplayId: falls back to 0 for anything unusable', () => {
  assert.equal(normalizeDisplayId(undefined), 0);
  assert.equal(normalizeDisplayId(null), 0);
  assert.equal(normalizeDisplayId(''), 0);
  assert.equal(normalizeDisplayId('   '), 0);
  assert.equal(normalizeDisplayId('primary'), 0);
  assert.equal(normalizeDisplayId(Number.NaN), 0);
  assert.equal(normalizeDisplayId({}), 0);
});

test('resolveTargetDisplay: finds the configured monitor by numeric id', () => {
  assert.equal(resolveTargetDisplay(DISPLAYS, 2528732444, PRIMARY), SECOND);
});

test('resolveTargetDisplay: finds the configured monitor from a legacy string id', () => {
  // This is the exact value the buggy wizard persisted.
  assert.equal(resolveTargetDisplay(DISPLAYS, '2528732444', PRIMARY), SECOND);
});

test('resolveTargetDisplay: 0 means the primary display', () => {
  assert.equal(resolveTargetDisplay(DISPLAYS, 0, PRIMARY), PRIMARY);
  assert.equal(resolveTargetDisplay(DISPLAYS, '0', PRIMARY), PRIMARY);
});

test('resolveTargetDisplay: a disconnected monitor falls back to the primary display', () => {
  assert.equal(resolveTargetDisplay(DISPLAYS, 999999, PRIMARY), PRIMARY);
});

test('resolveTargetDisplay: unusable values fall back to the primary display', () => {
  assert.equal(resolveTargetDisplay(DISPLAYS, undefined, PRIMARY), PRIMARY);
  assert.equal(resolveTargetDisplay(DISPLAYS, 'nonsense', PRIMARY), PRIMARY);
});

test('resolveTargetDisplay: an empty display list still returns the primary', () => {
  assert.equal(resolveTargetDisplay([], 5, PRIMARY), PRIMARY);
});
