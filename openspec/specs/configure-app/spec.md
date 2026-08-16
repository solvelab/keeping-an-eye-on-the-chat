# configure-app Specification

## Purpose

How the application is configured: where every setting is declared, how values from different
sources are resolved into one configuration, how they are validated and persisted, and how the
configuration wizard presents them.

The capability exists because the app was originally configured only through environment variables,
which made it unusable for its actual audience — streamers, not developers. It now ships a wizard
that opens before the overlay, while keeping the environment path working for anyone scripting a
launch.

The single source of truth is `src/config/schema.ts`: every field's type, default, validation rule,
environment variable name and UI metadata live there, and everything else in this capability reads
from it.
## Requirements
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
The system MUST display a configuration window before starting the main overlay/chat flow. If saved
config exists, it MUST be loaded and shown; if not, defaults are used and the fields still needed are
highlighted. The main flow MUST NOT start until validation passes.

#### Scenario: First run blocks start until required field
- **WHEN** the app starts without saved config
- **THEN** the configuration window appears and Start is blocked until at least one chat source URL
  is valid

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
The configuration UI SHALL be visually clear for streamers, with a header showing app name and
status, and a sectioned layout with icons and tooltips. The sections holding the settings a streamer
changes first MUST be open on arrival; advanced options MUST be collapsed but discoverable. A setting
whose effect is visual MUST be previewable from the UI rather than described only in words. The UI
MUST support keyboard navigation (Tab, Shift+Tab, Enter, Esc), focus the first chat source field on
open, use consistent labels, and present clear error messages with adequate contrast.

#### Scenario: Keyboard navigation is supported
- **WHEN** a user navigates using only the keyboard
- **THEN** all controls are reachable and activation works with Enter or Esc where applicable

#### Scenario: A visual setting is discoverable
- **WHEN** the configuration window opens for the first time
- **THEN** the settings that change the overlay's appearance are visible without expanding a section

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

### Requirement: Chat Source URL Validation and Test
At least one chat source URL MUST be configured. A Twitch URL alone, a Kick URL alone, or both MUST
satisfy validation; neither field is required on its own. Each URL MUST be validated as a well-formed
URL whose host belongs to that platform by suffix match, with immediate feedback, a placeholder and
an example. Each URL field MUST offer its own Test action that loads the URL and returns a readable
success or error.

#### Scenario: Only one platform is configured
- **WHEN** a Kick URL is entered and the Twitch URL is left empty
- **THEN** the configuration is valid and Start is enabled

#### Scenario: No platform is configured
- **WHEN** both URL fields are empty
- **THEN** Start is blocked and the same message is shown on both fields, naming both platforms

#### Scenario: A lookalike host is entered
- **WHEN** a URL's host merely contains a platform's domain as a substring
- **THEN** validation rejects it and Start stays blocked

### Requirement: Author Name Presentation
The system SHALL let the streamer choose how a chatter's name is set apart from their message, from a
fixed set of designed treatments, and SHALL default to one that is legible without being loud. The
name and the message MUST never render touching, in any treatment.

#### Scenario: A treatment is chosen
- **WHEN** the streamer selects a different treatment and starts the overlay
- **THEN** the bubble renders the name in that treatment

#### Scenario: A configuration predates the setting
- **WHEN** a stored configuration has no author-style value
- **THEN** the default treatment is used and the configuration stays valid

#### Scenario: A long unbroken name is displayed
- **WHEN** a name of the maximum length the platforms allow contains no spaces
- **THEN** it wraps rather than widening the bubble, and does not collide with the origin indicator

### Requirement: Bubble Preview In The Configuration UI
The configuration UI SHALL show a live preview of the speech bubble alongside the settings that
change its appearance, so a visual choice is made by looking rather than by reading a description.
The preview MUST be rendered with the overlay's own styles, so that it cannot diverge from what the
overlay draws.

#### Scenario: A setting that changes the bubble is edited
- **WHEN** the author-name treatment or the bubble width is changed
- **THEN** the preview updates immediately, without starting the overlay

#### Scenario: The overlay's styling changes
- **WHEN** a bubble style is changed in the overlay's stylesheet
- **THEN** the preview changes with it, because it is styled by that same stylesheet

#### Scenario: The stress case is inspected
- **WHEN** the streamer asks the preview for a long name
- **THEN** the preview shows the longest name the platforms allow, so the layout can be judged before
  going live

