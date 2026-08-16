/**
 * Guard against prose that accidentally declares a breaking change.
 *
 * `conventional-commits-parser` matches note keywords **case-insensitively at
 * the start of a line**, and does not require the trailing colon. So a wrapped
 * sentence like
 *
 *     electron-builder renamed the artifact to EyeOnChat in v1.0.0 (recorded as a
 *     breaking change in the changelog), but the launchers ...
 *
 * is read as a `BREAKING CHANGE` footer whose text is "in the changelog), but
 * the launchers ...". That shipped v2.0.0 instead of v1.2.0, with release notes
 * made of a sentence fragment and no Bug Fixes section at all.
 *
 * A real breaking change is written as the exact marker, uppercase and with a
 * colon: `BREAKING CHANGE: <what breaks>`. Anything else that starts a line with
 * those words is a mistake.
 */

const { execFileSync } = require('child_process');

/** The only spellings that legitimately declare a breaking change. */
const MARKER = /^(?:BREAKING CHANGE|BREAKING-CHANGE):\s*\S/;

/** What the parser will pick up, regardless of case or punctuation. */
const LOOSE = /^\s*breaking[ -]change\b/i;

/**
 * Find lines in a commit message that the changelog parser would read as a
 * breaking-change note but that are not the deliberate marker.
 *
 * The subject line is skipped: notes are only parsed from the body, and a
 * deliberate breaking subject uses the `type!:` form instead.
 *
 * @param {string} message full commit message, subject and body
 * @returns {{line: number, text: string}[]} one entry per offending line
 */
function findAccidentalNotes(message) {
  if (typeof message !== 'string' || message === '') {
    return [];
  }

  const lines = message.split(/\r?\n/);
  const problems = [];

  // Start at 1: index 0 is the subject.
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!LOOSE.test(line)) continue;
    if (MARKER.test(line)) continue;
    problems.push({ line: i + 1, text: line.trim() });
  }

  return problems;
}

/** Whether a commit message declares a breaking change on purpose. */
function hasDeliberateMarker(message) {
  if (typeof message !== 'string') return false;
  return message.split(/\r?\n/).slice(1).some((line) => MARKER.test(line));
}

/** Read `<sha>\x00<message>` records for a git range. */
function readCommits(range) {
  const args = ['log', '--no-merges', '--format=%H%x00%B%x1e'];
  if (range) args.push(range);
  const out = execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });

  return out
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [sha, ...rest] = record.split('\x00');
      return { sha: sha.trim(), message: rest.join('\x00').trim() };
    });
}

/** Whether a git range can be resolved in this checkout. */
function rangeIsUsable(range) {
  if (!range) return false;
  try {
    execFileSync('git', ['rev-list', '--max-count=1', range], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const requested = process.argv[2];
  let range = requested;

  if (requested && !rangeIsUsable(requested)) {
    console.warn(
      `Range "${requested}" is not resolvable in this checkout; ` +
        'falling back to the most recent commit.'
    );
    range = undefined;
  }

  const commits = range ? readCommits(range) : readCommits('HEAD~1..HEAD');
  const offenders = [];

  for (const commit of commits) {
    const problems = findAccidentalNotes(commit.message);
    if (problems.length > 0) {
      offenders.push({ ...commit, problems });
    }
  }

  if (offenders.length > 0) {
    console.error('Accidental BREAKING CHANGE note in a commit message:\n');
    for (const commit of offenders) {
      const subject = commit.message.split('\n')[0];
      console.error(`  ${commit.sha.slice(0, 8)}  ${subject}`);
      for (const problem of commit.problems) {
        console.error(`    line ${problem.line}: ${problem.text}`);
      }
      console.error('');
    }
    console.error(
      'The changelog parser reads a line starting with "breaking change" as a\n' +
        'BREAKING CHANGE footer, in any case and with or without a colon. That\n' +
        'forces a major release and mangles the release notes.\n\n' +
        'Reword the sentence so those words do not start a line, or — if the change\n' +
        'really is breaking — use the exact marker:\n\n' +
        '    BREAKING CHANGE: <what breaks and what to do about it>\n'
    );
    process.exit(1);
  }

  console.log(`Commit notes check passed: ${commits.length} commit(s) inspected.`);
}

module.exports = { findAccidentalNotes, hasDeliberateMarker, MARKER, LOOSE };

if (require.main === module) {
  main();
}
