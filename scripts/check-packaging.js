/**
 * Guard against the packaging drift that shipped broken launchers once already.
 *
 * electron-builder names the Windows executable after `build.productName`. When
 * that was changed to "EyeOnChat" the batch files in packaging/windows kept
 * calling the old name, so every documented launch path failed. This check ties
 * the two together.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKAGING_DIR = path.join(ROOT, 'packaging', 'windows');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const productName = pkg.build && pkg.build.productName;

const problems = [];

if (!productName) {
  problems.push('package.json has no build.productName');
}

const expectedExe = `${productName}.exe`;

if (!fs.existsSync(PACKAGING_DIR)) {
  problems.push(`missing directory: ${path.relative(ROOT, PACKAGING_DIR)}`);
}

const batchFiles = fs.existsSync(PACKAGING_DIR)
  ? fs.readdirSync(PACKAGING_DIR).filter((name) => name.endsWith('.bat'))
  : [];

if (batchFiles.length === 0) {
  problems.push('no .bat launchers found in packaging/windows');
}

for (const name of batchFiles) {
  const file = path.join(PACKAGING_DIR, name);
  const text = fs.readFileSync(file, 'utf-8');
  const rel = path.relative(ROOT, file);

  // cmd.exe: `set "NAME=VALUE"` on lines that are not REM comments.
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^rem\b/i.test(trimmed) || trimmed.startsWith('::')) continue;
    const match = trimmed.match(/^set\s+"([^=]+)=(.*)"$/i);
    if (match) vars[match[1]] = match[2];
  }

  if (!('APP_EXE' in vars)) {
    problems.push(`${rel}: does not define APP_EXE`);
  } else if (vars.APP_EXE !== expectedExe) {
    problems.push(`${rel}: APP_EXE is "${vars.APP_EXE}" but build.productName implies "${expectedExe}"`);
  }

  // Any literal .exe outside the APP_EXE definition is drift waiting to happen.
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^rem\b/i.test(trimmed) || /^set\s+"APP_EXE=/i.test(trimmed)) continue;
    if (/\.exe\b/i.test(trimmed)) {
      problems.push(`${rel}: hardcoded executable name, use %APP_EXE% -> ${trimmed}`);
    }
  }
}

if (problems.length > 0) {
  console.error('Packaging check failed:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(`Packaging check passed: ${batchFiles.length} launcher(s) reference ${expectedExe}.`);
