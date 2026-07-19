# Vendored dependency update notes

This project intentionally vendors runtime assets that must work under the local-only CSP.

## Verification

After changing files under `vendor/mediapipe/`, regenerate and verify SHA-256 checksums.

```bash
python scripts/verify_vendor_checksums.py
```

The checksum manifest is `vendor/mediapipe/SHASUMS256.txt`.

## MediaPipe

Current vendored runtime:

- `@mediapipe/tasks-vision@0.10.35`
- App entry: `vendor/mediapipe/tasks-vision/0.10.35/vision_bundle.mjs`
- WASM: `vendor/mediapipe/tasks-vision/0.10.35/wasm/`
- Face Landmarker model: `vendor/mediapipe/face_landmarker/float16/face_landmarker.task`

When updating, keep the app constants in `app.js` and the notices in `THIRD_PARTY_NOTICES.md` in sync.

The UI intentionally uses the operating-system font stack. Japanese webfont
subsets are not vendored because they create hundreds of tiny files and are not
required for offline operation.
