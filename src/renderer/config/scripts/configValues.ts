/**
 * Value coercion for the configuration wizard form.
 *
 * Loaded through its own <script> tag (the wizard has no module bundler), so it
 * publishes itself on `window` the same way the overlay scripts do. It must not
 * import anything at runtime.
 */

/** The subset of a schema field this module needs. */
export interface CoercibleFieldMeta {
  type: string;
  default?: unknown;
}

/**
 * Convert a raw form value to the type the schema declares for the field.
 *
 * `<select>` and `<input>` always hand back strings. Fields whose schema type is
 * `number` are obvious, but a `select` can also carry numbers — `displayId` does
 * — and storing its value as a string breaks every strict comparison the main
 * process makes against `Display.id`.
 */
export function coerceFieldValue(meta: CoercibleFieldMeta, rawValue: string): unknown {
  if (meta.type === 'number') {
    // Deliberately unguarded: an empty or malformed input becomes 0 or NaN and
    // is then reported by the field's own validator, instead of silently
    // slipping through as an "empty optional field".
    return Number(rawValue);
  }

  if (isNumericSelect(meta)) {
    // A <select> only ever yields one of its own option values, so this is a
    // safety net rather than a real branch.
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : meta.default;
  }

  if (meta.type === 'string[]') {
    return rawValue
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  return rawValue;
}

/**
 * A `select` field carries numbers when its schema default is a number.
 */
export function isNumericSelect(meta: CoercibleFieldMeta): boolean {
  return meta.type === 'select' && typeof meta.default === 'number';
}

// Published for the wizard's <script> tag loader; guarded so the module can also
// be required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.configValues = { coerceFieldValue, isNumericSelect };
}
