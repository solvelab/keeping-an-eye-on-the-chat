/**
 * Hostname matching shared by everything that loads a Twitch page.
 *
 * A Twitch popout page pulls in third-party frames and trackers. Their load
 * failures reach the same `did-fail-load` event as the page itself, so both the
 * chat source and the connection test have to tell them apart.
 */

/** Domains that belong to Twitch itself. */
export const TWITCH_DOMAIN_SUFFIXES = ['twitch.tv', 'ttvnw.net', 'jtvnw.net', 'twitchcdn.net'];

/** Ad and telemetry domains whose failures are routine and must stay silent. */
export const SUPPRESSED_DOMAIN_SUFFIXES = [
  'oneadtag.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googletagmanager.com',
  'google-analytics.com',
  'adservice.google.com',
];

/** Chromium's net::ERR_ABORTED — a cancelled navigation, not a failure. */
export const ERR_ABORTED = -3;

/**
 * Extract a lowercase hostname, or an empty string when the value is not a URL.
 */
export function getHostname(url: string): string {
  if (!url) {
    return '';
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Match a hostname against a list of domain suffixes.
 *
 * Suffix matching, not substring matching: `twitch.tv.example.com` is **not**
 * `twitch.tv`.
 */
export function hostnameMatches(hostname: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

/**
 * Whether a URL points at Twitch (or one of its CDNs).
 */
export function isTwitchUrl(url: string): boolean {
  const hostname = getHostname(url);
  return hostname !== '' && hostnameMatches(hostname, TWITCH_DOMAIN_SUFFIXES);
}

/**
 * Whether a URL belongs to a domain whose load failures should stay silent.
 */
export function isSuppressedUrl(url: string): boolean {
  const hostname = getHostname(url);
  return hostname !== '' && hostnameMatches(hostname, SUPPRESSED_DOMAIN_SUFFIXES);
}
