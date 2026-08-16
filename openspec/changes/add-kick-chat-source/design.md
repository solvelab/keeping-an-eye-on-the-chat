# Design: multi-platform chat observation

This is the deliverable of spike #40. Everything in *Findings* was measured against a live Kick
popout chat in this repository's own Electron runtime, with the same `webPreferences` the app uses
(`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`). Nothing here is inferred from
documentation.

Method: seven throwaway probes, discarded per the spike's terms. Only the findings land.

---

## Findings

### FR1 — The page loads under the security baseline. No login, no challenge.

```
load: resolved in 1301ms
final URL: https://kick.com/popout/<channel>/chat
login words   : (none)
password input: false
cloudflare?   : false
did-fail-load : (none)
```

The security baseline does not have to be relaxed. That was the one finding that could have blocked
this outright.

### FR2 — Messages are observable DOM, but the hooks are weak

Container, with a stable hook:

```html
<div id="chatroom-messages" data-testid="chatroom-messages"
     class="relative h-full w-full overflow-y-auto contain-strict">
  <div class="no-scrollbar relative" style="height: 963px;">      <!-- virtual spacer -->
    <div data-index="26" class="absolute inset-x-0 top-0" style="transform: translateY(837px);">
```

Anatomy of one message, four siblings inside the row body:

| Position | Element | Content |
|---|---|---|
| 1 | `span.text-neutral.pr-1.font-semibold` | `11:46 PM` — **hidden**, `--chatroom-timestamps-display: none` |
| 2 | `div.inline-flex...items-baseline` | the author |
| 3 | `span.inline-flex.font-bold` | literally `:` |
| 4 | `span.leading-[1.55].font-normal` | the message text |

**There is no semantic hook for author, text or timestamp.** The only `data-testid` values inside a
row are identity badges (`identity-badge-subscriber`, `-moderator`, `-vip`, `-founder`, `-og`,
`-verified`, `-sub_gifter`). No `title` attributes.

This is materially worse than Twitch, which exposes `data-a-target="chat-message-username"` and
`chat-message-text` — attributes that exist to be selected. Kick offers only Tailwind utility
classes, which change whenever the design does.

A cautionary measurement: the obvious guess `span.font-bold` matched **27 of 28 rows** and returned
`":"` — the separator. A selector chain can look healthy and extract nothing but punctuation.

Two extraction strategies were scored against every row:

| Strategy | All rows | Live rows |
|---|---|---|
| A — class-based, the shape the Twitch chains take | 32/45 | 7/17 |
| B — structural, split the row's parts at the `:` separator | 30/45 | 7/17 |

Neither is better. Both fail on the same rows, and the failures are **empty text with a present
author** — the signature of a non-text row, not of broken extraction. Classifying by row shape gives
the real number:

```
live arrivals (n=54): message 44 | message-emote-only 9 | event 1
capture rate over chat messages: 83%
```

The missing 17% are **emote-only messages**: author present, body is `<img>` elements, `textContent`
empty. Twitch behaves the same way and the app already drops those (`enqueueMessage` requires both
`user` and `text`). So 83% is parity with today, not a Kick regression — and rendering `img[alt]` as
`:emoteName:` would lift both platforms at once.

Normal messages carry the wrapper class `group relative px-2 lg:px-3` (79 of 81 rows observed); the
two other wrappers seen were the non-message rows. That is the accept/ignore discriminator.

### FR4 — `data-index` identifies a message, but only within a page load

Watched for 5 minutes on a live chat, separating the seeded backlog from live arrivals:

```
 t(s)  added  removed  rowsInDom  maxDataIndex  distinctMsgs
   30      2        0         30            29             2
  150     12        9         31            39            12
  301     35       33         30            62            35

live added 35 · live removed 33 · rows in DOM at end 30
max data-index 29 -> 62 while the row count never left ~30
non-monotonic index sightings          : 0
data-index values holding >1 message   : 0
DOM nodes recycled for a new message   : 0
```

So the list **is** virtualised — a sliding window of ~30 rows, old rows removed as new arrive — but
`data-index` is a monotonically increasing message counter, not a slot number, and **added nodes are
fresh elements**. The `WeakSet` of seen nodes in the injected script stays sound.

The limit: a fresh page load restarts the index at 0. `data-index` is unique per load, not per
channel or per message. So an id must carry a token minted when the observer attaches:
`kick-<attachToken>-<data-index>`. Measured over 45 rows: 45 distinct ids, 0 collisions.

### FR3 — Not needed

DOM observation works, so no API, no authentication and no new dependency.

### Timestamps differ

Twitch renders `<time datetime="...">`, machine readable. Kick renders `11:46 PM` — a localised
string, and hidden by default via a CSS variable. `normalizeMessage` should therefore prefer
`capturedAt` for Kick rather than parse a display string whose format follows the viewer's locale.

---

## Design

### `ChatSource`

`TwitchChatSource` already has the right shape — `start()`, `stop()`, an `onMessage` callback, a
logger and a diagnostics flag. Promote that to an interface, keep the class as one implementation,
add `KickChatSource` as another.

The hidden-window lifecycle, the retry-with-backoff, the 250 ms queue drain and `normalizeMessage`
are platform-independent and move to a shared base. What differs per platform is only: the domain
suffixes, the injected observer script, and how a row becomes `{id, user, text, timestamp}`.

### Running several at once

`src/main/index.ts` holds one `chatSource`; it holds a list instead, and `before-quit` stops all of
them. A source that fails to attach must not affect the others — the same containment principle the
display sequence already follows.

### Identity across sources

Ids are namespaced by platform (`twitch-…`, `kick-…`), so two sources cannot collide in the shared
`BoundedIdSet`. The main-process cache is per source; the renderer's single cache sees namespaced
ids, so its 500-entry cap now covers two streams and should scale with the number of active sources.

### Configuration

`twitchChatUrl: string` becomes a list of `{platform, url}`. Migration is mechanical and must be
silent: a saved `twitchChatUrl` becomes a one-entry list with `platform: 'twitch'`. The
`TWITCH_CHAT_URL` environment variable keeps working and maps to the same entry.

Validation stays suffix-based per platform (`isTwitchUrl`, and a `isKickUrl` alongside it). The
substring check that once accepted `twitch.tv.attacker.example` must not reappear.

### Origin in the overlay

`ChatMessage` gains the source platform. The bubble shows it — the exact treatment (a small icon, or
the existing cyan border tinted per platform) is a visual decision for implementation, constrained by
the bubble already being small and the avatar animation being sensitive to layout changes.

---

## Risks carried into implementation

| Risk | Note |
|---|---|
| Kick's utility-class selectors break on any redesign | Highest risk here. Prefer structural extraction anchored on `[data-index]` and the `:` separator over class chains, and fail loudly like the existing 10 s attach timeout |
| Emote-only messages are dropped (17%) | Pre-existing on Twitch too. Rendering `img[alt]` fixes both |
| A busier channel behaves differently | Measured at roughly 7–25 messages/minute. The monotonic index is a structural property, but a very fast chat is worth re-measuring before release |
| Two sources double the hidden windows | Two Chromium renderers instead of one, in an app that advertises being lightweight. Worth measuring memory before shipping |

## Open question for implementation

Whether the renderer's dedup cap should scale with the number of sources, or whether each source
should own a cache in the main process and the renderer keep one. The measurement above does not
settle it; the number of active sources is small, so either is defensible.
