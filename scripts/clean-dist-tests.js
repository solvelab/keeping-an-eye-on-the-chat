/**
 * Remove the compiled test output before rebuilding it.
 *
 * tsc only writes files; it never deletes stale ones. A renamed or deleted test
 * therefore keeps running from a previous build — which is worse than it sounds:
 * the same suite can execute twice (inflating the count) and a test that should
 * have disappeared can keep passing. Both were observed after a test file moved
 * between directories.
 */

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'dist-tests');

fs.rmSync(target, { recursive: true, force: true });
