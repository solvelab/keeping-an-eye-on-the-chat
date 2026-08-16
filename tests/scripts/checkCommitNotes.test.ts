/**
 * Detection of prose that the changelog parser would read as a breaking change.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// The guard is a plain CommonJS build script, like the other files in scripts/.
const { findAccidentalNotes, hasDeliberateMarker } = require('../../scripts/check-commit-notes');

/**
 * The exact commit body that released v2.0.0 instead of v1.2.0.
 * Reproduced verbatim, including the line wrapping that caused it.
 */
const OFFENDING = [
  '🐛 fix(packaging): launch EyeOnChat.exe from the Windows batch files',
  '',
  'electron-builder renamed the artifact to EyeOnChat in v1.0.0 (recorded as a',
  'breaking change in the changelog), but the launchers and CONFIGURATION.md kept',
  'calling "Keeping an Eye on the Chat.exe", which no release contains — so both',
  'batch files failed for anyone following the documented flow.',
].join('\n');

/** A change that really does break something. */
const DELIBERATE = [
  '✨ feat(config): drop the legacy sound path format',
  '',
  'A bare filename is no longer resolved against assets/sounds.',
  '',
  'BREAKING CHANGE: notificationSoundFile must now be an absolute path.',
  'Configs holding a bare filename fall back to the bundled default.',
].join('\n');

/** Nothing special. */
const ORDINARY = [
  '🐛 fix(overlay): contain failures in the display sequence',
  '',
  'A throwing callback left phase at showing forever, so the overlay died',
  'silently mid-stream while the queue filled up and dropped messages.',
].join('\n');

test('flags the commit body that actually caused the false major release', () => {
  const problems = findAccidentalNotes(OFFENDING);

  assert.equal(problems.length, 1);
  assert.equal(problems[0].line, 4);
  assert.match(problems[0].text, /^breaking change in the changelog\)/);
});

test('accepts a deliberate BREAKING CHANGE marker', () => {
  assert.deepEqual(findAccidentalNotes(DELIBERATE), []);
  assert.equal(hasDeliberateMarker(DELIBERATE), true);
});

test('accepts an ordinary commit message', () => {
  assert.deepEqual(findAccidentalNotes(ORDINARY), []);
  assert.equal(hasDeliberateMarker(ORDINARY), false);
});

test('accepts the hyphenated marker', () => {
  const message = ['fix: x', '', 'BREAKING-CHANGE: the config key was renamed.'].join('\n');

  assert.deepEqual(findAccidentalNotes(message), []);
  assert.equal(hasDeliberateMarker(message), true);
});

test('flags the marker written in the wrong case', () => {
  // The parser matches case-insensitively, so this still forces a major release
  // — but it reads as prose to a human, which is exactly the trap.
  for (const wrong of ['Breaking change: x', 'breaking-change: x', 'BREAKING Change: x']) {
    const problems = findAccidentalNotes(`fix: x\n\n${wrong}`);
    assert.equal(problems.length, 1, `should flag: ${wrong}`);
  }
});

test('flags the words at the start of a line even without a colon', () => {
  const message = ['fix: x', '', 'This was a', 'breaking change for anyone on Windows.'].join('\n');

  assert.equal(findAccidentalNotes(message).length, 1);
});

test('ignores the words mid-sentence, where the parser also ignores them', () => {
  const message = [
    'fix: x',
    '',
    'This was a breaking change for anyone on Windows, so the launcher was',
    'renamed. Not a breaking change for anyone else.',
  ].join('\n');

  assert.deepEqual(findAccidentalNotes(message), []);
});

test('ignores the subject line', () => {
  // Notes are parsed from the body; a deliberate breaking subject uses `type!:`.
  assert.deepEqual(findAccidentalNotes('breaking change in the launcher'), []);
});

test('tolerates leading whitespace, which the parser also tolerates', () => {
  assert.equal(findAccidentalNotes('fix: x\n\n  breaking change here').length, 1);
});

test('handles empty and non-string input without throwing', () => {
  assert.deepEqual(findAccidentalNotes(''), []);
  assert.deepEqual(findAccidentalNotes(undefined as unknown as string), []);
  assert.equal(hasDeliberateMarker(undefined as unknown as string), false);
});

test('a marker with no text after it is not a valid marker', () => {
  assert.equal(findAccidentalNotes('fix: x\n\nBREAKING CHANGE:').length, 1);
});
