/**
 * Test runner.
 *
 * Collects the compiled test files under dist-tests/ and hands them to Node's
 * built-in test runner. Done in JS instead of a shell glob because `**` is not
 * portable across shells, and `node --test <dir>` only walks directories on
 * newer Node versions.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TESTS_ROOT = path.join(__dirname, '..', 'dist-tests', 'tests');

/** Recursively collect every compiled test file. */
function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTestFiles(full));
    } else if (entry.name.endsWith('.test.js')) {
      found.push(full);
    }
  }
  return found.sort();
}

const files = collectTestFiles(TESTS_ROOT);

if (files.length === 0) {
  console.error(`No compiled tests found in ${TESTS_ROOT}. Run "npm run build:test" first.`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
