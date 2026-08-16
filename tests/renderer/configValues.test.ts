/**
 * Coercion of raw form values into the types the schema declares.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { coerceFieldValue, isNumericSelect } from '../../src/renderer/config/scripts/configValues';
import { CONFIG_SCHEMA } from '../../src/config/schema';
import { resolveTargetDisplay } from '../../src/shared/displays';
import type { AppConfig } from '../../src/config/types';

test('coerce: number fields become numbers', () => {
  assert.equal(coerceFieldValue(CONFIG_SCHEMA.displaySeconds, '8'), 8);
  assert.equal(coerceFieldValue(CONFIG_SCHEMA.overlayMargin, '0'), 0);
});

test('coerce: an emptied number field becomes 0 so the validator reports it', () => {
  const value = coerceFieldValue(CONFIG_SCHEMA.displaySeconds, '');

  assert.equal(value, 0);
  assert.notEqual(CONFIG_SCHEMA.displaySeconds.validate!(value), null);
});

test('coerce: a malformed number field becomes NaN so the validator reports it', () => {
  const value = coerceFieldValue(CONFIG_SCHEMA.displaySeconds, 'abc');

  assert.ok(Number.isNaN(value));
  assert.notEqual(CONFIG_SCHEMA.displaySeconds.validate!(value as never), null);
});

test('coerce: a numeric select falls back to its schema default when unparseable', () => {
  assert.equal(coerceFieldValue(CONFIG_SCHEMA.displayId, 'nonsense'), 0);
});

test('coerce: displayId is a numeric select and becomes a number', () => {
  // The regression: a <select> hands back a string, and the main process
  // compares it with === against Display.id, which is a number.
  const value = coerceFieldValue(CONFIG_SCHEMA.displayId, '2528732444');

  assert.equal(typeof value, 'number');
  assert.equal(value, 2528732444);
});

test('coerce: string selects stay strings', () => {
  assert.equal(coerceFieldValue(CONFIG_SCHEMA.overlayAnchor, 'top-right'), 'top-right');
  assert.equal(coerceFieldValue(CONFIG_SCHEMA.language, 'pt'), 'pt');
});

test('coerce: string[] fields are split, trimmed and lowercased', () => {
  assert.deepEqual(coerceFieldValue(CONFIG_SCHEMA.ignoreUsers, ' NightBot , streamElements ,, '), [
    'nightbot',
    'streamelements',
  ]);
});

test('coerce: plain string fields pass through unchanged', () => {
  const url = 'https://www.twitch.tv/popout/someone/chat?popout=';

  assert.equal(coerceFieldValue(CONFIG_SCHEMA.twitchChatUrl, url), url);
});

test('isNumericSelect: only displayId qualifies in the current schema', () => {
  const numeric = Object.values(CONFIG_SCHEMA)
    .filter((field) => isNumericSelect(field))
    .map((field) => field.key);

  assert.deepEqual(numeric, ['displayId']);
});

test('regression: the typed path that displayId broke', () => {
  // The wizard used to hold its configuration as Record<string, any>, so storing
  // a <select> string into a field typed `number` was invisible to tsc. The
  // config object is typed now, and this pins the coercion that goes with it.
  const config: Partial<AppConfig> = {};
  const raw = '2528732444'; // what the DOM hands back

  const coerced = coerceFieldValue(CONFIG_SCHEMA.displayId, raw);
  (config as Record<string, unknown>).displayId = coerced;

  assert.equal(typeof config.displayId, 'number');
  assert.equal(config.displayId, 2528732444);

  // And the main process finds it, which is what actually broke.
  assert.equal(
    resolveTargetDisplay([{ id: 1 }, { id: 2528732444 }], config.displayId, { id: 1 }).id,
    2528732444
  );
});
