# observe-chat Specification

## Purpose
How the app reads chat. It observes a platform's public popout chat page in a hidden window and
turns DOM rows into messages for the overlay — there is no platform API and no authentication.

Several platforms can be watched at once, feeding one display queue, and each is added by
implementing a chat source rather than by editing the code that drives them.
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
The system SHALL hold one URL field per supported platform, named after that platform, and SHALL
validate each against its platform's domains using suffix matching. A field left empty means that
platform is not observed.

#### Scenario: A configuration saved by an earlier version is loaded
- **WHEN** a stored configuration holds only the `twitchChatUrl` field, written before a second
  platform existed
- **THEN** it loads unchanged and stays valid, with the platforms it does not name simply not
  observed, and the user is not asked to reconfigure

#### Scenario: A lookalike host is entered
- **WHEN** a URL's host merely contains a platform's domain as a substring
- **THEN** validation rejects it

### Requirement: Observation can be stopped and resumed
The system SHALL let the user stop observing chat and resume it later without ending the
application. Stopping MUST release every page the sources hold; resuming MUST reuse the configuration
already in effect rather than asking for it again.

#### Scenario: Observation is stopped
- **WHEN** the user stops the overlay from the system tray
- **THEN** every chat source stops and its hidden page is released, and the application keeps running

#### Scenario: Observation is resumed
- **WHEN** the user starts the overlay again after stopping it
- **THEN** the previously resolved configuration is used and messages flow again, with no
  reconfiguration step

