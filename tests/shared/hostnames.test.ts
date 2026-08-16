/**
 * Hostname suffix matching shared by the chat source and the connection test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ERR_ABORTED,
  SUPPRESSED_DOMAIN_SUFFIXES,
  TWITCH_DOMAIN_SUFFIXES,
  getHostname,
  hostnameMatches,
  isSuppressedUrl,
  isTwitchUrl,
} from '../../src/shared/hostnames';

test('getHostname: lowercases the host', () => {
  assert.equal(getHostname('https://WWW.Twitch.TV/popout/x/chat'), 'www.twitch.tv');
});

test('getHostname: returns an empty string for non-URLs', () => {
  assert.equal(getHostname(''), '');
  assert.equal(getHostname('not a url'), '');
  assert.equal(getHostname('/relative/path'), '');
});

test('hostnameMatches: matches the domain itself and its subdomains', () => {
  assert.equal(hostnameMatches('twitch.tv', TWITCH_DOMAIN_SUFFIXES), true);
  assert.equal(hostnameMatches('www.twitch.tv', TWITCH_DOMAIN_SUFFIXES), true);
  assert.equal(hostnameMatches('static-cdn.jtvnw.net', TWITCH_DOMAIN_SUFFIXES), true);
});

test('hostnameMatches: is a suffix match, not a substring match', () => {
  // The whole point of the helper: these all contain "twitch.tv" as a substring.
  assert.equal(hostnameMatches('twitch.tv.attacker.example', TWITCH_DOMAIN_SUFFIXES), false);
  assert.equal(hostnameMatches('nottwitch.tv', TWITCH_DOMAIN_SUFFIXES), false);
  assert.equal(hostnameMatches('faketwitch.tv.evil.io', TWITCH_DOMAIN_SUFFIXES), false);
});

test('isTwitchUrl: accepts real Twitch URLs and rejects lookalikes', () => {
  assert.equal(isTwitchUrl('https://www.twitch.tv/popout/x/chat'), true);
  assert.equal(isTwitchUrl('https://twitch.tv/popout/x/chat'), true);
  assert.equal(isTwitchUrl('https://twitch.tv.attacker.example/popout/x/chat'), false);
  assert.equal(isTwitchUrl('https://youtube.com/live_chat'), false);
  assert.equal(isTwitchUrl('garbage'), false);
});

test('isSuppressedUrl: recognizes the known ad and telemetry domains', () => {
  assert.equal(isSuppressedUrl('https://securepubads.g.doubleclick.net/tag/js/gpt.js'), true);
  assert.equal(isSuppressedUrl('https://www.google-analytics.com/collect'), true);
  assert.equal(isSuppressedUrl('https://www.twitch.tv/popout/x/chat'), false);
});

test('suffix lists contain no leading dots (the matcher adds them)', () => {
  for (const suffix of [...TWITCH_DOMAIN_SUFFIXES, ...SUPPRESSED_DOMAIN_SUFFIXES]) {
    assert.equal(suffix.startsWith('.'), false, `suffix should not start with a dot: ${suffix}`);
  }
});

test('ERR_ABORTED is Chromium net::ERR_ABORTED', () => {
  assert.equal(ERR_ABORTED, -3);
});

test('schema: the Twitch URL validator rejects lookalike hosts', async () => {
  const { CONFIG_SCHEMA } = await import('../../src/config/schema');
  const validate = CONFIG_SCHEMA.twitchChatUrl.validate!;

  assert.equal(validate('https://www.twitch.tv/popout/x/chat?popout='), null);
  assert.equal(validate('https://twitch.tv/popout/x/chat'), null);

  // Substring matching used to accept all of these.
  assert.equal(validate('https://twitch.tv.attacker.example/popout/x/chat'), 'URL must be from twitch.tv');
  assert.equal(validate('https://nottwitch.tv/popout/x/chat'), 'URL must be from twitch.tv');
  assert.equal(validate('https://evil.io/?q=twitch.tv/popout/x/chat'), 'URL must be from twitch.tv');
});
