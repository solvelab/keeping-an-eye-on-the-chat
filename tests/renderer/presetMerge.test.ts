/**
 * Applying a preset must change only what the preset declares.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { mergePresetConfig } from '../../src/renderer/config/scripts/configValues';
import { getDefaults, getPreset, PRESETS, PRESET_KEYS } from '../../src/config/defaults';
import { CONFIG_SCHEMA } from '../../src/config/schema';
import type { AppConfig } from '../../src/config/types';

/** A config the user has already filled in. */
function userConfig(): AppConfig {
  return {
    ...getDefaults(),
    twitchChatUrl: 'https://www.twitch.tv/popout/someone/chat?popout=',
    language: 'pt',
    displayId: 2528732444,
    overlayAnchor: 'top-right',
    overlayMargin: 60,
    ignoreUsers: ['nightbot'],
    notificationSoundFile: '/home/me/alert.mp3',
    notificationSoundVolume: 80,
    notificationSoundDevice: 'device-123',
  };
}

test('preset: the Twitch URL survives every shipped preset', () => {
  for (const preset of PRESETS) {
    const merged = mergePresetConfig(userConfig(), preset.config);

    assert.equal(
      merged.twitchChatUrl,
      'https://www.twitch.tv/popout/someone/chat?popout=',
      `preset ${preset.id} wiped the Twitch URL`
    );
  }
});

test('preset: language and every unrelated setting survive', () => {
  const before = userConfig();

  for (const preset of PRESETS) {
    const merged = mergePresetConfig(before, preset.config);
    const declared = new Set(Object.keys(preset.config));

    for (const key of Object.keys(before) as (keyof AppConfig)[]) {
      if (declared.has(key)) continue;
      assert.deepEqual(
        merged[key],
        before[key],
        `preset ${preset.id} changed unrelated key ${key}`
      );
    }
  }
});

test('preset: sets exactly the keys it declares', () => {
  const cozy = getPreset('cozy')!;
  const merged = mergePresetConfig(userConfig(), cozy.config);

  for (const [key, value] of Object.entries(cozy.config)) {
    assert.deepEqual(merged[key as keyof AppConfig], value, `preset value not applied for ${key}`);
  }

  assert.equal(merged.displaySeconds, 8);
  assert.equal(merged.maxQueueLength, 20);
  assert.equal(merged.maxMessageLength, 200);
});

test('preset: "default" restores the stock timing and nothing else', () => {
  const before = { ...userConfig(), displaySeconds: 8, maxQueueLength: 20, attentionPauseMs: 1500 };
  const merged = mergePresetConfig(before, getPreset('default')!.config);

  // The timing goes back to the schema values...
  for (const key of PRESET_KEYS) {
    assert.deepEqual(merged[key], CONFIG_SCHEMA[key].default, `default preset did not restore ${key}`);
  }

  // ...and everything the user owns is untouched.
  assert.equal(merged.twitchChatUrl, before.twitchChatUrl);
  assert.equal(merged.language, 'pt');
  assert.equal(merged.displayId, 2528732444);
  assert.equal(merged.notificationSoundFile, '/home/me/alert.mp3');
});

test('preset: every preset declares exactly the same keys', () => {
  // The catalog is a set of complete timing profiles, not partial nudges.
  const expected = [...PRESET_KEYS].sort();

  for (const preset of PRESETS) {
    assert.deepEqual(Object.keys(preset.config).sort(), expected, `preset ${preset.id}`);
  }
});

test('preset: "default" is read from the schema, not written out again', () => {
  const preset = getPreset('default')!.config as Record<string, unknown>;

  for (const key of PRESET_KEYS) {
    assert.equal(preset[key], CONFIG_SCHEMA[key].default, key);
  }
});

test('preset: applying "default" after another preset returns to stock timing', () => {
  const user = userConfig();
  const cozy = mergePresetConfig(user, getPreset('cozy')!.config);
  const back = mergePresetConfig(cozy, getPreset('default')!.config);

  assert.equal(cozy.displaySeconds, 8);
  assert.equal(back.displaySeconds, CONFIG_SCHEMA.displaySeconds.default);
  assert.equal(back.twitchChatUrl, user.twitchChatUrl);
});

test('preset: switching presets is not cumulative on unrelated keys', () => {
  const before = userConfig();
  const fast = mergePresetConfig(before, getPreset('fast-chat')!.config);
  const cozy = mergePresetConfig(fast, getPreset('cozy')!.config);

  assert.equal(cozy.displaySeconds, 8);
  assert.equal(cozy.twitchChatUrl, before.twitchChatUrl);
  assert.equal(cozy.language, 'pt');
});

test('mergePresetConfig: returns a copy, never the same object', () => {
  const before = userConfig();
  const merged = mergePresetConfig(before, { displaySeconds: 3 });

  assert.notEqual(merged, before);
  assert.equal(before.displaySeconds, 5);
});

test('mergePresetConfig: tolerates a missing preset payload', () => {
  const before = userConfig();

  assert.deepEqual(mergePresetConfig(before, undefined), before);
  assert.deepEqual(mergePresetConfig(before, null), before);
});
