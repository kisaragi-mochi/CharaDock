# Security Policy

## Supported versions

This project is pre-public-release. Security fixes currently target the main working tree.

## Reporting a vulnerability

Do not open a public issue for vulnerability details.

If GitHub Private Vulnerability Reporting is enabled for this repository, use the repository **Security** tab and choose **Report a vulnerability**.

If that option is not available, contact the maintainer privately through the repository hosting platform or the maintainer contact route listed for the project.

Please include:

- Affected file or feature
- Steps to reproduce
- Expected and actual behavior
- Browser/OS information
- Any proof-of-concept, if safe to share

Do not publicly post exploit details for issues that could affect users.

## Security notes

- The desktop app uses Electron with context isolation, sandboxed renderers, sender validation, and allowlisted local files.
- OpenAI API keys are kept out of renderer windows and use the operating-system credential store when Electron encryption is available.
- ChatGPT authentication is managed by Codex CLI; PuruPet does not receive the ChatGPT token.
- Conversation mode starts Codex read-only. Work mode grants workspace-write only to the folder explicitly selected by the user.
- Codex Realtime sends microphone audio to OpenAI through Codex app-server when active. OpenAI transcription also uploads the recorded clip when selected.
- OBS helper APIs are intended for `127.0.0.1` / `localhost` use.
- OBS helper API requests are restricted to trusted local Host / Origin / Referer values.
- The local server does not add CORS allow headers for OBS helper APIs.
- OBS snapshots may contain user avatar images, item images, and settings. Treat them as user data.
- DNS rebinding protections for local OBS helper APIs are covered by regression tests.
- The local server sends CSP and Permissions-Policy headers.
- Camera tracking and microphone lip-sync levels are processed locally. Network-backed speech recognition and AI voice features are identified in the UI.
- MediaPipe face tracking assets are vendored under `vendor/mediapipe/` and loaded locally at runtime; no external CDN is used.
