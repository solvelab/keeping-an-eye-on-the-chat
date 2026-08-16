## Context
The app is stable after migration but relies on many env vars and flags to configure behavior. Streamers need a guided setup experience with persistence and minimal risk of regressions. The change spans config schema, merge logic, persistence, and UI, so decisions should be documented up front.

## Goals / Non-Goals
- Goals:
  - Provide a single source of truth configuration schema that drives validation and UI metadata.
  - Add a pre-start configuration UI with presets and a clear required field for TWITCH_CHAT_URL.
  - Persist config in user-local storage and auto-load on startup with deterministic merge precedence.
  - Preserve the existing overlay/chat flow once Start is pressed.
- Non-Goals:
  - Changing existing overlay or chat functionality beyond configuration inputs.
  - Introducing new external services or remote storage.

## Decisions
- Decision: Use a single-screen configuration UI with sectioned panels (Basic, Overlay, Performance, Advanced) and a default "Advanced" collapse.
  - Why: Faster to build, easier to scan than a multi-step wizard, still meets UX requirements.
  - Alternative: Multi-step wizard with back/next flow.

- Decision: Store configuration in user-local app data (for example app.getPath('userData')) as JSON with a configVersion key.
  - Why: Aligns with desktop app expectations and enables migrations.

- Decision: Implement config schema as a typed object in config-schema.(js/ts) that includes validation and UI metadata.
  - Why: Keeps schema close to config system and enables static typing.

- Decision: Merge precedence is defaults -> saved -> env -> runtime flags, with per-field source tracking to show override badges.
  - Why: Matches requirement and enables traceability in the UI.

- Decision: Test Connection uses a hidden webview or headless window with a timeout and surfacing of network or load errors.
  - Why: Validates URLs without disrupting the user experience.

- Decision: Fallback behavior when the config UI fails:
  - If TWITCH_CHAT_URL is provided via env or CLI, start with merged config and log a warning.
  - Otherwise, exit with a clear error message indicating configuration is required.

## Risks / Trade-offs
- Risk: Adding a pre-start UI can delay startup or fail on headless environments.
  - Mitigation: Allow env/CLI overrides and fallback behavior; keep UI lightweight.

- Risk: Incomplete inventory of existing configuration sources.
  - Mitigation: Use code search across scripts/ and config/ and require inventory doc updates in PR reviews.

- Risk: Schema drift between UI and runtime.
  - Mitigation: Single schema source of truth and tests that validate merges against schema.

## Migration Plan
1. Inventory all configuration sources and document them.
2. Implement config schema and defaults, then config store and merge logic.
3. Integrate config window before the main flow, wired to the schema.
4. Add presets, dirty state, and persistence UI actions.
5. Add logging, error handling, and fallback behavior.
6. Validate behavior with the acceptance criteria and test plan.

## Open Questions
- Should presets be hardcoded in config-defaults.(js/ts) or stored in a separate presets file?
- Do we need a separate UI for managing multiple saved profiles, or only "Last used" for MVP?
- Should the Test Connection action be optional behind a feature flag for environments without a webview?
