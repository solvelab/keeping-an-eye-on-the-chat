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
