#!/usr/bin/env node
/**
 * Every source path quoted in the documentation must exist.
 *
 * `docs/FIRST_MESSAGE_FLOW.md` opens with a promise:
 *
 *   "Every path below is a real file in this repository. If a rename makes one
 *    of them wrong, this document is wrong — fix it in the same commit."
 *
 * Nothing enforced it, and the documentation drifted: files were added that no
 * tree mentioned, and a rename would have been caught by nobody. This is the
 * enforcement.
 *
 * It reads backtick-quoted paths out of the Markdown and checks them against the
 * filesystem. Generated output and deliberate placeholders are skipped, each for
 * a stated reason.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Documents whose paths are promises about this repository. */
const DOCS = [
  'README.md',
  'CONFIGURATION.md',
  'CONTRIBUTING.md',
  'CLAUDE.md',
  'docs/FIRST_MESSAGE_FLOW.md',
  'docs/AVATAR_QA.md',
  'openspec/project.md',
];

/** Directories that only exist after a build, so they cannot be checked here. */
const GENERATED_PREFIXES = ['dist/', 'dist-tests/', 'node_modules/', 'release/'];

/**
 * Names that are illustrative rather than real, each with the reason it is
 * allowed to be missing. A new entry here needs a reason, not just a name.
 */
const PLACEHOLDERS = new Map([
  ['src/shared/types/yourTypes.ts', 'CONTRIBUTING shows it as "← Add here"'],
]);

/** A backtick-quoted token that looks like a path into this repository. */
const PATH_PATTERN = /`((?:src|tests|scripts|docs|config|openspec)\/[A-Za-z0-9_\-./]+)`/g;

const isGenerated = (p) => GENERATED_PREFIXES.some((prefix) => p.startsWith(prefix));

const collect = () => {
  const found = new Map(); // path -> [{doc, line}]

  for (const doc of DOCS) {
    const absolute = path.join(ROOT, doc);
    if (!fs.existsSync(absolute)) {
      throw new Error(`documented file list is stale: ${doc} does not exist`);
    }

    const lines = fs.readFileSync(absolute, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(PATH_PATTERN)) {
        const quoted = match[1];
        if (!found.has(quoted)) {
          found.set(quoted, []);
        }
        found.get(quoted).push({ doc, line: index + 1 });
      }
    });
  }

  return found;
};

const main = () => {
  const found = collect();
  const missing = [];
  let checked = 0;
  let skipped = 0;

  for (const [quoted, sites] of found) {
    if (isGenerated(quoted) || PLACEHOLDERS.has(quoted)) {
      skipped += 1;
      continue;
    }

    checked += 1;
    // A trailing slash means a directory; without one, either is acceptable —
    // the documents name both files and folders.
    if (!fs.existsSync(path.join(ROOT, quoted.replace(/\/$/, '')))) {
      missing.push({ quoted, sites });
    }
  }

  if (missing.length > 0) {
    console.error('Documentation names paths that do not exist:\n');
    for (const { quoted, sites } of missing) {
      console.error(`  ${quoted}`);
      for (const site of sites) {
        console.error(`      ${site.doc}:${site.line}`);
      }
    }
    console.error(
      `\n${missing.length} missing of ${checked} checked. Either the path is wrong or the file was ` +
        'renamed without updating the documentation.'
    );
    process.exit(1);
  }

  console.log(
    `Documentation path check passed: ${checked} path(s) verified across ${DOCS.length} document(s)` +
      `${skipped > 0 ? `, ${skipped} generated or placeholder path(s) skipped` : ''}.`
  );
};

main();
