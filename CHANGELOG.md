# Changelog

All notable changes to PuruPet Desktop will be documented here.

## Unreleased

- Added streaming desktop chat for Codex app-server and OpenAI Responses API.
- Added Codex Realtime WebRTC voice with automatic device-recognition fallback.
- Added a compact conversation/work switch directly on the transparent avatar, with workspace-write limited to the user-selected folder.
- Added first-run ChatGPT login, character selection, and audio onboarding.
- Added per-character motion-range and display-size previews, edge snapping, position locking, and multi-monitor handling.
- Added per-character names, inferred personalities, editable speech-bubble placement, and touch reactions.
- Added idle breathing/gaze motion and 27 generated emotion/mouth assets across the three custom characters.
- Added a Codex app-server-only avatar studio that runs the bundled `$build-purupuru-avatar` Skill to turn one uploaded illustration into validated standard PNGTuber differences, a hair layer, rig anchors, and an inferred character personality.

- Enriched hair spring physics for a snappier, more elastic look (reference-video based): stiffer tip springs with lower damping ratio (★5), vertical squash-and-stretch that fans hair outward on downward head motion (★9), and an S-curve bend term that propagates head motion from root to tip as a whip-like wave (★10).
- Added the "draw a new character" feature: paint face, eye, mouth, and hair layers in the browser and auto-compose the six expression PNGs into a new character, with brush stabilization, pen pressure, zoom/pan, expression previews, and keyboard shortcuts.
- Added re-editing of drawn characters from the character menu.
- Added character deletion from the character switcher, including suppression of automatic demo character re-seeding after deletion.
- Added a one-time managed refresh so bundled character 2/3 profiles stored in the browser are re-synced to the repository default settings.
- Added the standalone drawing tool export under `standalone_drawing_avatar_export/`.
- Vendored MediaPipe Tasks Vision assets locally for camera-based face tracking.
- Changed face tracking to CPU delegate by default, limited detection to 15fps, and kept GPU as explicit opt-in via `?faceDelegate=gpu`.
- Hardened autosave, IndexedDB profile writes, OBS helper communication, SSE reconnect handling, and local-server request body handling.
- Added CI, Dependabot, security headers/guards, and regression coverage for package/import/server safety checks.
- Prepared repository structure for a future public release.
- Renamed the bundled sample character directory to `assets/demo-avatar/`.
- Added public-facing documentation, support, security, contribution, and GitHub template files.
- Switched software code and documentation text to Apache License 2.0.
- Kept bundled visual assets under a separate asset license.
