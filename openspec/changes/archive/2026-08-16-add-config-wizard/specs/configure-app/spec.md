## ADDED Requirements
### Requirement: Configuration Inventory Documentation
The system SHALL maintain a documented inventory of every configuration variable or parameter that affects behavior, including env vars, flags, arguments, internal toggles, modes, URLs, sizes, positions, opacity, always-on-top, shortcuts, and auto-start settings. The inventory MUST include the name, type, accepted values, default, impact, where it is read (file/source), and examples.

#### Scenario: Inventory is created and complete
- **WHEN** a new configuration item is discovered in code
- **THEN** the inventory document lists its name, type, accepted values, default, impact, read location, and example usage

### Requirement: Unified Configuration Schema
The system SHALL define a single configuration schema as the source of truth for validation, defaults, and UI metadata. The schema MUST include typing, validation rules, labels, short descriptions, category, display order, placeholders, examples, advanced flag, ranges (min/max), and enum options when applicable.

#### Scenario: Schema drives validation and UI metadata
- **WHEN** the configuration UI loads a field
- **THEN** the field metadata and validation rules are sourced from the schema

### Requirement: Deterministic Configuration Precedence
The system SHALL merge configuration sources in this exact order: (1) defaults, (2) saved config from disk, (3) env vars, (4) runtime flags or args. The effective configuration MUST be deterministic and traceable to its sources.

#### Scenario: Env overrides saved config
- **WHEN** a saved config sets TWITCH_CHAT_URL=A and ENV sets TWITCH_CHAT_URL=B
- **THEN** the effective configuration uses TWITCH_CHAT_URL=B

### Requirement: Persistence, Versioning, and Reset
The system SHALL save configuration in a human-readable JSON file in user-local storage and load it automatically on startup. The saved file MUST include a configVersion for future migrations. The UI MUST provide Save, Load, Restore Defaults, and Clear Saved Config actions, with confirmation for destructive actions.

#### Scenario: Save and auto-load on restart
- **WHEN** a user saves configuration and restarts the app
- **THEN** the configuration loads automatically and the UI is prefilled with the saved values

### Requirement: Presets and Saved Profiles
The system SHALL offer built-in presets (for example: Streamer Default, Minimal, Diagnostics, Light Overlay, Separate Window) plus a Custom Configuration option. The UI SHOULD list saved profiles when supported, including Last Used, and apply a selected preset to populate recommended values.

#### Scenario: Preset selection populates fields
- **WHEN** a user selects a preset
- **THEN** the configuration fields update to the preset values and are ready to save or start

### Requirement: Configuration UI Before Main Flow
The system MUST display a configuration window before starting the main overlay/chat flow. If saved config exists, it MUST be loaded and shown; if not, defaults are used and the required field is highlighted. The main flow MUST NOT start until validation passes.

#### Scenario: First run blocks start until required field
- **WHEN** the app starts without saved config
- **THEN** the configuration window appears and Start is blocked until TWITCH_CHAT_URL is valid

### Requirement: Required TWITCH_CHAT_URL Validation and Test
TWITCH_CHAT_URL MUST be the only required field. The UI MUST validate it as non-empty and a valid URL, provide immediate feedback, and show placeholder and example values. The UI MUST include a Test Connection action that attempts to load the URL in a webview or headless context and returns a clear success or error message.

#### Scenario: Invalid URL blocks start and test shows error
- **WHEN** TWITCH_CHAT_URL is empty or invalid
- **THEN** Start is blocked and the Test Connection result shows a readable error

### Requirement: Start, Cancel, and Dirty State Handling
The UI MUST provide Start and Cancel/Exit actions. Start MUST validate, apply the final merged config, close or hide the config window, and start the existing flow without regressions. Cancel MUST exit the app without starting. The UI MUST track dirty state and prompt on exit or start when unsaved changes exist, offering Save and Start, Start Without Saving, or Cancel.

#### Scenario: Exit prompts on unsaved changes
- **WHEN** a user modifies settings and attempts to exit
- **THEN** a confirmation prompt appears with options to save, discard, or cancel

### Requirement: Override Visibility for ENV and CLI
The UI MUST indicate fields overridden by ENV or CLI with a clear badge such as "overridden by ENV/CLI" and show the effective value used at runtime.

#### Scenario: Override badge is shown
- **WHEN** ENV or CLI overrides a saved value
- **THEN** the field shows an override badge and the effective value

### Requirement: Streamer-Focused UX and Accessibility
The configuration UI SHALL be visually clear for streamers, with a header showing app name and status, sectioned layout with icons and tooltips, and an overlay preview where applicable. Advanced options MUST be hidden by default and discoverable. The UI MUST support keyboard navigation (Tab, Shift+Tab, Enter, Esc), focus the TWITCH_CHAT_URL field on open, use consistent labels, and present clear error messages with adequate contrast.

#### Scenario: Keyboard navigation is supported
- **WHEN** a user navigates using only the keyboard
- **THEN** all controls are reachable and activation works with Enter or Esc where applicable

### Requirement: Observability and Diagnostics
The system SHALL log info, warn, and error events for configuration load, save, validation, preset application, and final effective config. Logging MUST respect any diagnostics or debug mode when enabled.

#### Scenario: Config actions are logged
- **WHEN** the configuration is loaded, saved, or fails validation
- **THEN** the system writes the corresponding log entries at the correct level

### Requirement: Storage Resilience and Backup
The system SHALL handle missing files, parse errors, permission failures, and corrupted configuration. On corruption, it MUST offer a restore defaults action and create a backup of the invalid file (for example config.bak) before overwriting.

#### Scenario: Corrupted config triggers backup
- **WHEN** the saved config JSON is invalid
- **THEN** the app reports the issue, offers restore defaults, and writes a backup of the invalid file

### Requirement: Safe Fallback if Config UI Fails
If the configuration window cannot be shown, the system MUST follow a documented fallback strategy that either starts with defaults plus a minimal prompt for TWITCH_CHAT_URL or exits with a clear error message.

#### Scenario: UI failure triggers fallback
- **WHEN** the config UI fails to open
- **THEN** the app follows the documented fallback behavior and does not hang silently
