/**
 * Configuration merge precedence: defaults -> saved -> env -> cli.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeConfig, diffFromDefaults, validateConfig } from '../../src/config/merge';
import { getDefaults } from '../../src/config/defaults';
import type { AppConfig } from '../../src/config/types';

const NO_ENV: Record<string, string | undefined> = {};

test('merge: falls back to schema defaults when nothing else is provided', () => {
  const { values, sources } = mergeConfig({ env: NO_ENV });

  assert.equal(values.displaySeconds, 5);
  assert.equal(values.overlayAnchor, 'bottom-left');
  assert.equal(values.twitchChatUrl, '');
  assert.equal(sources.displaySeconds, 'default');
});

test('merge: saved config overrides defaults', () => {
  const { values, sources } = mergeConfig({
    saved: { displaySeconds: 9 },
    env: NO_ENV,
  });

  assert.equal(values.displaySeconds, 9);
  assert.equal(sources.displaySeconds, 'saved');
  assert.equal(sources.overlayMargin, 'default');
});

test('merge: env overrides saved config', () => {
  const { values, sources } = mergeConfig({
    saved: { displaySeconds: 9 },
    env: { DISPLAY_SECONDS: '12' },
  });

  assert.equal(values.displaySeconds, 12);
  assert.equal(sources.displaySeconds, 'env');
});

test('merge: cli overrides env', () => {
  const { values, sources } = mergeConfig({
    saved: { displaySeconds: 9 },
    env: { DISPLAY_SECONDS: '12' },
    cli: { displaySeconds: 3 },
  });

  assert.equal(values.displaySeconds, 3);
  assert.equal(sources.displaySeconds, 'cli');
});

test('merge: an unparseable numeric env value is ignored, not applied as NaN', () => {
  const { values, sources } = mergeConfig({
    saved: { displaySeconds: 9 },
    env: { DISPLAY_SECONDS: 'not-a-number' },
  });

  assert.equal(values.displaySeconds, 9);
  assert.equal(sources.displaySeconds, 'saved');
});

test('merge: an empty env value does not shadow the saved value', () => {
  const { values, sources } = mergeConfig({
    saved: { twitchChatUrl: 'https://www.twitch.tv/popout/x/chat' },
    env: { TWITCH_CHAT_URL: '' },
  });

  assert.equal(values.twitchChatUrl, 'https://www.twitch.tv/popout/x/chat');
  assert.equal(sources.twitchChatUrl, 'saved');
});

test('merge: boolean env values accept 1/true and reject anything else', () => {
  assert.equal(mergeConfig({ env: { DIAGNOSTICS: '1' } }).values.diagnostics, true);
  assert.equal(mergeConfig({ env: { DIAGNOSTICS: 'true' } }).values.diagnostics, true);
  assert.equal(mergeConfig({ env: { DIAGNOSTICS: 'TRUE' } }).values.diagnostics, true);
  assert.equal(mergeConfig({ env: { DIAGNOSTICS: '0' } }).values.diagnostics, false);
});

test('merge: string[] env values are split, trimmed and lowercased', () => {
  const { values } = mergeConfig({ env: { IGNORE_USERS: ' NightBot , streamElements ,, ' } });

  assert.deepEqual(values.ignoreUsers, ['nightbot', 'streamelements']);
});

test('merge: every schema key is present in the merged result', () => {
  const defaults = getDefaults();
  const { values } = mergeConfig({ env: NO_ENV });

  for (const key of Object.keys(defaults) as (keyof AppConfig)[]) {
    assert.ok(key in values, `missing key in merged config: ${key}`);
  }
});

test('diffFromDefaults: returns only the values that differ', () => {
  const config = { ...getDefaults(), displaySeconds: 8 };
  const diff = diffFromDefaults(config);

  assert.deepEqual(diff, { displaySeconds: 8 });
});

test('diffFromDefaults: compares arrays by content, not by reference', () => {
  const untouched = { ...getDefaults(), ignoreUsers: [] as string[] };
  assert.deepEqual(diffFromDefaults(untouched), {});

  const changed = { ...getDefaults(), ignoreUsers: ['nightbot'] };
  assert.deepEqual(diffFromDefaults(changed), { ignoreUsers: ['nightbot'] });
});

test('diffFromDefaults: an all-default config produces an empty diff', () => {
  assert.deepEqual(diffFromDefaults(getDefaults()), {});
});

test('validateConfig: defaults are invalid only because the URL is required', () => {
  const errors = validateConfig(getDefaults());

  assert.deepEqual(Object.keys(errors), ['twitchChatUrl']);
});
