# 🤖 Claude Code Context

> **AI Assistant Instructions for Keeping an Eye on the Chat**

---

## 📋 Project Overview

| | |
|---|---|
| **Type** | Electron desktop application |
| **Purpose** | Twitch and Kick chat overlay with animated avatar |
| **Stack** | TypeScript, Electron, GSAP |
| **Target** | Streamers who want chat visibility |

### Core Features

- 👁️ Observes Twitch and/or Kick popout chat via DOM, both at once if configured
- 💬 Displays messages one at a time with speech bubble
- 🎭 Animated avatar with lip-sync, blinking, expressions
- 🪟 Transparent click-through overlay window
- 🖥️ Multi-monitor support (select which display shows overlay)

---

## 🏗️ Architecture

```
src/
├── 📁 main/               # Electron main process
│   ├── index.ts           # Entry point, overlay window, system tray
│   ├── chatSource.ts      # Chat source base (hidden BrowserWindow, retry, polling)
│   ├── twitchChatSource.ts # Twitch DOM observer
│   ├── kickChatSource.ts  # Kick DOM observer
│   ├── configWindow.ts    # Configuration wizard window
│   ├── ipcHandlers.ts     # IPC communication handlers
│   └── testConnection.ts  # "Test" button in the wizard
├── 📁 preload/            # Preload scripts
│   ├── index.ts           # Overlay contextBridge
│   └── configPreload.ts   # Config window contextBridge
├── 📁 renderer/           # Renderer processes
│   ├── index.html         # Overlay page
│   ├── scripts/           # displayController, avatarUI, avatarAnimator, notificationSound
│   ├── styles/            # Overlay CSS
│   ├── assets/            # Notification sounds
│   └── 📁 config/         # Configuration wizard
│       ├── index.html
│       ├── locales/       # en.json, pt.json (wording lives here, not in TS)
│       ├── scripts/       # configValues.ts, configForm.ts, configApp.ts
│       └── styles/        # Dark theme CSS
├── 📁 config/             # Configuration logic
│   ├── types.ts           # TypeScript interfaces
│   ├── schema.ts          # Config schema + validation
│   ├── defaults.ts        # Defaults + presets
│   ├── store.ts           # JSON persistence
│   └── merge.ts           # Config merge logic
└── 📁 shared/             # Shared between processes
    ├── types/             # ChatMessage, OverlayConfig
    ├── boundedIdSet.ts    # Bounded dedup cache
    ├── displays.ts        # Monitor resolution
    └── hostnames.ts       # Domain suffix matching

tests/                     # Unit tests (node:test), compiled to dist-tests/
dist/                      # Compiled JavaScript (generated, packaged)
```

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `npm run lint` | 🧹 ESLint (type-aware) over src/, tests/ and scripts/ |
| `npm run typecheck` | ✅ Type check without compiling |
| `npm test` | 🧪 Compile tests to dist-tests/ and run them |
| `npm run check-packaging` | 📦 Windows launchers vs `build.productName` |
| `npm run check-commits` | 📜 No commit body accidentally declares a breaking change |
| `npm run build:ts` | 🔨 Compile TypeScript to dist/ |
| `npm start` | 🚀 Run app (auto-compiles) |
| `npm run start:diag` | 🔍 Run with diagnostics enabled |

CI runs lint, commit-notes, typecheck, check-packaging, test and build, in that order.

## 🔄 Data Flow

```
1. twitch/kickChatSource → Each observes its platform DOM in its own hidden BrowserWindow
2. IPC              → Messages sent to renderer process
3. displayController.ts → Manages queue and timing
4. avatarUI.ts      → Renders avatar + speech bubble
5. avatarAnimator.ts → GSAP animations (mouth, eyes)
```

---

## ⚙️ Environment Variables

`src/config/schema.ts` is the single source of truth — every field's `envVar` and `default` live
there. Read it rather than copying the list; `language` and `displayId` have no environment
variable.

## 📝 Code Conventions

- ✅ TypeScript strict mode (`strict: true`)
- ✅ CommonJS for Electron compatibility
- ✅ Shared types in `src/shared/types/`
- ✅ GSAP copied to `dist/renderer/vendor/`
- ⚠️ **Never start a commit body line with the words "breaking change".** The changelog parser
  reads it as a `BREAKING CHANGE` footer in any case, with or without a colon, so line wrapping
  alone can force a major release and mangle the notes. Use the exact
  `BREAKING CHANGE: <text>` marker when the change really is breaking.
- ⚠️ **The renderer has no module bundler.** Every renderer file is loaded by its own `<script>`
  tag over a shared `var exports = {}` shim, and publishes itself on `window`
  (`if (typeof window !== 'undefined') { window.X = X; }`). Only `import type` is safe there — a
  value import emits a `require()` the browser cannot resolve, and `tsc` will not catch it. To add
  a module, add a `<script>` tag and a `window` declaration in the matching `global.d.ts`.

---

## ⚠️ Important Notes

| Aspect | Detail |
|--------|--------|
| **Overlay Window** | Transparent, ignores mouse events |
| **Chat Source** | MutationObserver injected into a hidden BrowserWindow, one per platform; one failing does not stop the other |
| **Deduplication** | Three layers: a WeakSet of DOM nodes, then a bounded id cache in each process |
| **Queue** | Limited size, drops oldest when full |
| **Display Sequence** | entrance → attention pause → reading → display timer → exit; failures are contained and the next message still runs |
| **Config Storage** | JSON in `app.getPath('userData')` |
| **i18n** | English + Portuguese in config wizard |
| **Multi-Monitor** | Uses `screen.getAllDisplays()` for selection |

---

<!-- OPENSPEC:START -->
## 📋 OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.
<!-- OPENSPEC:END -->
