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

test('validateConfig: defaults are invalid because no platform URL is set', () => {
  // Neither URL is required on its own; the app just needs one of them.
  const errors = validateConfig(getDefaults());

  assert.deepEqual(Object.keys(errors).sort(), ['kickChatUrl', 'twitchChatUrl']);
  assert.match(String(errors.twitchChatUrl), /Twitch or a Kick/);
});

test('validateConfig: a Twitch URL alone is a complete configuration', () => {
  const config = { ...getDefaults(), twitchChatUrl: 'https://www.twitch.tv/popout/x/chat' };

  assert.deepEqual(validateConfig(config), {});
});

test('validateConfig: a Kick URL alone is a complete configuration', () => {
  const config = { ...getDefaults(), kickChatUrl: 'https://kick.com/popout/x/chat' };

  assert.deepEqual(validateConfig(config), {});
});

test('validateConfig: both platforms configured together is valid', () => {
  const config = {
    ...getDefaults(),
    twitchChatUrl: 'https://www.twitch.tv/popout/x/chat',
    kickChatUrl: 'https://kick.com/popout/x/chat',
  };

  assert.deepEqual(validateConfig(config), {});
});

test('validateConfig: whitespace does not count as a configured URL', () => {
  const config = { ...getDefaults(), twitchChatUrl: '   ', kickChatUrl: '' };

  assert.deepEqual(Object.keys(validateConfig(config)).sort(), ['kickChatUrl', 'twitchChatUrl']);
});

/**
 * Upgrade path.
 *
 * A config written by a Twitch-only version has no `kickChatUrl` key at all.
 * It must keep working untouched: the user upgrades and the overlay still
 * starts, with Kick simply not configured.
 */
test('merge: a config saved before Kick existed still loads and validates', () => {
  const savedByOldVersion = {
    twitchChatUrl: 'https://www.twitch.tv/popout/somebody/chat?popout=',
    displaySeconds: 7,
    overlayAnchor: 'top-right' as const,
  };

  const { values, sources } = mergeConfig({ saved: savedByOldVersion, env: NO_ENV });

  assert.equal(values.twitchChatUrl, 'https://www.twitch.tv/popout/somebody/chat?popout=');
  assert.equal(sources.twitchChatUrl, 'saved');
  assert.equal(values.kickChatUrl, '', 'the new field defaults to empty rather than undefined');
  assert.deepEqual(validateConfig(values), {}, 'an old config must not become invalid');
});

test('merge: TWITCH_CHAT_URL keeps working, and KICK_CHAT_URL joins it', () => {
  const { values, sources } = mergeConfig({
    env: {
      TWITCH_CHAT_URL: 'https://www.twitch.tv/popout/somebody/chat',
      KICK_CHAT_URL: 'https://kick.com/popout/somebody/chat',
    },
  });

  assert.equal(values.twitchChatUrl, 'https://www.twitch.tv/popout/somebody/chat');
  assert.equal(values.kickChatUrl, 'https://kick.com/popout/somebody/chat');
  assert.equal(sources.twitchChatUrl, 'env');
  assert.equal(sources.kickChatUrl, 'env');
  assert.deepEqual(validateConfig(values), {});
});
