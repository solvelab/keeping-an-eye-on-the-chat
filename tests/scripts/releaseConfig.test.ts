/**
 * The release configuration must understand this repository's commit style.
 *
 * Commits here are gitmoji + Conventional Commits (`🐛 fix(scope): …`). The
 * preset's default header pattern anchors the type at the start of the subject,
 * so a leading emoji makes the header unparseable and the commit invisible to
 * the analyzer. Every commit in the house style silently cut no release.
 *
 * These tests read the pattern out of `.releaserc.json` rather than restating
 * it, so removing `parserOpts` fails them.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

interface ParserOpts {
  headerPattern: string;
  headerCorrespondence: string[];
}

/** The release configuration as it actually ships. */
function releaserc(): { plugins: unknown[] } {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.releaserc.json'), 'utf-8')
  ) as { plugins: unknown[] };
}

/** The parserOpts a given plugin is configured with, if any. */
function parserOptsFor(pluginName: string): ParserOpts | undefined {
  for (const plugin of releaserc().plugins) {
    if (!Array.isArray(plugin)) continue;
    const [name, options] = plugin as [string, { parserOpts?: ParserOpts } | undefined];
    if (name === pluginName) return options?.parserOpts;
  }
  return undefined;
}

/** The type a header parses to under the configured pattern. */
function parseType(header: string, opts: ParserOpts): string | undefined {
  const match = new RegExp(opts.headerPattern).exec(header);
  if (!match) return undefined;
  const index = opts.headerCorrespondence.indexOf('type');
  return match[index + 1];
}

/** The scope a header parses to under the configured pattern. */
function parseScope(header: string, opts: ParserOpts): string | undefined {
  const match = new RegExp(opts.headerPattern).exec(header);
  if (!match) return undefined;
  const index = opts.headerCorrespondence.indexOf('scope');
  return match[index + 1];
}

const ANALYZER = '@semantic-release/commit-analyzer';
const NOTES = '@semantic-release/release-notes-generator';

test('both release plugins declare parserOpts', () => {
  // Configuring only the analyzer cuts a release whose notes are empty.
  assert.ok(parserOptsFor(ANALYZER), `${ANALYZER} has no parserOpts`);
  assert.ok(parserOptsFor(NOTES), `${NOTES} has no parserOpts`);
});

test('both plugins use the same pattern', () => {
  assert.deepEqual(parserOptsFor(ANALYZER), parserOptsFor(NOTES));
});

test('headerCorrespondence names the captured groups', () => {
  const opts = parserOptsFor(ANALYZER)!;

  assert.deepEqual(opts.headerCorrespondence, ['type', 'scope', 'subject']);
});

test('gitmoji-prefixed commits are typed', () => {
  const opts = parserOptsFor(ANALYZER)!;

  assert.equal(parseType('🐛 fix(config): store displayId as a number', opts), 'fix');
  assert.equal(parseType('✨ feat(overlay): add a thing', opts), 'feat');
  assert.equal(parseType('⚡ perf(overlay): bound the caches', opts), 'perf');
  assert.equal(parseType('♻️ refactor: move things around', opts), 'refactor');
  assert.equal(parseType('👷 ci(lint): make the lint job lint', opts), 'ci');
});

test('the scope survives the emoji prefix', () => {
  const opts = parserOptsFor(ANALYZER)!;

  assert.equal(parseScope('🐛 fix(config): x', opts), 'config');
  assert.equal(parseScope('🐛 fix: x', opts), undefined);
});

test('commits without an emoji still parse exactly as before', () => {
  const opts = parserOptsFor(ANALYZER)!;

  assert.equal(parseType('fix: add Windows icon support', opts), 'fix');
  assert.equal(parseType('feat(config): add a thing', opts), 'feat');
  assert.equal(parseType('chore(release): 2.0.0 [skip ci]', opts), 'chore');
});

test('the breaking marker still parses', () => {
  const opts = parserOptsFor(ANALYZER)!;

  assert.equal(parseType('✨ feat(config)!: drop the legacy format', opts), 'feat');
  assert.equal(parseType('feat!: drop the legacy format', opts), 'feat');
});

test('a non-conventional subject stays unparsed', () => {
  const opts = parserOptsFor(ANALYZER)!;

  assert.equal(parseType('just some words', opts), undefined);
  assert.equal(parseType('Merge pull request #37 from backlog/x', opts), undefined);
});

test("this repository's own recent commits are typed", () => {
  // The regression that motivated this: real commits, not fixtures.
  const opts = parserOptsFor(ANALYZER)!;
  const subjects = execFileSync('git', ['log', '--no-merges', '--format=%s', '-40'], {
    encoding: 'utf-8',
  })
    .split('\n')
    .filter((line) => line.trim() !== '');

  const gitmoji = subjects.filter((s) => /^[^\w\s]+\s+\w+(\(.*\))?!?: /.test(s));
  assert.ok(gitmoji.length >= 5, `expected gitmoji commits in history, found ${gitmoji.length}`);

  for (const subject of gitmoji) {
    const type = parseType(subject, opts);
    assert.ok(type, `not typed by the configured pattern: ${subject}`);
    assert.match(type, /^[a-z]+$/, `odd type "${type}" from: ${subject}`);
  }
});

test('a releasing type is recognised in at least one real commit', () => {
  const opts = parserOptsFor(ANALYZER)!;
  const subjects = execFileSync('git', ['log', '--no-merges', '--format=%s', '-40'], {
    encoding: 'utf-8',
  }).split('\n');

  const releasing = subjects
    .map((s) => parseType(s, opts))
    .filter((t) => t === 'fix' || t === 'feat' || t === 'perf');

  assert.ok(releasing.length > 0, 'no fix/feat/perf commit was recognised in the last 40 commits');
});
