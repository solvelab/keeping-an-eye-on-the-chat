# observe-chat Specification

## Purpose
TBD - created by archiving change add-kick-chat-source. Update Purpose after archive.
## Requirements
### Requirement: Platform-independent chat source
The system SHALL observe chat through a `ChatSource` abstraction, so that a platform is added by
implementing it rather than by editing the code that drives it.

#### Scenario: A second platform is added
- **WHEN** a new platform's chat source is implemented
- **THEN** the main process drives it through the same interface as the existing one, with no change
  to the display queue, the overlay or the dedup layers

### Requirement: Simultaneous sources
The system SHALL observe several configured chat sources at the same time, feeding one display queue.

#### Scenario: Two platforms configured
- **WHEN** a Twitch source and a Kick source are both configured
- **THEN** messages from both appear in the overlay in arrival order

#### Scenario: One source fails
- **WHEN** one source fails to attach its observer or its page fails to load
- **THEN** the other sources keep delivering messages and the failure is reported without stopping
  the overlay

### Requirement: Message origin
The system SHALL record which platform each message came from and display that origin in the
overlay.

#### Scenario: A message is displayed
- **WHEN** a message from any configured source is shown
- **THEN** the bubble indicates the platform it came from

### Requirement: Identity across sources
The system SHALL namespace message identifiers per source, so that two platforms cannot collide in
the deduplication caches.

#### Scenario: A platform provides no durable identifier
- **WHEN** a platform identifies a message only by a value that restarts when its page reloads
- **THEN** the source combines it with a token minted at attach time, so identifiers stay unique for
  the lifetime of the observation

### Requirement: Multi-source configuration
The system SHALL store chat sources as a list of platform and URL pairs, and SHALL validate each URL
against its platform's domains using suffix matching.

#### Scenario: A configuration saved by an earlier version is loaded
- **WHEN** a stored configuration holds the single `twitchChatUrl` field
- **THEN** it is migrated to a one-entry source list for Twitch, and the user is not asked to
  reconfigure

#### Scenario: A lookalike host is entered
- **WHEN** a URL's host merely contains a platform's domain as a substring
- **THEN** validation rejects it

