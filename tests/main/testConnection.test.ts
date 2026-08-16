/**
 * Which load failures the connection test is allowed to report.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isAbortedNavigation, shouldReportLoadFailure } from '../../src/main/testConnection';

const MAIN_URL = 'https://www.twitch.tv/popout/someone/chat?popout=';

test('reports a genuine main-frame failure', () => {
  assert.equal(
    shouldReportLoadFailure({ errorCode: -105, isMainFrame: true, validatedURL: MAIN_URL }),
    true
  );
});

test('ignores a subframe failure', () => {
  // The regression: a Twitch popout embeds third-party frames, and one of them
  // failing used to report "Connection failed" for a page that loaded fine.
  assert.equal(
    shouldReportLoadFailure({
      errorCode: -105,
      isMainFrame: false,
      validatedURL: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
    }),
    false
  );
});

test('ignores a subframe failure even on a Twitch domain', () => {
  assert.equal(
    shouldReportLoadFailure({
      errorCode: -2,
      isMainFrame: false,
      validatedURL: 'https://static-cdn.jtvnw.net/badges/x.png',
    }),
    false
  );
});

test('ignores ERR_ABORTED on the main frame', () => {
  // -3 is emitted routinely for superseded navigations.
  assert.equal(
    shouldReportLoadFailure({ errorCode: -3, isMainFrame: true, validatedURL: MAIN_URL }),
    false
  );
});

test('ignores a main-frame failure that landed on a suppressed ad domain', () => {
  assert.equal(
    shouldReportLoadFailure({
      errorCode: -105,
      isMainFrame: true,
      validatedURL: 'https://oneadtag.com/whatever',
    }),
    false
  );
});

test('reports DNS and offline failures of the requested URL', () => {
  for (const errorCode of [-105 /* NAME_NOT_RESOLVED */, -106 /* INTERNET_DISCONNECTED */, -21]) {
    assert.equal(
      shouldReportLoadFailure({ errorCode, isMainFrame: true, validatedURL: MAIN_URL }),
      true,
      `errorCode ${errorCode} should be reported`
    );
  }
});

test('isAbortedNavigation: recognizes the shapes Electron produces', () => {
  assert.equal(isAbortedNavigation(Object.assign(new Error('x'), { errno: -3 })), true);
  assert.equal(isAbortedNavigation(Object.assign(new Error('x'), { code: 'ERR_ABORTED' })), true);
  assert.equal(
    isAbortedNavigation(new Error("ERR_ABORTED (-3) loading 'https://www.twitch.tv/'")),
    true
  );
});

test('isAbortedNavigation: leaves real errors alone', () => {
  assert.equal(isAbortedNavigation(new Error('ERR_NAME_NOT_RESOLVED (-105) loading ...')), false);
  assert.equal(isAbortedNavigation(Object.assign(new Error('x'), { errno: -105 })), false);
  assert.equal(isAbortedNavigation(null), false);
  assert.equal(isAbortedNavigation(undefined), false);
  assert.equal(isAbortedNavigation('ERR_ABORTED'), false);
});
