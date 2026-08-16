## 1. Abstraction
- [x] 1.1 Extract a `ChatSource` interface from `TwitchChatSource` (start, stop, onMessage, logger, diagnostics).
- [x] 1.2 Move the platform-independent parts — hidden window lifecycle, attach retry with backoff, 250 ms queue drain, `normalizeMessage` — into a shared base.
- [x] 1.3 Keep `TwitchChatSource` behaviour byte-identical; the existing suite is the regression guard.

## 2. Kick source
- [x] 2.1 Add Kick domain suffixes to `src/shared/hostnames.ts` and an `isKickUrl` alongside `isTwitchUrl`, suffix-matched.
- [x] 2.2 Implement `KickChatSource` with the observer anchored on `#chatroom-messages` and `[data-index]` rows.
- [x] 2.3 Extract author and text structurally, splitting the row body at the `:` separator, not by utility class.
- [x] 2.4 Accept only rows whose wrapper is a message row; ignore event rows.
- [x] 2.5 Mint an attach token and key messages `kick-<token>-<data-index>`.
- [x] 2.6 Prefer `capturedAt` over the rendered local-time string for the timestamp.

## 3. Several sources at once
- [x] 3.1 `src/main/index.ts` owns a list of sources; `before-quit` stops all of them.
- [x] 3.2 One source failing to attach must not stop the others.
- [x] 3.3 Namespace ids per platform so the shared dedup cache cannot collide.

## 4. Configuration
- [x] 4.1 ~~Replace `twitchChatUrl` with a list of `{platform, url}` entries~~ — **approved deviation**: two
      string fields, `twitchChatUrl` and `kickChatUrl`. `ConfigFieldType` has no object-list type and its
      `string[]` coercion lowercases entries, so a list would have meant inventing a field type and a
      wizard control for two platforms. Recorded on issue #41.
- [x] 4.2 ~~Migrate a saved `twitchChatUrl` silently to a one-entry list~~ — no migration exists to write:
      the field kept its name, so a config saved by a Twitch-only version loads untouched. Covered by
      *a config saved before Kick existed still loads and validates*.
- [x] 4.3 Keep `TWITCH_CHAT_URL` working, mapped to the same entry; `KICK_CHAT_URL` added alongside it.
- [x] 4.4 Per-platform validation and per-platform connection test.
- [x] 4.5 Wizard form for both sources, each URL field with its own Test button.

## 5. Origin in the overlay
- [x] 5.1 Add the source platform to `ChatMessage` and carry it over IPC.
- [x] 5.2 Show the origin in the bubble without disturbing the avatar animation.

## 6. Tests & bug hunt
- [x] 6.1 Unit tests for `isKickUrl`, including lookalike hosts.
- [x] 6.2 Unit tests for the Kick row parser against captured DOM fixtures: message, emote-only, event.
- [x] 6.3 Unit tests for the upgrade path from a Twitch-only config (see 4.2).
- [x] 6.4 Unit tests for cross-source dedup with namespaced ids.
- [x] 6.5 Electron smoke test: two sources at once, both rendering, one failing while the other keeps working.
- [x] 6.6 Measure memory with two hidden windows against one.

## 7. Validation & closure
- [x] 7.1 `npm run lint`, `npm run typecheck`, `npm test`, `npm run check-packaging`, `npm run build:ts`.
- [x] 7.2 Re-run the existing simulations and both Electron smoke tests.
- [x] 7.3 Update `README.md`, `CONFIGURATION.md` and `docs/FIRST_MESSAGE_FLOW.md`.
- [x] 7.4 Re-measure the Kick capture rate on a busy channel before release.
