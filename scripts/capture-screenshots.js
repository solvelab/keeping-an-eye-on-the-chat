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
 */

const fs = require('fs');
const path = require('path');
// Imported rather than taken from the global scope: this file is linted with the
// repository's Node script rules, which do not expose browser-style timers.
const { setTimeout: sleep } = require('node:timers/promises');
const { setTimeout: scheduleTimeout } = require('node:timers');
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

/** The overlay showing a message, for the README's preview section. */
const captureOverlay = async () => {
  const win = new BrowserWindow({
    show: true,
    width: 900,
    height: 320,
    transparent: true,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(ROOT, 'dist', 'preload', 'index.js'),
    },
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('set-config', { ...SAMPLE_CONFIG, displaySeconds: 60, attentionPauseMs: 0 });
  });

  await win.loadFile(path.join(ROOT, 'dist', 'renderer', 'index.html'), { query: { debug: '0' } });
  await settle(1600);

  win.webContents.send('chat-message', {
    id: 'screenshot-1',
    platform: 'twitch',
    user: 'poppybdo',
    text: 'boa jogada! esse boss é osso',
    timestamp: Date.now(),
  });
  await settle(2200);

  write('configuration-03.png', await win.webContents.capturePage());
  win.destroy();
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
  await captureWizard();
  await captureOverlay();

  console.log('\nconfiguration-02.png (the tray menu) is not captured here:');
  console.log('it is drawn by the operating system, outside the app\'s windows.');
  console.log('Take that one by hand after right-clicking the tray icon.');
  app.exit(0);
});

scheduleTimeout(() => {
  console.error('Timed out while capturing.');
  process.exit(2);
}, 120000);
