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
