#!/usr/bin/env node
/**
 * Regenerate the screenshots README embeds.
 *
 *   npx electron scripts/capture-screenshots.js
 *
 * Run it on the platform the app is used on. The images went stale because
 * retaking them was a manual chore nobody remembered after a UI change; this
 * makes it one command.
 *
 * Two caveats, both measured rather than assumed:
 *
 *   - **Run it on Windows or macOS, not WSL.** Under WSL the language toggle's
 *     flag emoji render as missing-glyph boxes, so the captured image is worse
 *     than the one it replaces.
 *   - **The tray menu cannot be captured this way.** `configuration-02.png` is
 *     an operating-system menu drawn outside the app's windows, beyond
 *     `webContents.capturePage()`. That one stays a manual screenshot.
 *
 * The animated overlay preview is the exception to the first caveat: the overlay
 * draws no emoji, so it renders correctly everywhere, WSL included. It needs
 * `ffmpeg` on PATH to encode; nothing else here does.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');
// Imported rather than taken from the global scope: this file is linted with the
// repository's Node script rules, which do not expose browser-style timers.
const { setTimeout: sleep } = require('node:timers/promises');
const { setTimeout: scheduleTimeout, setInterval: scheduleInterval, clearInterval } = require('node:timers');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'printscreen');

/** A configuration that shows the wizard with everything worth showing. */
const SAMPLE_CONFIG = {
  twitchChatUrl: 'https://www.twitch.tv/popout/yourname/chat?popout=',
  kickChatUrl: 'https://kick.com/popout/yourname/chat',
  displaySeconds: 5,
  overlayAnchor: 'bottom-left',
  overlayMargin: 24,
  bubbleMaxWidth: 420,
  authorStyle: 'subtle',
  maxMessageLength: 140,
  ignoreCommandPrefix: '!',
  ignoreUsers: [],
  maxQueueLength: 50,
  exitAnimationMs: 400,
  attentionPauseMs: 500,
  diagnostics: false,
  notificationSoundEnabled: true,
  notificationSoundFile: '',
  notificationSoundVolume: 50,
  notificationSoundDevice: '',
};

const settle = (ms) => sleep(ms);

const write = (name, image) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, image.toPNG());
  const { width, height } = image.getSize();
  console.log(`  wrote ${name}  ${width}x${height}`);
};

/** The configuration wizard, with both platforms filled in and the preview visible. */
const captureWizard = async () => {
  const win = new BrowserWindow({
    show: false,
    width: 640,
    height: 1180,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(ROOT, 'dist', 'preload', 'configPreload.js'),
    },
  });

  await win.loadFile(path.join(ROOT, 'dist', 'renderer', 'config', 'index.html'));
  await settle(3500);

  // Fill the URLs the way a streamer would, so the preview shows a platform badge.
  await win.webContents.executeJavaScript(`(() => {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('input-twitchChatUrl', ${JSON.stringify(SAMPLE_CONFIG.twitchChatUrl)});
    set('input-kickChatUrl', ${JSON.stringify(SAMPLE_CONFIG.kickChatUrl)});
    return true;
  })()`);
  await settle(800);

  write('configuration-01.png', await win.webContents.capturePage());
  win.destroy();
};

/**
 * The message sequence the animated preview plays.
 *
 * Written to read like a real chat rather than filler: different people, both
 * platforms, and the mix a live actually gets — someone arriving and greeting,
 * questions aimed at the streamer, a reaction to what is happening in the game,
 * and a request about the stream itself.
 *
 * Two platforms so the badge and its colour both appear, and enough messages for
 * one to replace another on screen. A still can show none of this.
 */
const PREVIEW_SCRIPT = [
  { platform: 'twitch', user: 'luanapx', text: 'boa noite! o que cê tá jogando hoje?' },
  { platform: 'kick', user: 'caiozin', text: 'cheguei agora, tá difícil essa fase?' },
  { platform: 'twitch', user: 'mari_alves', text: 'esse chefe eu passei de primeira ontem kkkk' },
  { platform: 'kick', user: 'pedrohsz', text: 'sobe o volume do jogo aí, tá baixinho' },
];

/** Frames per second for the animated preview. Measured: capture sustains this with room to spare. */
const PREVIEW_FPS = 12;

/**
 * Timing for the preview.
 *
 * A message occupies the bubble for longer than its display timer: entrance,
 * then the attention pause before the avatar speaks, then the timer, then the
 * exit. Sending faster than that only queues messages, and the recording ends
 * with some of them never shown.
 *
 * The two figures below are **measured**, not derived from the configuration.
 * Adding them up gave 3900 ms and the last message still fell off the end; timing
 * the real overlay gave 4338 ms for the first message and 3930 ms for each one
 * after it. Keep the sequence short enough that every message fits, and verify
 * by watching the encoded GIF rather than by trusting this arithmetic.
 */
const PREVIEW_DISPLAY_MS = 2600;
const PREVIEW_ATTENTION_MS = 500;
const PREVIEW_EXIT_MS = 400;
/** Measured: the first message takes longer, the rest settle into a steady cycle. */
const PREVIEW_FIRST_MS = 4400;
const PREVIEW_CYCLE_MS = 3950;
const PREVIEW_MS =
  PREVIEW_FIRST_MS + (PREVIEW_SCRIPT.length - 1) * PREVIEW_CYCLE_MS + PREVIEW_DISPLAY_MS + 400;

/** Encode the captured frames into the GIF the README embeds. */
const encodeGif = (frameDir, output) => {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      'ffmpeg is required to encode the animated preview and was not found on PATH. ' +
        'Install it (https://ffmpeg.org/download.html) and run this again. ' +
        'The still screenshots do not need it.'
    );
  }

  const pattern = path.join(frameDir, 'frame-%04d.png');
  const palette = path.join(frameDir, 'palette.png');

  // Two passes: a palette built from the whole clip, then the encode that uses
  // it. One pass would quantise each frame on its own and the avatar would
  // shimmer between them.
  const paletteRun = spawnSync('ffmpeg', [
    '-y', '-framerate', String(PREVIEW_FPS), '-i', pattern,
    '-vf', `fps=${PREVIEW_FPS},scale=560:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff`,
    palette, '-loglevel', 'error',
  ], { encoding: 'utf8' });
  if (paletteRun.status !== 0) {
    throw new Error(`ffmpeg failed while building the palette: ${paletteRun.stderr}`);
  }

  const encodeRun = spawnSync('ffmpeg', [
    '-y', '-framerate', String(PREVIEW_FPS), '-i', pattern, '-i', palette,
    '-lavfi',
    `fps=${PREVIEW_FPS},scale=560:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    '-loop', '0', output, '-loglevel', 'error',
  ], { encoding: 'utf8' });
  if (encodeRun.status !== 0) {
    throw new Error(`ffmpeg failed while encoding the GIF: ${encodeRun.stderr}`);
  }
};

/**
 * The overlay in motion, for the README's preview section.
 *
 * The window is sized to the overlay rather than to a screen: the preview should
 * be the bubble and the avatar, not a field of empty backdrop around them.
 */
const captureOverlayAnimation = async () => {
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeonchat-frames-'));

  const win = new BrowserWindow({
    show: true,
    width: 720,
    height: 132,
    // Opaque on purpose: a transparent GIF over GitHub's page would show the
    // bubble floating on whatever theme the reader uses. This stands in for the
    // stream behind the overlay.
    transparent: false,
    backgroundColor: '#123048',
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(ROOT, 'dist', 'preload', 'index.js'),
    },
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('set-config', {
      ...SAMPLE_CONFIG,
      displaySeconds: PREVIEW_DISPLAY_MS / 1000,
      overlayMargin: 12,
      attentionPauseMs: PREVIEW_ATTENTION_MS,
      exitAnimationMs: PREVIEW_EXIT_MS,
    });
  });

  await win.loadFile(path.join(ROOT, 'dist', 'renderer', 'index.html'), { query: { debug: '0' } });
  await settle(1500);

  let sent = 0;
  const sendNext = () => {
    if (sent >= PREVIEW_SCRIPT.length) return;
    win.webContents.send('chat-message', {
      id: `preview-${sent}`,
      ...PREVIEW_SCRIPT[sent],
      timestamp: Date.now(),
    });
    sent += 1;
  };

  sendNext();
  const nextMessage = scheduleInterval(sendNext, PREVIEW_CYCLE_MS);

  const started = Date.now();
  const budgetMs = 1000 / PREVIEW_FPS;
  let frame = 0;

  while (Date.now() - started < PREVIEW_MS) {
    const frameStart = Date.now();
    const image = await win.webContents.capturePage();
    fs.writeFileSync(
      path.join(frameDir, `frame-${String(frame).padStart(4, '0')}.png`),
      image.toPNG()
    );
    frame += 1;
    const remaining = budgetMs - (Date.now() - frameStart);
    if (remaining > 0) await settle(remaining);
  }

  clearInterval(nextMessage);
  win.destroy();

  const output = path.join(OUT, 'overlay-preview.gif');
  try {
    encodeGif(frameDir, output);
    const { size } = fs.statSync(output);
    console.log(`  wrote overlay-preview.gif  ${frame} frames, ${Math.round(size / 1024)} KB`);
  } finally {
    fs.rmSync(frameDir, { recursive: true, force: true });
  }
};

// Closing a window between captures would otherwise quit before the next one.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'renderer', 'config', 'index.html'))) {
    console.error('dist/ is missing. Run `npm run build:ts` first.');
    app.exit(1);
    return;
  }

  require(path.join(ROOT, 'dist', 'main', 'ipcHandlers.js')).setupConfigIPC(false);
  void ipcMain;

  console.log('Capturing screenshots into printscreen/ ...');

  try {
    await captureWizard();
    await captureOverlayAnimation();
  } catch (error) {
    // Without this the failure surfaces as an unhandled rejection and the
    // process hangs until the watchdog fires — a wall of noise around the one
    // line that matters.
    console.error(`\n${error.message}`);
    app.exit(1);
    return;
  }

  console.log('\nconfiguration-02.png (the tray menu) is not captured here:');
  console.log('it is drawn by the operating system, outside the app\'s windows.');
  console.log('Take that one by hand after right-clicking the tray icon.');
  app.exit(0);
});

scheduleTimeout(() => {
  console.error('Timed out while capturing.');
  process.exit(2);
}, 120000);
