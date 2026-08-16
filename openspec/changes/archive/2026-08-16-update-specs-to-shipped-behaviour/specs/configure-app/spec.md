## REMOVED Requirements

### Requirement: Required TWITCH_CHAT_URL Validation and Test

**Reason**: It states that TWITCH_CHAT_URL must be the only required field, which the code has
refused since v2.1.0 — `src/config/merge.ts` accepts a Twitch URL, a Kick URL, or both, and
`src/config/schema.ts` no longer marks any URL as required.

**Migration**: Replaced by *Chat Source URL Validation and Test* below, which describes the rule the
code enforces.

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Configuration UI Before Main Flow
The system MUST display a configuration window before starting the main overlay/chat flow. If saved
config exists, it MUST be loaded and shown; if not, defaults are used and the fields still needed are
highlighted. The main flow MUST NOT start until validation passes.

#### Scenario: First run blocks start until required field
- **WHEN** the app starts without saved config
- **THEN** the configuration window appears and Start is blocked until at least one chat source URL
  is valid

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
