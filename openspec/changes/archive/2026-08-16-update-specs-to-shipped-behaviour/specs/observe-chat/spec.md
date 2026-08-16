## MODIFIED Requirements

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

## ADDED Requirements

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
