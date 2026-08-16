# Avatar Animation QA

Run with diagnostics:

```bash
TWITCH_CHAT_URL="https://www.twitch.tv/popout/<channel>/chat" DIAGNOSTICS=1 npm run start:diag
# or, for Kick
KICK_CHAT_URL="https://kick.com/popout/<channel>/chat" DIAGNOSTICS=1 npm run start:diag
```

Diagnostics logs come from two places, with different prefixes:

| Prefix | Source |
|--------|--------|
| `[diagnostics] avatar …` | `src/renderer/scripts/avatarAnimator.ts` |
| `[diagnostics] …` | `src/renderer/scripts/displayController.ts` |

Checklist — the log strings below are the ones the code actually emits:

- Avatar blinks at random intervals — `[diagnostics] avatar blink`.
- A message starts its sequence — `DISPLAY_START id=…`, then `entrance start` / `entrance complete`.
- The avatar pauses before speaking — `attention pause start` / `attention pause complete`
  (skipped entirely when `ATTENTION_PAUSE_MS=0`).
- The mouth animates and the eyes track the bubble — `reading start`, then
  `[diagnostics] avatar tokens …`, `[diagnostics] avatar talk duration …s` and
  `[diagnostics] avatar look left|right|center`.
- After the display timer — `display timer start` / `display timer complete`, then `DISPLAY_END id=…`.
- The mouth returns to neutral and the eyes centre — `[diagnostics] avatar talk stop`,
  `[diagnostics] avatar look center`.
- The sequence finishes — `exit start` / `exit complete` / `EXIT_DONE`.
- A failing animation is contained rather than freezing the overlay —
  `DISPLAY_FAILED reason=…` on the console, followed by the next message's `DISPLAY_START`.
- Closing the window stops further avatar logs (no lingering timers).

While waiting for the next message the avatar enters its "waiting" expression, which logs
`[diagnostics] avatar waitingEye=left|right` and `[diagnostics] avatar squintScaleY=…`. Those values
are seeded from the message id, so the same message always produces the same expression.

## Bubble appearance QA

The animation checklist above is driven by log lines; the bubble's appearance is not. These are read
off the screen, and they are the checks that caught real defects.

Set the treatment in the wizard's **Overlay Settings → Author's Name**, or with `AUTHOR_STYLE`, and
run through all five: `plain`, `tinted`, `label`, `subtle` (the default), `chip`.

- **The name never touches the message.** The gap is `margin`, not a space character, so it is easy
  to lose in a new treatment. Inline treatments hold roughly 8 px; `label` puts the name on its own
  line.
- **A 25-character name with no spaces wraps.** That is the longest both platforms allow. It must not
  widen the bubble past `BUBBLE_MAX_WIDTH`, and must not run under the platform badge in the
  top-right corner — `label` reserves space on the right for exactly this reason.
- **The colon appears only where it reads as punctuation** — `plain` and `tinted`. On `chip` or
  `label` it would look like a typo.
- **The badge shows the right platform.** With both configured, messages from each carry their own
  colour: Twitch purple, Kick green.
- **An emote-only message shows nothing rather than an empty bubble** — those are dropped before the
  queue, on both platforms.

## Wizard preview QA

The wizard previews the bubble in **Overlay Settings**, below Author's Name
(`src/renderer/config/scripts/bubblePreview.ts`).

- **Changing the treatment changes the preview immediately**, with no Start and no restart.
- **The Long name button** loads the 25-character case, so the stress case can be judged before going
  live.
- **The preview matches the overlay.** It is styled by the overlay's own `avatarUI.css`, so any
  difference between the preview and what a real message looks like is a bug in that arrangement, not
  a matter of taste. The quickest way to confirm the wiring is still intact: change a bubble rule in
  `src/renderer/styles/avatarUI.css` and check that the preview moves with it.
- **The badge follows the configured URLs** — Twitch alone, Kick alone, or alternating when both are
  filled in.
