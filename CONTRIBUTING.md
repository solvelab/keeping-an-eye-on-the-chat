# 🤝 Contributing

Thank you for your interest in contributing to **Keeping an Eye on the Chat**! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Architecture Overview](#-architecture-overview)
- [Development Workflow](#-development-workflow)
- [Code Style](#-code-style)
- [Submitting Changes](#-submitting-changes)

---

## 📜 Code of Conduct

Please be respectful and constructive in all interactions. We're here to build something great together!

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Setup

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_FORK/keeping-an-eye-on-the-chat.git
cd keeping-an-eye-on-the-chat

# 3. Install dependencies
npm install

# 4. Verify everything works
npm run lint
npm run typecheck
npm test
npm start
```

## 🏗️ Architecture Overview

This is an Electron application with three process types:

```
┌─────────────────────────────────────────────────────────────┐
│                    🖥️ Main Process                          │
│  src/main/                                                  │
│  • App lifecycle & window management                        │
│  • IPC handlers                                             │
│  • Twitch chat DOM observer (BrowserView)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ IPC (contextBridge)
┌────────────────────────▼────────────────────────────────────┐
│                    🌉 Preload Scripts                       │
│  src/preload/                                               │
│  • Bridges main ↔ renderer                                  │
│  • Exposes safe APIs via contextBridge                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    🎨 Renderer Process                      │
│  src/renderer/                                              │
│  • Overlay UI & animations                                  │
│  • Configuration wizard                                     │
│  • GSAP-powered avatar                                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/main/` | Electron main process (Node.js) |
| `src/preload/` | IPC bridge scripts |
| `src/renderer/` | Overlay UI (`index.html`, `scripts/`, `styles/`) |
| `src/renderer/config/` | Configuration wizard |
| `src/config/` | Configuration logic (schema, storage, merge) |
| `src/shared/types/` | Shared TypeScript interfaces |

## 💻 Development Workflow

### TypeScript Workflow

```
src/ (TypeScript) → build:ts → dist/ (JavaScript) → run
```

- ✏️ **Edit** files in `src/`
- 🔨 **Build** compiles to `dist/`
- ▶️ **Run** executes from `dist/`

### Commands

| Command | Description |
|---------|-------------|
| `npm start` | 🚀 Build & run app |
| `npm run start:diag` | 🔍 Run with diagnostics |
| `npm run lint` | 🧹 ESLint over `src/`, `tests/` and `scripts/` |
| `npm run typecheck` | ✅ Type check only |
| `npm test` | 🧪 Compile and run the unit suite |
| `npm run check-packaging` | 📦 Windows launchers vs `build.productName` |
| `npm run build:ts` | 🔨 Compile TypeScript |

Run `npm run lint`, `npm run typecheck` and `npm test` before opening a pull request — CI runs all
three.

### Tests

Unit tests live in `tests/`, use Node's built-in runner (`node:test`) and add **no dependency**.
`npm test` compiles them to `dist-tests/` and runs them, so `dist/` stays exactly what
electron-builder packages.

```
tests/
├── config/       # merge precedence, schema validation, persistence
├── main/         # connection-test decisions
├── preload/      # the config handshake
├── renderer/     # display controller, presets, notification sound
├── shared/       # bounded dedup cache, display and hostname helpers
└── helpers/      # temp dirs, Electron stub, overlay globals
```

### Adding New Features

#### 📁 Main Process Changes
```
src/main/
├── index.ts           # Entry point
├── chatSource.ts      # DOM observer
├── configWindow.ts    # Config window
└── yourFeature.ts     # ← Add here
```

#### 🎨 Renderer Changes
```
src/renderer/
├── index.html         # Overlay page (loads scripts via <script> tags)
├── scripts/           # ← Overlay UI logic here
├── styles/            # ← Overlay CSS here
├── assets/            # Notification sounds
└── config/
    ├── index.html     # Wizard page
    ├── scripts/       # ← Config UI logic
    ├── styles/        # ← Config styles
    └── assets/        # Wizard logo
```

> ⚠️ The renderer has **no module bundler**. Every file is loaded by its own `<script>` tag and
> publishes itself on `window` (see `displayController.ts` or `configValues.ts`). A runtime
> `import` of a value would emit a `require()` the browser cannot resolve — use `import type`
> only, and add a `<script>` tag for anything new.

#### 📝 Shared Types
```
src/shared/types/
├── index.ts           # Export all types
├── config.ts          # Config types
└── yourTypes.ts       # ← Add here
```

## 🎨 Code Style

### General Guidelines

- ✅ Use **ES2020+** features (async/await, optional chaining)
- ✅ Prefer `const` over `let`
- ✅ Use meaningful variable names
- ✅ Keep functions small and focused
- ✅ Handle errors gracefully
- ✅ Add proper TypeScript types (avoid `any`)

### TypeScript Best Practices

```typescript
// ✅ Good - explicit types
interface ChatMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
}

function processMessage(message: ChatMessage): void {
  // ...
}

// ❌ Avoid - any types
function processMessage(message: any): any {
  // ...
}
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| TypeScript files | camelCase | `chatSource.ts` |
| Type definitions | PascalCase | `ChatMessage` |
| CSS files | camelCase | `overlay.css` |
| Constants | UPPER_SNAKE | `MAX_QUEUE_LENGTH` |

## 📤 Submitting Changes

### Before Submitting

Run the checklist:

```bash
# 1. Type check passes
npm run typecheck

# 2. Build succeeds
npm run build:ts

# 3. App runs correctly
npm run start:diag

# 4. Test with live Twitch chat if possible
```

### Pull Request Process

1. 🍴 **Fork** the repository
2. 🌿 **Create** a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. 💾 **Commit** your changes with clear messages
   ```bash
   git commit -m "feat: add amazing feature"
   ```
4. 📤 **Push** to your fork
   ```bash
   git push origin feature/amazing-feature
   ```
5. 🔄 **Open** a Pull Request

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `style:` | Formatting (no code change) |
| `refactor:` | Code restructuring |
| `test:` | Adding tests |
| `chore:` | Maintenance tasks |

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- [ ] Change 1
- [ ] Change 2

## Testing
How to test these changes

## Screenshots
If applicable
```

---

## 🙋 Questions?

Feel free to open an issue for:
- 🐛 Bug reports
- 💡 Feature requests
- ❓ Questions

Thank you for contributing! 🎉

---

<div align="center">

Maintained by [@didevlab](https://github.com/didevlab)

</div>
