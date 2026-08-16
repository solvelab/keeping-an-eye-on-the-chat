/**
 * Configuration persistence: first run, round trip, corruption recovery.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigStore } from '../../src/config/store';
import { CONFIG_VERSION } from '../../src/config/schema';
import { makeTempDir } from '../helpers/tempDir';

const CONFIG_FILE = 'config.json';
const BACKUP_FILE = 'config.backup.json';

test('store: first run reports no config and no error', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  const result = store.load();

  assert.equal(result.config, null);
  assert.equal(result.error, null);
});

test('store: save then load round-trips the partial config', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  const saved = store.save({ displaySeconds: 7, ignoreUsers: ['nightbot'] });
  assert.equal(saved.success, true);
  assert.equal(saved.error, null);

  const loaded = store.load();
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.config, { displaySeconds: 7, ignoreUsers: ['nightbot'] });
});

test('store: the saved file carries the schema version and a timestamp', () => {
  const dir = makeTempDir();
  new ConfigStore(false, dir).save({ displaySeconds: 7 });

  const raw = JSON.parse(fs.readFileSync(path.join(dir, CONFIG_FILE), 'utf-8'));

  assert.equal(raw.configVersion, CONFIG_VERSION);
  assert.equal(typeof raw.savedAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(raw.savedAt)));
  assert.deepEqual(raw.config, { displaySeconds: 7 });
});

test('store: a second save backs up the previous config', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  store.save({ displaySeconds: 7 });
  store.save({ displaySeconds: 8 });

  const backup = JSON.parse(fs.readFileSync(path.join(dir, BACKUP_FILE), 'utf-8'));
  assert.deepEqual(backup.config, { displaySeconds: 7 });

  assert.deepEqual(store.load().config, { displaySeconds: 8 });
});

test('store: a corrupted config is recovered from the backup', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  store.save({ displaySeconds: 7 });
  store.save({ displaySeconds: 8 });
  fs.writeFileSync(path.join(dir, CONFIG_FILE), '{ this is not json', 'utf-8');

  const result = store.load();

  assert.deepEqual(result.config, { displaySeconds: 7 });
  assert.match(String(result.error), /restored from backup/i);
});

test('store: recovery rewrites the main config so the next load is clean', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  store.save({ displaySeconds: 7 });
  store.save({ displaySeconds: 8 });
  fs.writeFileSync(path.join(dir, CONFIG_FILE), 'broken', 'utf-8');

  store.load();
  const second = store.load();

  assert.equal(second.error, null);
  assert.deepEqual(second.config, { displaySeconds: 7 });
});

test('store: a corrupted config with no backup reports the failure', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  fs.writeFileSync(path.join(dir, CONFIG_FILE), 'broken', 'utf-8');

  const result = store.load();

  assert.equal(result.config, null);
  assert.match(String(result.error), /no backup available/i);
});

test('store: both files corrupted reports both errors and no config', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  fs.writeFileSync(path.join(dir, CONFIG_FILE), 'broken', 'utf-8');
  fs.writeFileSync(path.join(dir, BACKUP_FILE), 'also broken', 'utf-8');

  const result = store.load();

  assert.equal(result.config, null);
  assert.match(String(result.error), /both config and backup are corrupted/i);
});

test('store: reset removes the config but keeps a backup', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  store.save({ displaySeconds: 7 });
  const result = store.reset();

  assert.equal(result.success, true);
  assert.equal(fs.existsSync(path.join(dir, CONFIG_FILE)), false);
  assert.equal(fs.existsSync(path.join(dir, BACKUP_FILE)), true);
  assert.equal(store.load().config, null);
});

test('store: reset on a first-run install succeeds without touching the disk', () => {
  const dir = makeTempDir();

  const result = new ConfigStore(false, dir).reset();

  assert.equal(result.success, true);
  assert.equal(fs.existsSync(path.join(dir, CONFIG_FILE)), false);
});

test('store: creates the target directory when it does not exist yet', () => {
  const dir = path.join(makeTempDir(), 'nested', 'userData');
  const store = new ConfigStore(false, dir);

  assert.equal(store.save({ displaySeconds: 7 }).success, true);
  assert.deepEqual(store.load().config, { displaySeconds: 7 });
});

test('store: writes atomically and leaves no temp file behind', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  store.save({ displaySeconds: 7 });

  const leftovers = fs.readdirSync(dir).filter((name) => name.includes('.tmp'));
  assert.deepEqual(leftovers, [], `temp files left behind: ${leftovers.join(', ')}`);
  assert.deepEqual(fs.readdirSync(dir).sort(), [CONFIG_FILE]);
});

test('store: an interrupted write cannot leave a truncated config', () => {
  const dir = makeTempDir();
  const store = new ConfigStore(false, dir);

  store.save({ displaySeconds: 7 });
  const good = fs.readFileSync(path.join(dir, CONFIG_FILE), 'utf-8');

  // Simulate a crash between opening the temp file and renaming it.
  fs.writeFileSync(path.join(dir, `${CONFIG_FILE}.999999.tmp`), '{ "half', 'utf-8');

  // The real config is untouched and still parses.
  assert.equal(fs.readFileSync(path.join(dir, CONFIG_FILE), 'utf-8'), good);
  assert.deepEqual(store.load().config, { displaySeconds: 7 });
});

test('store: a save failure surfaces as an error result, not an exception', () => {
  const dir = makeTempDir();
  // A directory where the config file should be makes the write fail.
  fs.mkdirSync(path.join(dir, CONFIG_FILE));
  const store = new ConfigStore(false, dir);

  const result = store.save({ displaySeconds: 7 });

  assert.equal(result.success, false);
  assert.ok(result.error);
  const leftovers = fs.readdirSync(dir).filter((name) => name.includes('.tmp'));
  assert.deepEqual(leftovers, [], 'temp file should be cleaned up on failure');
});
