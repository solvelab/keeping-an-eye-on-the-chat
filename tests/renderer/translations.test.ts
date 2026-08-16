/**
 * The wizard's language tables.
 *
 * They now live in JSON so a wording fix never means editing TypeScript, which
 * also means nothing type-checks them. These tests are what replaces that: every
 * key the wizard asks for must exist, in both languages.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { CONFIG_SCHEMA } from '../../src/config/schema';

const LOCALES_DIR = path.join(process.cwd(), 'src', 'renderer', 'config', 'locales');
const SCRIPTS_DIR = path.join(process.cwd(), 'src', 'renderer', 'config', 'scripts');

/** Read a language table straight from its JSON file. */
function locale(language: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${language}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

/** The wizard's own source, where translation keys are referenced. */
function wizardSource(): string {
  return ['configApp.ts', 'configForm.ts']
    .map((file) => fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8'))
    .join('\n');
}

const LANGUAGES = ['en', 'pt'];

test('every shipped language file parses and is non-empty', () => {
  for (const language of LANGUAGES) {
    const table = locale(language);
    assert.ok(Object.keys(table).length > 0, `${language} is empty`);
    for (const [key, value] of Object.entries(table)) {
      assert.equal(typeof value, 'string', `${language}.${key} is not a string`);
      assert.notEqual(value.trim(), '', `${language}.${key} is blank`);
    }
  }
});

test('the languages carry exactly the same keys', () => {
  const [en, pt] = LANGUAGES.map((language) => Object.keys(locale(language)).sort());

  assert.deepEqual(pt, en, 'the two language files have drifted apart');
});

test('every literal translation key the wizard uses exists', () => {
  const source = wizardSource();
  const en = locale('en');

  // `this.t.someKey`
  const used = new Set([...source.matchAll(/\bthis\.t\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));

  assert.ok(used.size > 20, `expected many keys, found ${used.size}`);
  for (const key of used) {
    assert.ok(key in en, `the wizard uses this.t.${key} but no locale declares it`);
  }
});

test('every rendered field has a label and a description in both languages', () => {
  // getFieldLabel / getFieldDesc build `field<Key>` and `field<Key>Desc`.
  // A missing entry silently renders the raw key name in the UI.
  const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

  for (const language of LANGUAGES) {
    const table = locale(language);

    for (const key of Object.keys(CONFIG_SCHEMA)) {
      if (key === 'language') continue; // handled by the flag toggle, never rendered
      assert.ok(`field${capitalize(key)}` in table, `${language} is missing field${capitalize(key)}`);
      assert.ok(
        `field${capitalize(key)}Desc` in table,
        `${language} is missing field${capitalize(key)}Desc`
      );
    }
  }
});

test('every preset has a translated name and description', () => {
  const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const presetKeys = ['presetDefault', 'presetFastPaced', 'presetCozy'];

  for (const language of LANGUAGES) {
    const table = locale(language);
    for (const key of presetKeys) {
      assert.ok(key in table, `${language} is missing ${key}`);
      assert.ok(`${key}Desc` in table, `${language} is missing ${key}Desc`);
    }
  }
  assert.equal(capitalize('x'), 'X');
});

test('every overlay anchor option has a translated label', () => {
  const anchors = ['anchorBottomLeft', 'anchorBottomRight', 'anchorTopLeft', 'anchorTopRight'];

  for (const language of LANGUAGES) {
    const table = locale(language);
    for (const key of anchors) {
      assert.ok(key in table, `${language} is missing ${key}`);
    }
  }
});

test('the translations are no longer declared inside the controller', () => {
  // The point of the extraction: a wording fix must not require editing TypeScript.
  const controller = fs.readFileSync(path.join(SCRIPTS_DIR, 'configApp.ts'), 'utf-8');

  assert.ok(
    !controller.includes("appTitle: 'Keeping an Eye on the Chat'"),
    'the English table is still inline in configApp.ts'
  );
  assert.ok(
    !controller.includes("appTitle: 'De Olho no Chat'"),
    'the Portuguese table is still inline in configApp.ts'
  );
  assert.ok(
    controller.includes('window.configTranslations'),
    'the controller should read the generated bundle'
  );
});
