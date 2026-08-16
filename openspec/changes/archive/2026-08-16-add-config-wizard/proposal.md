# Change: Configuration Wizard, Schema, and Persistence

## Why
The app currently relies on many env vars and runtime flags, which makes first time setup error prone for streamers. We need a guided configuration experience with safe defaults, a single source of truth, and persistent settings so the app starts reliably without breaking the existing flow.

## What Changes
- Add a configuration UI that appears before the main flow, with presets, validation, and advanced options hidden by default.
- Introduce a unified config schema with validation and UI metadata as the source of truth.
- Add deterministic configuration merge precedence: defaults -> saved -> env -> runtime flags.
- Add save/load with schema versioning, last used config auto load, and resilience on corruption.
- Add required field handling for TWITCH_CHAT_URL with a test connection action.
- Document a full inventory of all configuration variables and parameters that affect behavior.

## Impact
- Affected specs: configure-app (new)
- Affected code:
  - scripts/[city]/[MODULO]/main.(js/ts)
  - scripts/[city]/[MODULO]/bootstrap.(js/ts)
  - scripts/[city]/[MODULO]/config/config-schema.(js/ts)
  - scripts/[city]/[MODULO]/config/config-defaults.(js/ts)
  - scripts/[city]/[MODULO]/config/config-store.(js/ts)
  - scripts/[city]/[MODULO]/config/config-merge.(js/ts)
  - scripts/[city]/[MODULO]/ui/config/ConfigWindow.(js/ts)
  - scripts/[city]/[MODULO]/ui/config/components/
