# ⚙️ Configuration Guide

Complete guide for configuring **Keeping an Eye on the Chat**.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Configuration Wizard](#-configuration-wizard)
- [Environment Variables](#-environment-variables)
- [Windows Setup](#-windows-setup)
- [Presets](#-presets)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### 1. Get Your Twitch Chat URL

1. Go to your Twitch channel
2. Click the **Chat Settings** (gear icon) in chat
3. Select **Popout Chat**
4. Copy the URL from your browser

The URL should look like:
```
https://www.twitch.tv/popout/YOURNAME/chat?popout=
```

### 2. Run the App

```bash
npm start
```

The configuration wizard will open automatically on first run.

---

## 🧙 Configuration Wizard

The built-in wizard provides an intuitive way to configure all settings:

### Sections

| Section | Description |
|---------|-------------|
| 🔧 **Basic** | Twitch Chat URL (required) |
| 🎨 **Overlay** | Display (monitor), position, margins, bubble width, attention pause |
| 🔔 **Sound** | Enable/disable, output device, custom file, volume |
| ⚡ **Performance** | Message length, ignored users, command prefix |
| 🔬 **Advanced** | Queue size, exit animation, diagnostics, debug frame, devtools |

### Features

- 🌍 **Language Toggle** — Switch between English and Portuguese
- 🎯 **Presets** — Adjust the timing knobs without touching anything else
- ✅ **Validation** — Real-time error checking; Start stays disabled until the config is valid
- 🧪 **Test Connection** — Verify your Twitch URL loads
- 🖥️ **Display preview** — Selecting a monitor flashes a green border on it
- 🏷️ **Override badges** — A field set by an environment variable is marked `ENV` and locked

---

## 🔧 Environment Variables

Every setting except **Language** and **Display** can be set through the environment. These override
values saved by the wizard, and the wizard marks such fields with an `ENV` badge and disables them.

Defaults below come from `src/config/schema.ts`, which is the single source of truth.

### Required

| Variable | Description |
|----------|-------------|
| `TWITCH_CHAT_URL` | 📺 Twitch popout chat URL. Must be a `twitch.tv` host |

### Overlay

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY_SECONDS` | `5` | ⏱️ How long each message is shown (1–60) |
| `OVERLAY_ANCHOR` | `bottom-left` | 📍 Corner the bubble appears in |
| `OVERLAY_MARGIN` | `24` | 📏 Margin from the screen edge, px (0–200) |
| `BUBBLE_MAX_WIDTH` | `420` | 📐 Maximum bubble width, px (120–800) |
| `ATTENTION_PAUSE_MS` | `500` | 🎬 Pause before the avatar speaks, ms (0–3000). `0` disables it |

### Overlay Position Options

| Value | Position |
|-------|----------|
| `bottom-left` | ↙️ Bottom left corner |
| `bottom-right` | ↘️ Bottom right corner |
| `top-left` | ↖️ Top left corner |
| `top-right` | ↗️ Top right corner |

### Filtering

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_MESSAGE_LENGTH` | `140` | ✂️ Truncate longer messages (10–500) |
| `IGNORE_COMMAND_PREFIX` | `!` | 🚫 Ignore messages starting with this. Empty disables it |
| `IGNORE_USERS` | — | 👤 Comma-separated usernames, case-insensitive |

### Queue and animation

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_QUEUE_LENGTH` | `50` | 📚 Max queued messages (1–500). Oldest are dropped |
| `EXIT_ANIMATION_MS` | `400` | 🎞️ Exit animation duration, ms (0–2000) |

### Notification sound

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFICATION_SOUND_ENABLED` | `1` | 🔔 `0` disables the sound |
| `NOTIFICATION_SOUND_FILE` | — | 🎵 Full path to an audio file. Empty uses the bundled default |
| `NOTIFICATION_SOUND_VOLUME` | `50` | 🔊 Volume (0–100) |
| `NOTIFICATION_SOUND_DEVICE` | — | 🎧 Audio output device ID. Empty uses the system default |

Supported formats for a custom file: `.mp3`, `.wav`, `.ogg`, `.m4a`. Anything else is refused and
the sound stays off.

### Debug

| Variable | Default | Description |
|----------|---------|-------------|
| `DIAGNOSTICS` | `0` | 🔍 Diagnostic logs, including chat message contents |
| `OVERLAY_DEBUG` | `0` | 🐛 Debug frame and live counters on the overlay |
| `DEVTOOLS` | `0` | 🛠️ Open DevTools on start (development only) |

> ℹ️ **Not available as environment variables:** the UI language and the monitor selection. Both are
> set in the wizard and stored in `config.json`.

---

## 🪟 Windows Setup

### Option 1: Using the Wizard

Simply run the app - the wizard handles everything.

### Option 2: Using Batch Files

#### Build the App

```bash
npm run build:win
```

#### Setup Batch Files

1. Extract the zip from `release/`
2. Copy `packaging/windows/*.bat` to the extracted folder
3. Edit the batch file:

> 💡 The executable is named after `build.productName` in `package.json` — currently
> **`EyeOnChat.exe`**. The shipped batch files keep it in a single `APP_EXE` variable so a rename
> is a one-line change.

**run-overlay.bat:**
```batch
@echo off
set "APP_EXE=EyeOnChat.exe"
set "TWITCH_CHAT_URL=https://www.twitch.tv/popout/YOURNAME/chat?popout="
set "DISPLAY_SECONDS=5"
set "OVERLAY_ANCHOR=bottom-left"
start "" "%~dp0%APP_EXE%"
```

**run-diag.bat:**
```batch
@echo off
set "APP_EXE=EyeOnChat.exe"
set "TWITCH_CHAT_URL=https://www.twitch.tv/popout/YOURNAME/chat?popout="
set "DIAGNOSTICS=1"
set "OVERLAY_DEBUG=1"
start "" "%~dp0%APP_EXE%"
```

4. Double-click the `.bat` file to launch

`set-channel.example.bat` lists every supported environment variable, commented out, as a starting
point.

### Option 3: PowerShell

```powershell
# Set environment variable for this session
$env:TWITCH_CHAT_URL="https://www.twitch.tv/popout/YOURNAME/chat?popout="

# Run the app
& ".\EyeOnChat.exe"
```

### Option 4: Command Prompt

```cmd
set TWITCH_CHAT_URL=https://www.twitch.tv/popout/YOURNAME/chat?popout=
"EyeOnChat.exe"
```

### Option 5: System-wide (Persistent)

```cmd
setx TWITCH_CHAT_URL "https://www.twitch.tv/popout/YOURNAME/chat?popout="
```

> ⚠️ **Note:** System-wide variables require restarting your terminal.

---

## 🎯 Presets

A preset changes **only the timing settings it declares**. Everything else you have already
configured — the Twitch URL above all, plus language, monitor, position and sound — is left alone.

Values below come from `PRESETS` in `src/config/defaults.ts`.

### Default

Declares nothing, so selecting it changes nothing. It is there as the "no preset" entry; use
**Reset to Defaults** in the footer to actually restore every setting.

### Fast-Paced Chat

| Setting | Value |
|---------|-------|
| Display Duration | 3 seconds |
| Max Queue Length | 100 messages |
| Max Message Length | 100 characters |
| Exit Animation | 250 ms |
| Attention Pause | 500 ms |

**Best for:** high-activity streams with rapid chat.

### Cozy Stream

| Setting | Value |
|---------|-------|
| Display Duration | 8 seconds |
| Max Queue Length | 20 messages |
| Max Message Length | 200 characters |
| Exit Animation | 500 ms |
| Attention Pause | 1500 ms |

**Best for:** relaxed streams with slower chat.

---

## 🐛 Troubleshooting

### ERR_NAME_NOT_RESOLVED

<details>
<summary>Click to expand</summary>

**Problem:** The Twitch URL cannot be resolved.

**Solutions:**
1. ✅ Check your internet connection
2. ✅ Verify the URL format: `https://www.twitch.tv/popout/<channel>/chat?popout=`
3. ✅ Make sure the channel name is correct
4. ✅ Try opening the URL in a browser first
</details>

### Chat Not Loading

<details>
<summary>Click to expand</summary>

**Problem:** The overlay opens but no messages appear.

**Solutions:**
1. ✅ Verify `TWITCH_CHAT_URL` is set correctly
2. ✅ Run with `DIAGNOSTICS=1` to see logs
3. ✅ Check if the channel is live with active chat
4. ✅ Try a different channel to test
</details>

### Observer Attachment Timeout

<details>
<summary>Click to expand</summary>

**Problem:** "Chat source observer attachment timed out after 10s"

**Causes:**
- Twitch may have changed their page structure
- Network issues during page load

**Solutions:**
1. 🔄 Restart the app and try again
2. 🔍 Run with `DIAGNOSTICS=1` for more details
3. 🐛 If problem persists, open an issue on GitHub
</details>

### Config Not Saving

<details>
<summary>Click to expand</summary>

**Problem:** Settings don't persist between runs.

**Config file location:**
- **Linux:** `~/.config/keeping-an-eye-on-the-chat/config.json`
- **Windows:** `%APPDATA%\keeping-an-eye-on-the-chat\config.json`
- **macOS:** `~/Library/Application Support/keeping-an-eye-on-the-chat/config.json`

**Solutions:**
1. ✅ Make sure you click "Start Overlay" to save
2. ✅ Check file permissions in the config directory
3. ✅ Look for `config.backup.json` if the main config is corrupted — the app restores from it
   automatically and tells you it did

Config is written to a temporary file and renamed into place, so an interrupted save cannot leave
a half-written `config.json`.
</details>

---

## 📁 Config File Format

Settings are stored in JSON format:

```json
{
  "configVersion": 1,
  "savedAt": "2024-01-15T10:30:00.000Z",
  "config": {
    "twitchChatUrl": "https://www.twitch.tv/popout/yourname/chat?popout=",
    "displaySeconds": 5,
    "overlayAnchor": "bottom-left"
  }
}
```

> 💡 **Note:** Only values that differ from defaults are saved.

---

<div align="center">

**Need help?** [Open an issue](https://github.com) | [Read the README](README.md)

</div>
