/**
 * Notification sound lifecycle, including the tray's mute/unmute transitions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { NotificationSound } from '../../src/renderer/scripts/notificationSound';

/** Minimal stand-in for the browser's Audio element. */
class FakeAudio {
  static created: FakeAudio[] = [];

  src: string;
  volume = 1;
  currentTime = 0;
  playCount = 0;
  loadCount = 0;
  listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(src: string) {
    this.src = src;
    FakeAudio.created.push(this);
  }

  load(): void {
    this.loadCount += 1;
  }

  play(): Promise<void> {
    this.playCount += 1;
    return Promise.resolve();
  }

  addEventListener(event: string, handler: (event: unknown) => void): void {
    (this.listeners[event] ||= []).push(handler);
  }

  emit(event: string, payload?: unknown): void {
    for (const handler of this.listeners[event] || []) handler(payload);
  }
}

/** Install the stub and reset what previous tests recorded. */
function useFakeAudio(): typeof FakeAudio {
  FakeAudio.created = [];
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
  return FakeAudio;
}

const OPTIONS = { enabled: true, soundFile: '', volume: 50 };

test('constructor: loads the bundled default when no file is configured', () => {
  const audio = useFakeAudio();
  new NotificationSound({ ...OPTIONS });

  assert.equal(audio.created.length, 1);
  assert.equal(audio.created[0].src, './assets/sounds/notification.wav');
  assert.equal(audio.created[0].loadCount, 1);
});

test('constructor: applies the configured volume as a 0..1 ratio', () => {
  const audio = useFakeAudio();
  new NotificationSound({ ...OPTIONS, volume: 75 });

  assert.equal(audio.created[0].volume, 0.75);
});

test('constructor: clamps out-of-range volumes', () => {
  const audio = useFakeAudio();
  new NotificationSound({ ...OPTIONS, volume: 500 });
  new NotificationSound({ ...OPTIONS, volume: -20 });

  assert.equal(audio.created[0].volume, 1);
  assert.equal(audio.created[1].volume, 0);
});

test('constructor: loads nothing when sound starts disabled', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS, enabled: false });

  assert.equal(audio.created.length, 0);
  assert.equal(sound.isReady(), false);
});

test('constructor: refuses a file with an unsupported extension', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS, soundFile: '/home/me/notes.txt' });

  assert.equal(audio.created.length, 0);
  assert.equal(sound.isReady(), false);
});

test('play: restarts the clip from the beginning', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS });

  audio.created[0].currentTime = 1.5;
  sound.play();

  assert.equal(audio.created[0].playCount, 1);
  assert.equal(audio.created[0].currentTime, 0);
});

test('play: stays silent while muted, and resumes after unmuting', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS });

  sound.setEnabled(false);
  sound.play();
  assert.equal(audio.created[0].playCount, 0);

  sound.setEnabled(true);
  sound.play();
  assert.equal(audio.created[0].playCount, 1);
});

test('setEnabled: unmuting an overlay that started with sound off loads the clip', () => {
  // The overlay is created with sound disabled, then the tray unmutes it. Before
  // the fix no audio element existed, so play() was a no-op forever.
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS, enabled: false });

  assert.equal(sound.isReady(), false);

  sound.setEnabled(true);

  assert.equal(audio.created.length, 1);
  assert.equal(sound.isReady(), true);

  sound.play();
  assert.equal(audio.created[0].playCount, 1);
});

test('setEnabled: unmuting does not reload an already loaded clip', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS });

  sound.setEnabled(false);
  sound.setEnabled(true);
  sound.setEnabled(true);

  assert.equal(audio.created.length, 1);
});

test('setEnabled: unmuting keeps the configured file, not the default', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({
    ...OPTIONS,
    enabled: false,
    soundFile: '/home/me/alert.mp3',
  });

  sound.setEnabled(true);

  assert.equal(audio.created[0].src, 'file:///home/me/alert.mp3');
});

test('setVolume: updates the live element', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS });

  sound.setVolume(10);

  assert.equal(audio.created[0].volume, 0.1);
});

test('a failed load disables playback instead of throwing', () => {
  const audio = useFakeAudio();
  const sound = new NotificationSound({ ...OPTIONS });

  audio.created[0].emit('error', new Error('missing file'));

  assert.equal(sound.isReady(), false);
  sound.play();
  assert.equal(audio.created[0].playCount, 0);
});
