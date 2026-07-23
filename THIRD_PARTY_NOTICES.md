# Third-Party Notices

PuruPuru PNGTuber vendors the MediaPipe face-tracking runtime assets used by the optional camera tracking feature so the app does not need to execute JavaScript from external CDNs at runtime.

## Vendored libraries and model assets

### PuruPuru PNGTuber

- Project: PuruPuru PNGTuber
- Author: masa / rotejin
- Source: https://github.com/rotejin/PuruPuruPNGTuber
- License: Apache License 2.0

PuruPet Desktop is an unofficial modified work. The upstream demo character
images and favicon are intentionally excluded from the packaged desktop binary.
Any upstream samples retained in the source tree for browser-editor compatibility
remain governed by their separate asset terms in ASSET_LICENSE.md.

### Electron

- Project: Electron
- Copyright: Electron contributors; GitHub Inc.
- Source: https://github.com/electron/electron
- License: MIT License

The packaged Electron runtime also supplies `LICENSE.electron.txt` and
`LICENSES.chromium.html` alongside the executable.

### pngjs

- Project: pngjs
- Copyright: Luke Page, Kuba Niegowski, and contributors
- Source: https://github.com/pngjs/pngjs
- License: MIT License

The MIT permission notices for Electron and pngjs are retained with the
corresponding installed packages and packaged runtime license files.

### CMU Pronouncing Dictionary

- Project: CMU Pronouncing Dictionary (CMUdict)
- Provider: Carnegie Mellon University
- Source: https://github.com/cmusphinx/cmudict
- Runtime package: `cmu-pronouncing-dictionary` 3.0.0
- Package copyright: Zeke Sikelianos and contributors
- Package license: ISC License
- Dictionary terms: public domain; use is unrestricted

CMUdict supplies ARPABET pronunciations for the local English-to-Katakana
fallback used only at the text-to-speech boundary. The original displayed text
is not replaced. The ISC permission and warranty notice is retained with the
installed package.

### sherpa-onnx

- Project: sherpa-onnx
- Copyright: sherpa-onnx contributors / k2-fsa
- Source: https://github.com/k2-fsa/sherpa-onnx
- Runtime package: `sherpa-onnx-node`
- License: Apache License 2.0

The native runtime is packaged with the desktop app. Speech-recognition models
(Japanese ReazonSpeech Zipformer, Japanese NeMo Parakeet CTC, SenseVoice, and
multilingual Whisper base/tiny) are not bundled. The model selected by the user
is downloaded on demand from the official sherpa-onnx GitHub releases, verified
against its pinned SHA-256 digest, and stored in the app user-data directory.

The Silero VAD ONNX model used for neural voice activity detection is also not
bundled. It is downloaded on first use from the official sherpa-onnx release,
verified against a pinned SHA-256 digest, and stored beside the ASR models.

### MediaPipe Tasks Vision

- Project: MediaPipe Tasks Vision / Face Landmarker
- Provider: Google
- Version referenced by the app: `@mediapipe/tasks-vision@0.10.35`
- Runtime module path: `vendor/mediapipe/tasks-vision/0.10.35/vision_bundle.mjs`
- Runtime WASM path: `vendor/mediapipe/tasks-vision/0.10.35/wasm/`
- Face Landmarker model path: `vendor/mediapipe/face_landmarker/float16/face_landmarker.task`
- License: Apache License 2.0

MediaPipe assets are loaded from the local `vendor/` directory at runtime only when camera-based face tracking is used. If face tracking is not used, the core PNG avatar rendering can still run without loading MediaPipe.

Vendored MediaPipe file checksums are recorded in `vendor/mediapipe/SHASUMS256.txt`. See `docs/vendor-update.md` for verification and update notes.

## Browser and platform APIs

The app uses standard browser APIs including Canvas 2D, WebGL, MediaDevices, Web Audio, FileReader, localStorage, EventSource, and fetch.
