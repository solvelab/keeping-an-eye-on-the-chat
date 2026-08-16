/**
 * Defaults derived from the schema, and the shipped presets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaults, getPreset, PRESETS, applyPreset } from '../../src/config/defaults';
import { CONFIG_SCHEMA } from '../../src/config/schema';
import type { AppConfig } from '../../src/config/types';

test('getDefaults: mirrors every schema default', () => {
  const defaults = getDefaults() as unknown as Record<string, unknown>;

  for (const [key, field] of Object.entries(CONFIG_SCHEMA)) {
    assert.deepEqual(defaults[key], field.default, `default mismatch for ${key}`);
  }
});

test('getDefaults: returns a fresh object each call', () => {
  const a = getDefaults();
  const b = getDefaults();

  assert.notEqual(a, b);
  a.displaySeconds = 42;
  assert.equal(b.displaySeconds, 5);
});

test('presets: every preset has a unique id and only declares known keys', () => {
  const ids = new Set<string>();
  const schemaKeys = new Set(Object.keys(CONFIG_SCHEMA));

  for (const preset of PRESETS) {
    assert.ok(!ids.has(preset.id), `duplicate preset id: ${preset.id}`);
    ids.add(preset.id);

    for (const key of Object.keys(preset.config)) {
      assert.ok(schemaKeys.has(key), `preset ${preset.id} declares unknown key ${key}`);
    }
  }
});

test('presets: the three documented presets are shipped', () => {
  assert.deepEqual(
    PRESETS.map((p) => p.id),
    ['default', 'fast-chat', 'cozy']
  );
});

test('getPreset: resolves a known id and returns undefined for an unknown one', () => {
  assert.equal(getPreset('cozy')?.id, 'cozy');
  assert.equal(getPreset('nope'), undefined);
});

test('applyPreset: an unknown id falls back to plain defaults', () => {
  assert.deepEqual(applyPreset('nope'), getDefaults());
});

test('applyPreset: a known preset overlays only its own keys on the defaults', () => {
  const applied = applyPreset('cozy') as unknown as Record<string, unknown>;
  const defaults = getDefaults() as unknown as Record<string, unknown>;
  const presetKeys = new Set(Object.keys(getPreset('cozy')!.config));

  for (const key of Object.keys(defaults) as (keyof AppConfig)[]) {
    if (presetKeys.has(key)) continue;
    assert.deepEqual(applied[key], defaults[key], `preset changed unrelated key ${key}`);
  }

  assert.equal(applied.displaySeconds, 8);
  assert.equal(applied.maxQueueLength, 20);
});
