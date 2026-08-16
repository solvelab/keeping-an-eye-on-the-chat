# Project Context

## Purpose

**Keeping an Eye on the Chat** (packaged as `EyeOnChat`) is a desktop overlay for streamers. It
watches a Twitch and/or a Kick popout chat page, and shows one message at a time in a speech bubble
next to a small animated avatar, on top of whatever is on screen. Both platforms can be watched at
once; each message carries the platform it came from.

The point is attention: a streamer focused on a game does not read the chat panel. A single message
with a sound and a moving mouth is hard to miss.

## Tech Stack

- **Electron 28** — main process, preload scripts, renderer processes
- **TypeScript 5** in strict mode, compiled to **CommonJS** (Electron compatibility)
- **GSAP 3** for avatar animation — the only runtime dependency besides `cross-env`
- **node:test** for unit tests — deliberately no test framework dependency
- **ESLint 9 + typescript-eslint 8**, type-aware
- **electron-builder** for Windows (zip + NSIS) and Linux (AppImage) artifacts
- **semantic-release** driven by Conventional Commits

Runtime dependency count is a design constraint, not an accident: the app is advertised as
lightweight, and every addition is weighed against that.

## Project Conventions

### Code Style

- TypeScript strict mode; `any` is a defect except in the wizard's form controller, which is
  tracked for tightening.
- Identifiers, file names, IPC channel names and config keys are **English**. Prose (issues, PR
  bodies, commit subjects) follows the repository's working language, which is English.
- `npm run lint` must pass. `@typescript-eslint/no-floating-promises` is enforced: an intentional
  fire-and-forget call is marked `void`, never left bare.
- Comments explain *why*, not *what*. A comment restating the code is noise.

### Architecture Patterns

- **Three process types.** `src/main/` (Node), `src/preload/` (contextBridge), `src/renderer/`
  (browser). Nothing crosses those boundaries except through the IPC channels declared in
  `src/main/ipcHandlers.ts` and the two preload scripts.
- **Electron security baseline is non-negotiable**: `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true` on any window that loads remote content. Both
  renderer pages declare a Content-Security-Policy.
- **The renderer has no module bundler.** Every renderer file is loaded by its own `<script>` tag
  over a shared `var exports = {}` shim and publishes itself on `window`. Only `import type` is
  safe there — a value import emits a `require()` the browser cannot resolve, and `tsc` will not
  catch it.
- **`src/config/schema.ts` is the single source of truth** for defaults, validation, environment
  variable names and UI metadata. Any fallback elsewhere must name it in a comment.
- **Configuration precedence** is deterministic: defaults → saved → environment → CLI, with the
  source of each field tracked so the wizard can show an `ENV` badge.
- **Failures are contained, not propagated.** The display sequence catches, logs and moves on; the
  config store recovers from a corrupt file via its backup; the chat source retries observer
  attachment with backoff.

### Testing Strategy

- Unit tests in `tests/`, compiled by `config/tsconfig.test.json` into `dist-tests/` so `dist/`
  stays exactly what electron-builder packages.
- Coverage targets the pure layers: config merge/schema/store, the display controller, the shared
  helpers, and the preload handshake. Electron is stubbed where a test needs it.
- Anything the unit suite cannot reach — main-process lifecycle, the CSP, the wizard's DOM — is
  verified by driving the real compiled code against a fake Electron, or against a real Electron
  window, and the evidence goes in the pull request.
- Every bug fix adds the regression test that would have caught it.

### Git Workflow

- Backlog-first: an idea becomes a GitHub issue in the **solvelab / Tools** project before any code
  is written (`.github/backlog.yml`).
- One issue → one branch `backlog/<n>-<slug>` → one pull request carrying `Closes #n`.
- **Conventional Commits** with a gitmoji prefix. Only `feat`, `fix` and `perf` cut a release.
- No AI attribution in any git artifact.
- Never commit to `master`; never merge your own pull request without review.

## Domain Context

- **Author style** — how a chatter's name is set apart from their message in the bubble. One of five
  designed treatments, chosen by the streamer (`authorStyle`) and previewed live in the wizard.
- **Popout chat** — a platform's standalone chat page: `twitch.tv/popout/<channel>/chat` or
  `kick.com/popout/<channel>/chat`. The app observes its DOM in a hidden window; there is no API
  integration and no authentication on either platform.
- **Overlay** — a transparent, click-through, always-on-top window. It is invisible to the mouse and
  absent from the taskbar, so the **system tray** is the only way to interact with a running app.
- **Viseme** — a mouth shape. The avatar's lip-sync picks weighted viseme presets per syllable; it
  approximates speech rather than reproducing it.
- **Attention pause** — the beat where the avatar looks forward before speaking, so the viewer's eye
  lands on it before the text starts.

## Important Constraints

- **A streaming site's DOM is not an API.** It can change without notice. Selectors are lists of
  fallbacks and observer attachment has a 10 s timeout with a clear error, because breakage is
  expected. Kick goes further: it has no semantic hooks at all, so its extraction is structural
  (the `:` separator) rather than class-based.
- **A stream runs for hours.** Anything that accumulates per message must be bounded; unbounded
  caches are a defect, not a trade-off.
- **The overlay must never freeze silently.** A wedged overlay is worse than a crash, because the
  streamer does not notice.
- **Windows builds are unsigned.** `CSC_IDENTITY_AUTO_DISCOVERY=false` is set deliberately; users
  see SmartScreen warnings.
- Non-goals, from the README: no chatbot or LLM integration, no moderation, no message history, no
  text-to-speech, no complex filtering rules.

## External Dependencies

| Dependency | Role | Failure mode |
|---|---|---|
| Twitch popout chat page | a message source | selectors change → observer attach times out after 10 s |
| Kick popout chat page | a message source | markup changes → rows stop parsing, or attach times out after 10 s |
| GitHub Actions | lint, typecheck, test, build, release | a failed run blocks the release, not the app |
| PayPal | donation link in the README and the wizard | cosmetic |

No backend, no telemetry, no account. All state is a single `config.json` in Electron's `userData`
directory, with a `config.backup.json` beside it.
