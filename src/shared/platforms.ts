/**
 * The streaming platforms whose chat this app can observe.
 *
 * Kept separate from `hostnames.ts`: that module matches URLs to platforms, this
 * one is the domain concept — which platforms exist and what they are called.
 *
 * This file is loaded by the overlay through a plain `<script>` tag, so it must
 * import nothing at runtime: a value import compiles to `require`, which the
 * renderer has no loader for. That is why the domain lists and the URL matching
 * live in `hostnames.ts` and not here — the dependency would run the wrong way.
 * `import type` is safe, since it is erased.
 */

/** A platform this app can read chat from. */
export type Platform = 'twitch' | 'kick';

/** Every supported platform, in the order the wizard presents them. */
export const PLATFORMS: readonly Platform[] = ['twitch', 'kick'] as const;

/** Human-readable platform names. Brand names, so not translated. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: 'Twitch',
  kick: 'Kick',
};

/** Whether a value is a supported platform id. */
export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);
}

// Published on window for the overlay, which has no module loader. Reached
// through globalThis because this module is also compiled for the main process,
// which has no DOM types. The const is named after this module on purpose: every
// shared file published this way shares one global scope, so a generic name here
// collides with the next file to use it and the page dies on a redeclaration.
const platformsGlobalTarget = (globalThis as unknown as { window?: Record<string, unknown> })
  .window;

if (platformsGlobalTarget) {
  platformsGlobalTarget.platforms = { PLATFORMS, PLATFORM_LABELS, isPlatform };
}
