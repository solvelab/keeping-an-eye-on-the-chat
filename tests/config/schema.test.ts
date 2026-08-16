/**
 * Per-field validation rules declared in the configuration schema.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG_SCHEMA, CONFIG_SECTIONS } from '../../src/config/schema';
import { validateConfig } from '../../src/config/merge';
import { getDefaults } from '../../src/config/defaults';
import type { AppConfig } from '../../src/config/types';

/** Validate a single field through its schema validator. */
function check(key: keyof AppConfig, value: unknown): string | null {
  const field = CONFIG_SCHEMA[key];
  assert.ok(field.validate, `field ${key} has no validator`);
  return field.validate(value as never);
}

/** Build a full config that only differs from defaults on the given key. */
function withValue(key: keyof AppConfig, value: unknown): AppConfig {
  return { ...getDefaults(), twitchChatUrl: 'https://www.twitch.tv/popout/x/chat', [key]: value };
}

test('schema: every field belongs to a declared section', () => {
  for (const [key, field] of Object.entries(CONFIG_SCHEMA)) {
    assert.ok(
      CONFIG_SECTIONS.includes(field.section),
      `field ${key} has unknown section ${field.section}`
    );
  }
});

test('schema: every field key matches its record key', () => {
  for (const [key, field] of Object.entries(CONFIG_SCHEMA)) {
    assert.equal(field.key, key);
  }
});

test('twitchChatUrl: accepts popout and chat URLs on twitch.tv', () => {
  assert.equal(check('twitchChatUrl', 'https://www.twitch.tv/popout/somebody/chat?popout='), null);
  assert.equal(check('twitchChatUrl', 'https://twitch.tv/popout/somebody/chat'), null);
});

test('twitchChatUrl: rejects malformed and non-twitch URLs', () => {
  assert.notEqual(check('twitchChatUrl', 'not a url'), null);
  assert.notEqual(check('twitchChatUrl', 'https://youtube.com/live_chat'), null);
});

test('twitchChatUrl: an empty value is not a per-field error', () => {
  // Emptiness is decided across both platform URLs, so the field itself
  // accepts blank; validateConfig reports it when both are blank.
  assert.equal(check('twitchChatUrl', ''), null);
  assert.equal(check('twitchChatUrl', '   '), null);
});

test('kickChatUrl: accepts a Kick popout URL', () => {
  assert.equal(check('kickChatUrl', 'https://kick.com/popout/somebody/chat'), null);
  assert.equal(check('kickChatUrl', 'https://kick.com/somebody/chat'), null);
});

test('kickChatUrl: rejects lookalike hosts and other platforms', () => {
  assert.equal(check('kickChatUrl', 'https://kick.com.attacker.example/popout/x/chat'), 'URL must be from kick.com');
  assert.equal(check('kickChatUrl', 'https://notkick.com/popout/x/chat'), 'URL must be from kick.com');
  assert.equal(check('kickChatUrl', 'https://www.twitch.tv/popout/x/chat'), 'URL must be from kick.com');
  assert.notEqual(check('kickChatUrl', 'not a url'), null);
});

test('kickChatUrl: rejects a Kick URL that is not a chat page', () => {
  assert.notEqual(check('kickChatUrl', 'https://kick.com/somebody'), null);
});

test('twitchChatUrl: rejects a twitch.tv URL that is not a chat page', () => {
  assert.notEqual(check('twitchChatUrl', 'https://www.twitch.tv/somebody'), null);
});

test('displaySeconds: accepts 1..60 and rejects outside the range', () => {
  assert.equal(check('displaySeconds', 1), null);
  assert.equal(check('displaySeconds', 60), null);
  assert.notEqual(check('displaySeconds', 0), null);
  assert.notEqual(check('displaySeconds', 61), null);
  assert.notEqual(check('displaySeconds', Number.NaN), null);
});

test('overlayAnchor: accepts the four corners and rejects anything else', () => {
  for (const anchor of ['bottom-left', 'bottom-right', 'top-left', 'top-right']) {
    assert.equal(check('overlayAnchor', anchor), null);
  }
  assert.notEqual(check('overlayAnchor', 'center'), null);
});

test('overlayMargin: accepts 0..200', () => {
  assert.equal(check('overlayMargin', 0), null);
  assert.equal(check('overlayMargin', 200), null);
  assert.notEqual(check('overlayMargin', -1), null);
  assert.notEqual(check('overlayMargin', 201), null);
});

test('bubbleMaxWidth: accepts 120..800', () => {
  assert.equal(check('bubbleMaxWidth', 120), null);
  assert.equal(check('bubbleMaxWidth', 800), null);
  assert.notEqual(check('bubbleMaxWidth', 119), null);
  assert.notEqual(check('bubbleMaxWidth', 801), null);
});

test('maxMessageLength: accepts 10..500', () => {
  assert.equal(check('maxMessageLength', 10), null);
  assert.equal(check('maxMessageLength', 500), null);
  assert.notEqual(check('maxMessageLength', 9), null);
  assert.notEqual(check('maxMessageLength', 501), null);
});

test('maxQueueLength: accepts 1..500', () => {
  assert.equal(check('maxQueueLength', 1), null);
  assert.equal(check('maxQueueLength', 500), null);
  assert.notEqual(check('maxQueueLength', 0), null);
  assert.notEqual(check('maxQueueLength', 501), null);
});

test('exitAnimationMs: accepts 0..2000', () => {
  assert.equal(check('exitAnimationMs', 0), null);
  assert.equal(check('exitAnimationMs', 2000), null);
  assert.notEqual(check('exitAnimationMs', -1), null);
  assert.notEqual(check('exitAnimationMs', 2001), null);
});

test('attentionPauseMs: accepts 0..3000', () => {
  assert.equal(check('attentionPauseMs', 0), null);
  assert.equal(check('attentionPauseMs', 3000), null);
  assert.notEqual(check('attentionPauseMs', -1), null);
  assert.notEqual(check('attentionPauseMs', 3001), null);
});

test('notificationSoundVolume: accepts 0..100', () => {
  assert.equal(check('notificationSoundVolume', 0), null);
  assert.equal(check('notificationSoundVolume', 100), null);
  assert.notEqual(check('notificationSoundVolume', -1), null);
  assert.notEqual(check('notificationSoundVolume', 101), null);
});

test('validateConfig: reports the offending field and nothing else', () => {
  const errors = validateConfig(withValue('displaySeconds', 999));

  assert.deepEqual(Object.keys(errors), ['displaySeconds']);
});

test('validateConfig: a fully valid config yields no errors', () => {
  const errors = validateConfig(withValue('displaySeconds', 5));

  assert.deepEqual(errors, {});
});

test('validateConfig: empty optional fields are skipped, not reported', () => {
  const errors = validateConfig(withValue('notificationSoundFile', ''));

  assert.deepEqual(errors, {});
});
