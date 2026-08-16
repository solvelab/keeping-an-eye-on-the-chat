/**
 * The supported platforms and how a URL is attributed to one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PLATFORMS, PLATFORM_LABELS, isPlatform } from '../../src/shared/platforms';
// URL attribution lives with the domain lists, in hostnames.
import {
  PLATFORM_DOMAIN_SUFFIXES,
  isUrlForPlatform,
  platformOfUrl,
} from '../../src/shared/hostnames';

const TWITCH_URL = 'https://www.twitch.tv/popout/somebody/chat?popout=';
const KICK_URL = 'https://kick.com/popout/somebody/chat';

test('every platform has a label and a domain list', () => {
  for (const platform of PLATFORMS) {
    assert.ok(PLATFORM_LABELS[platform], `no label for ${platform}`);
    assert.ok(PLATFORM_DOMAIN_SUFFIXES[platform].length > 0, `no domains for ${platform}`);
  }
});

test('isPlatform accepts the supported ids and nothing else', () => {
  assert.equal(isPlatform('twitch'), true);
  assert.equal(isPlatform('kick'), true);
  assert.equal(isPlatform('youtube'), false);
  assert.equal(isPlatform(''), false);
  assert.equal(isPlatform(undefined), false);
  assert.equal(isPlatform(42), false);
});

test('platformOfUrl attributes a URL to its platform', () => {
  assert.equal(platformOfUrl(TWITCH_URL), 'twitch');
  assert.equal(platformOfUrl(KICK_URL), 'kick');
});

test('platformOfUrl returns null for a URL belonging to nobody', () => {
  assert.equal(platformOfUrl('https://youtube.com/live_chat'), null);
  assert.equal(platformOfUrl('not a url'), null);
  assert.equal(platformOfUrl(''), null);
});

test('lookalike hosts belong to no platform', () => {
  // Suffix matching, never substring. This is the defect that was fixed once
  // and must not come back as each platform is added.
  assert.equal(platformOfUrl('https://twitch.tv.attacker.example/popout/x/chat'), null);
  assert.equal(platformOfUrl('https://kick.com.attacker.example/popout/x/chat'), null);
  assert.equal(platformOfUrl('https://nottwitch.tv/popout/x/chat'), null);
  assert.equal(platformOfUrl('https://notkick.com/popout/x/chat'), null);
  assert.equal(platformOfUrl('https://evil.example/?q=kick.com/popout/x/chat'), null);
});

test('a platform does not claim another platform URL', () => {
  assert.equal(isUrlForPlatform(TWITCH_URL, 'kick'), false);
  assert.equal(isUrlForPlatform(KICK_URL, 'twitch'), false);
  assert.equal(isUrlForPlatform(TWITCH_URL, 'twitch'), true);
  assert.equal(isUrlForPlatform(KICK_URL, 'kick'), true);
});

test('platform CDN subdomains are attributed to their platform', () => {
  assert.equal(platformOfUrl('https://static-cdn.jtvnw.net/badge.png'), 'twitch');
  assert.equal(platformOfUrl('https://files.kick.com/emote.png'), 'kick');
});

test('no domain suffix is claimed by two platforms', () => {
  const seen = new Map<string, string>();
  for (const platform of PLATFORMS) {
    for (const suffix of PLATFORM_DOMAIN_SUFFIXES[platform]) {
      const owner = seen.get(suffix);
      assert.equal(owner, undefined, `${suffix} claimed by both ${owner} and ${platform}`);
      seen.set(suffix, platform);
    }
  }
});
