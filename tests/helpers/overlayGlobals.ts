/**
 * Test helper: recreate the globals the overlay's <script> tags provide.
 *
 * The overlay has no module loader, so its modules publish themselves on
 * `window` and read each other from there. Importing this module first gives a
 * Node test the same wiring, so the code under test takes the real path instead
 * of a test-only one.
 */

import {
  BoundedIdSet,
  CHAT_SOURCE_SEEN_ID_LIMIT,
  OVERLAY_SEEN_ID_LIMIT,
} from '../../src/shared/boundedIdSet';

const globalScope = globalThis as unknown as { window?: Record<string, unknown> };

globalScope.window = globalScope.window ?? {};
globalScope.window.boundedIdSet = {
  BoundedIdSet,
  OVERLAY_SEEN_ID_LIMIT,
  CHAT_SOURCE_SEEN_ID_LIMIT,
};

export { BoundedIdSet, CHAT_SOURCE_SEEN_ID_LIMIT, OVERLAY_SEEN_ID_LIMIT };
