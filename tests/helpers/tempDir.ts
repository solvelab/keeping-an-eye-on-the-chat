/**
 * Test helper: disposable temporary directories.
 */

import { after } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const created: string[] = [];

/**
 * Create a unique temporary directory. Every directory created here is removed
 * after the test file finishes, so tests never leak state onto the machine.
 */
export function makeTempDir(prefix = 'eyeonchat-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

/**
 * Remove a temporary directory created by {@link makeTempDir}.
 */
export function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

after(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (!dir) {
      continue;
    }
    try {
      removeTempDir(dir);
    } catch {
      // Best-effort cleanup.
    }
  }
});
