/**
 * Display (monitor) resolution shared by the main process and its tests.
 */

/** Minimal shape of an Electron `Display` this module needs. */
export interface DisplayLike {
  id: number;
}

/**
 * Normalize a persisted `displayId`.
 *
 * The configuration wizard used to store the value of a `<select>` verbatim, so
 * configs written by older versions hold a numeric **string**. Everything else
 * (missing, empty, non-numeric) means "use the primary display", which the
 * schema encodes as `0`.
 */
export function normalizeDisplayId(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

/**
 * Pick the display the overlay should be created on.
 *
 * Falls back to the primary display when the configured id is absent, invalid,
 * or refers to a monitor that is no longer connected.
 */
export function resolveTargetDisplay<T extends DisplayLike>(
  displays: readonly T[],
  configuredId: unknown,
  primary: T
): T {
  const id = normalizeDisplayId(configuredId);
  if (id === 0) {
    return primary;
  }

  return displays.find((display) => display.id === id) ?? primary;
}
