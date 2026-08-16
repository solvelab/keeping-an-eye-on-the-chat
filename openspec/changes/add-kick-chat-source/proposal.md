# Change: Multi-platform chat observation, adding Kick alongside Twitch

## Why
Kick is where this app's audience increasingly streams, and the app can only read Twitch. Twitch is
not behind an abstraction: sixteen files name it, `twitchChatUrl` is a single required string, and
`ChatMessage` has no notion of where a message came from.

A spike (#40) loaded a real Kick popout chat in this repository's own Electron runtime and measured
what a second source would actually require. The mechanism transfers — Kick chat is observable DOM —
but three things differ enough to need a design rather than a selector swap: the list is virtualised,
there is no semantic hook for author or message text, and the only per-message identifier restarts on
every page load.

Two product decisions widen this further: both platforms must be watched **simultaneously**, and the
overlay must **show which platform a message came from**.

## What Changes
- Introduce a `ChatSource` abstraction; `TwitchChatSource` becomes one implementation and
  `KickChatSource` another.
- Run several sources at once, feeding one display queue, with per-source failure isolation.
- Replace the single `twitchChatUrl` string with a list of configured sources, and migrate existing
  configurations without the user reconfiguring.
- Add a platform field to `ChatMessage` and show the origin in the bubble.
- Namespace message ids per source, because Kick's identifier is only unique within a page load.
- Extend host validation with Kick domains, keeping suffix matching.

## Impact
- Affected specs: observe-chat (new)
- Affected code:
  - `src/main/chatSource.ts` — becomes `TwitchChatSource implements ChatSource`
  - `src/main/kickChatSource.ts` — new
  - `src/main/index.ts` — owns N sources instead of one
  - `src/main/testConnection.ts`, `src/main/ipcHandlers.ts` — per-platform connection test
  - `src/shared/hostnames.ts` — Kick domain suffixes
  - `src/shared/types/chatMessage.ts` — origin field
  - `src/config/schema.ts`, `types.ts`, `store.ts` — source list and migration
  - `src/renderer/config/**` — wizard form for N sources
  - `src/renderer/scripts/avatarUI.ts`, `src/renderer/styles/avatarUI.css` — origin indicator
  - `README.md`, `CONFIGURATION.md`, `docs/FIRST_MESSAGE_FLOW.md`
