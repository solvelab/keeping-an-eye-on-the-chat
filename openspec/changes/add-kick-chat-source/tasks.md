## 1. Abstraction
- [ ] 1.1 Extract a `ChatSource` interface from `TwitchChatSource` (start, stop, onMessage, logger, diagnostics).
- [ ] 1.2 Move the platform-independent parts — hidden window lifecycle, attach retry with backoff, 250 ms queue drain, `normalizeMessage` — into a shared base.
- [ ] 1.3 Keep `TwitchChatSource` behaviour byte-identical; the existing suite is the regression guard.

## 2. Kick source
- [ ] 2.1 Add Kick domain suffixes to `src/shared/hostnames.ts` and an `isKickUrl` alongside `isTwitchUrl`, suffix-matched.
- [ ] 2.2 Implement `KickChatSource` with the observer anchored on `#chatroom-messages` and `[data-index]` rows.
- [ ] 2.3 Extract author and text structurally, splitting the row body at the `:` separator, not by utility class.
- [ ] 2.4 Accept only rows whose wrapper is a message row; ignore event rows.
- [ ] 2.5 Mint an attach token and key messages `kick-<token>-<data-index>`.
- [ ] 2.6 Prefer `capturedAt` over the rendered local-time string for the timestamp.

## 3. Several sources at once
- [ ] 3.1 `src/main/index.ts` owns a list of sources; `before-quit` stops all of them.
- [ ] 3.2 One source failing to attach must not stop the others.
- [ ] 3.3 Namespace ids per platform so the shared dedup cache cannot collide.

## 4. Configuration
- [ ] 4.1 Replace `twitchChatUrl` with a list of `{platform, url}` entries in the schema and types.
- [ ] 4.2 Migrate a saved `twitchChatUrl` silently to a one-entry list; no user reconfiguration.
- [ ] 4.3 Keep `TWITCH_CHAT_URL` working, mapped to the same entry.
- [ ] 4.4 Per-platform validation and per-platform connection test.
- [ ] 4.5 Wizard form for N sources.

## 5. Origin in the overlay
- [ ] 5.1 Add the source platform to `ChatMessage` and carry it over IPC.
- [ ] 5.2 Show the origin in the bubble without disturbing the avatar animation.

## 6. Tests & bug hunt
- [ ] 6.1 Unit tests for `isKickUrl`, including lookalike hosts.
- [ ] 6.2 Unit tests for the Kick row parser against captured DOM fixtures: message, emote-only, event.
- [ ] 6.3 Unit tests for the configuration migration from a `twitchChatUrl` config.
- [ ] 6.4 Unit tests for cross-source dedup with namespaced ids.
- [ ] 6.5 Electron smoke test: two sources at once, both rendering, one failing while the other keeps working.
- [ ] 6.6 Measure memory with two hidden windows against one.

## 7. Validation & closure
- [ ] 7.1 `npm run lint`, `npm run typecheck`, `npm test`, `npm run check-packaging`, `npm run build:ts`.
- [ ] 7.2 Re-run the existing simulations and both Electron smoke tests.
- [ ] 7.3 Update `README.md` (MVP scope still says Twitch-only), `CONFIGURATION.md` and `docs/FIRST_MESSAGE_FLOW.md`.
- [ ] 7.4 Re-measure the Kick capture rate on a busy channel before release.
