/**
 * Test connection to a Twitch chat URL.
 * Uses a hidden webview to verify the URL is accessible.
 */

import { BrowserWindow } from 'electron';
import { ERR_ABORTED, isSuppressedUrl } from './hostnames';
import type { ConnectionTestResult } from '../config/types';

const TEST_TIMEOUT_MS = 10000;

/**
 * A `did-fail-load` event as Electron reports it.
 */
export interface LoadFailure {
  /** Chromium net error code. */
  errorCode: number;
  /** Whether the failure came from the top-level navigation. */
  isMainFrame: boolean;
  /** URL that failed. */
  validatedURL: string;
}

/**
 * Decide whether a load failure means the *connection test* failed.
 *
 * A Twitch popout page embeds third-party frames, and every one of their
 * failures reaches `did-fail-load` too. Treating them as failures — which is
 * what this function replaces — reported a broken connection for a page that
 * had loaded perfectly well, and sent users off troubleshooting a working
 * configuration.
 *
 * Only the top-level navigation counts, and a cancelled one does not count at
 * all.
 */
export function shouldReportLoadFailure(failure: LoadFailure): boolean {
  if (failure.errorCode === ERR_ABORTED) {
    return false;
  }

  if (!failure.isMainFrame) {
    return false;
  }

  // Belt and braces: a main-frame navigation should never land on an ad domain,
  // but if it somehow does, that is not the user's chat URL failing.
  if (isSuppressedUrl(failure.validatedURL)) {
    return false;
  }

  return true;
}

/**
 * Whether a `loadURL` rejection is just a superseded navigation.
 *
 * Electron surfaces these as `Error: ERR_ABORTED (-3) loading '<url>'`, with
 * `errno` set to the net error code.
 */
export function isAbortedNavigation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { errno?: number; code?: string; message?: string };

  return (
    candidate.errno === ERR_ABORTED ||
    candidate.code === 'ERR_ABORTED' ||
    (typeof candidate.message === 'string' && candidate.message.includes('ERR_ABORTED'))
  );
}

/**
 * Test if a Twitch chat URL is accessible.
 * Creates a hidden window, loads the URL, and checks for success or failure.
 */
export async function testTwitchConnection(
  url: string,
  diagnostics = false
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  // Validate URL format first
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('twitch.tv')) {
      return { success: false, error: 'URL must be from twitch.tv', latencyMs: null };
    }
  } catch {
    return { success: false, error: 'Invalid URL format', latencyMs: null };
  }

  return new Promise((resolve) => {
    let testWindow: BrowserWindow | null = null;
    let resolved = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (testWindow && !testWindow.isDestroyed()) {
        testWindow.close();
      }
      testWindow = null;
    };

    const finish = (result: ConnectionTestResult): void => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };

    try {
      testWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      timeoutId = setTimeout(() => {
        if (diagnostics) {
          console.info('[TestConnection] Timeout after', TEST_TIMEOUT_MS, 'ms');
        }
        finish({ success: false, error: 'Connection timed out', latencyMs: null });
      }, TEST_TIMEOUT_MS);

      testWindow.webContents.on('did-finish-load', () => {
        const latencyMs = Date.now() - startTime;
        if (diagnostics) {
          console.info(`[TestConnection] Success in ${latencyMs}ms`);
        }
        finish({ success: true, error: null, latencyMs });
      });

      testWindow.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (!shouldReportLoadFailure({ errorCode, isMainFrame, validatedURL })) {
            if (diagnostics) {
              console.info(
                `[TestConnection] Ignoring load failure: ${errorDescription} ` +
                  `(code: ${errorCode}, mainFrame: ${isMainFrame}, url: ${validatedURL})`
              );
            }
            return;
          }

          if (diagnostics) {
            console.info(`[TestConnection] Failed: ${errorDescription} (code: ${errorCode})`);
          }
          finish({ success: false, error: errorDescription || 'Failed to load', latencyMs: null });
        }
      );

      testWindow.loadURL(url).catch((err: Error) => {
        // loadURL rejects with ERR_ABORTED whenever a navigation is superseded
        // (Twitch redirects on load), which is not a connection failure.
        if (isAbortedNavigation(err)) {
          if (diagnostics) {
            console.info('[TestConnection] Ignoring aborted navigation:', err.message);
          }
          return;
        }

        if (diagnostics) {
          console.info('[TestConnection] Load error:', err.message);
        }
        finish({ success: false, error: err.message, latencyMs: null });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (diagnostics) {
        console.info('[TestConnection] Exception:', message);
      }
      finish({ success: false, error: message, latencyMs: null });
    }
  });
}
