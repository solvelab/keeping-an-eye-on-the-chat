# [2.2.0](https://github.com/solvelab/keeping-an-eye-on-the-chat/compare/v2.1.1...v2.2.0) (2026-08-16)


### Features

* **overlay:** let the streamer choose how the author's name is styled ([#48](https://github.com/solvelab/keeping-an-eye-on-the-chat/issues/48)) ([a8040de](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/a8040de3d2c722d8613377b521dd8007d23489ce))

## [2.1.1](https://github.com/solvelab/keeping-an-eye-on-the-chat/compare/v2.1.0...v2.1.1) (2026-08-16)


### Bug Fixes

* **tray:** stop and restart the overlay without quitting the app ([#47](https://github.com/solvelab/keeping-an-eye-on-the-chat/issues/47)) ([074c761](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/074c761ed01ea7c4fd5dd3f6f08e4f00e9bf6279))

# [2.1.0](https://github.com/solvelab/keeping-an-eye-on-the-chat/compare/v2.0.1...v2.1.0) (2026-08-16)


### Features

* **chat:** observe Kick chat alongside Twitch ([#43](https://github.com/solvelab/keeping-an-eye-on-the-chat/issues/43)) ([b0d4cb4](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/b0d4cb44a3904ca544e5b3d2815cba095f7d771b))

## [2.0.1](https://github.com/solvelab/keeping-an-eye-on-the-chat/compare/v2.0.0...v2.0.1) (2026-08-16)


### Bug Fixes

* **config:** make the "Default" preset restore the stock timing ([a864d30](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/a864d30df5f7c4d177eb3945c89a38571a9e25ed))
* **release:** recognise gitmoji-prefixed commits when computing releases ([2d7f685](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/2d7f68574630640d116f51e277c1d03991325100))
* **release:** reject prose that the changelog parser reads as a version bump marker ([bc25d08](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/bc25d08dc970c7dbea9afc643488ad054d7b372b))

# [2.0.0](https://github.com/solvelab/keeping-an-eye-on-the-chat/compare/v1.1.2...v2.0.0) (2026-08-16)

> ⚠️ **Not a breaking release.** The major bump was an accident: a commit body wrapped the words
> *"breaking change"* onto the start of a line, and the changelog parser reads that as a
> `BREAKING CHANGE` footer regardless of case or punctuation. The correct version was **1.2.0**.
> Nothing here changes a configuration format, an IPC contract or an artifact name. The tag stays as
> published; the guard that prevents a repeat is #31.
>
> These notes were rewritten by hand, because the accidental footer swallowed the generated body.

A full review sweep of the codebase: thirteen issues found, fixed, tested and merged.

### Bug Fixes

* **config:** store `displayId` as a number so monitor selection works ([3c3a4a0](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/3c3a4a0)) — the wizard stored a `<select>` value as a string and the main process compared it with `===` against a numeric `Display.id`, so the overlay always fell back to the primary monitor
* **packaging:** launch `EyeOnChat.exe` from the Windows batch files ([26d0bdb](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/26d0bdb)) — the shipped launchers called an executable no release contains
* **release:** bump `package.json` on release instead of patching it in CI ([cc5a702](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/cc5a702)) — the version had been stuck at `0.0.0` since v1.0.0, so local builds produced unversioned artifacts
* **config:** stop Test Connection failing on subframe load errors ([313d814](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/313d814)) — one blocked ad frame reported "Connection failed" for a page that had loaded fine
* **overlay:** keep tray mute state in sync across overlay restarts ([1cc5abf](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/1cc5abf)) — muting then restarting from Settings brought the sound back while the menu still offered "Unmute"
* **config:** apply presets without wiping the Twitch URL and language ([f612933](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/f612933)) — selecting a preset erased the one required field
* **overlay:** contain failures in the display sequence ([da133ef](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/da133ef)) — a throwing animation callback froze the overlay permanently, silently, mid-stream
* **security:** match `twitch.tv` by suffix, add an overlay CSP, write config atomically ([b699702](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/b699702)) — `hostname.includes('twitch.tv')` accepted lookalike hosts

### Performance

* **overlay:** bound the message deduplication caches ([20709b1](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/20709b1)) — both processes retained every message id for the life of the stream

### Internal

* **test:** unit suite for the configuration layer and display controller, 145 tests, no new dependency ([ccb0674](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/ccb0674), [1a82d46](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/1a82d46))
* **ci:** the "Lint" job now lints; actions pinned to commit SHAs; packaging drift guarded ([70a5170](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/70a5170))
* **refactor:** remove dead code and align config types with runtime ([7fb4dd4](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/7fb4dd4))
* **docs:** correct the drift across README, docs and openspec ([de055a4](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/de055a4))

### Upgrade notes

None. Existing `config.json` files keep working — the `displayId` fix deliberately accepts the
string value written by earlier versions, so no monitor needs to be reselected.


## [1.1.2](https://github.com/solvelab/keeping-an-eye-on-the-chat/compare/v1.1.1...v1.1.2) (2026-03-31)


### Bug Fixes

* **ci:** add persist-credentials false for semantic-release ([729b73f](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/729b73fa442a9ba64be0d0c708e661d2d572bb2e))
* **ci:** set repositoryUrl for semantic-release GitHub URL match ([9ddf3af](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/9ddf3afe7970893439c417eba56d632b45ca7adb))
* **ci:** update repository URLs from didevlab to solvelab org ([e390cfe](https://github.com/solvelab/keeping-an-eye-on-the-chat/commit/e390cfee19e6643b4a45ef17868ef232edc50047))

## [1.1.1](https://github.com/didevlab/keeping-an-eye-on-the-chat/compare/v1.1.0...v1.1.1) (2026-01-02)


### Bug Fixes

* improve Windows icon handling in configWindow ([f07d86e](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/f07d86e1551496f924964cb84f0ad93dd7a4a59d))

# [1.1.0](https://github.com/didevlab/keeping-an-eye-on-the-chat/compare/v1.0.0...v1.1.0) (2026-01-02)


### Features

* add Windows icon support and update asset copying ([031fbd2](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/031fbd234b9ed8c6c61d6d9f8fa51e547e516b0a))

# 1.0.0 (2026-01-02)


### Bug Fixes

* **ci:** checkout release tag to get correct version in build artifacts ([75e62e4](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/75e62e479046db5cdeae8b24c5f9a3b437007199))
* **ci:** disable electron-builder auto-publish to avoid GH_TOKEN error ([ac1305f](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/ac1305f733b875939b100dc922467399fb7d800e))
* **ci:** set version in package.json before building artifacts ([309f38d](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/309f38df2e607a6e698caf66045025b05d0ad1de))
* **ci:** use master branch instead of main for workflows ([ba0edf5](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/ba0edf579772fd43daf3cdc6702d54ef979b1960))
* remove invalid Windows characters from filenames ([3dd7b5a](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/3dd7b5a3e5286dc3c26209734384b57102b1fa78))


### Features

* initial release v1.0.0 ([d6d3891](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/d6d3891ad30d34ae81470291265e622f127b7f3e))
* initial release with animated avatar chat overlay ([7e59f1f](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/7e59f1ff85be98666bd59f63bdfb8c816b7f70e6))
* **release:** add multi-display, attention pause, donate button ([6a15eaa](https://github.com/didevlab/keeping-an-eye-on-the-chat/commit/6a15eaa0f311d6bf7d97156baaec3dde07bdd4c1))


### BREAKING CHANGES

* **release:** Build artifacts renamed from "Keeping.an.Eye.on.the.Chat" to "EyeOnChat"

Features:
- Multi-display support for overlay positioning
- Avatar attention pause before speaking (configurable)
- Donate button in README and Configuration Wizard
- Fix overlay duplication when reopening settings

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
