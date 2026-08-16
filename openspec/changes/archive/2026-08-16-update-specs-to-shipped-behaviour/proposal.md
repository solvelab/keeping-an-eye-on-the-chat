# Update the specs to the behaviour that shipped

## Why

Two specs assert requirements the code refuses, and three shipped features have no spec at all.

`configure-app` declares *"TWITCH_CHAT_URL MUST be the only required field"*. Since v2.1.0 either a
Twitch **or** a Kick URL satisfies validation, enforced in `src/config/merge.ts` and no longer marked
`required` in `src/config/schema.ts`.

`observe-chat` declares that sources are stored *"as a list of platform and URL pairs"* and that a
saved `twitchChatUrl` *"is migrated to a one-entry source list"*. Neither shipped: `AppConfig` holds
two string fields, `twitchChatUrl` and `kickChatUrl`, and there is no migration because the field
kept its name. The deviation was approved and recorded on issue #41 and in that change's `tasks.md`,
but the spec delta was archived carrying the pre-deviation design — the archive step copied the plan
instead of what was built.

A MUST-level requirement contradicting the code is worse than a missing one: it is the document the
next change would be validated against.

Three features then shipped with no spec coverage — the tray's Stop/Start of the overlay (v2.1.1),
the author-name treatments (v2.2.0) and the wizard's bubble preview (v2.3.0).

## What Changes

- Replace the Twitch-only required-field requirement with one that describes the at-least-one-URL
  rule the code enforces, including the per-field Test action that shipped with Kick.
- Correct the multi-source configuration requirement to the two named fields, and drop the migration
  scenario that describes work nobody did.
- Add requirements for the author-name treatments, the wizard's bubble preview, and stopping and
  resuming observation from the tray.
- Give `observe-chat` a Purpose; it still reads "TBD - created by archiving change".

No behaviour changes. This proposal makes the specs describe what v2.3.0 already does.

## Impact

- Affected specs: `configure-app`, `observe-chat`
- Affected code: none
