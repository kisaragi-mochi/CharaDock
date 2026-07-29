# Third-Party Notices

PuruPuru PNGTuber vendors the MediaPipe face-tracking runtime assets used by the optional camera tracking feature so the app does not need to execute JavaScript from external CDNs at runtime.

## Vendored libraries and model assets

### PuruPuru PNGTuber

- Project: PuruPuru PNGTuber
- Author: masa / rotejin
- Source: https://github.com/rotejin/PuruPuruPNGTuber
- License: Apache License 2.0

CharaDock is an unofficial modified work. The upstream demo character
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

### BudouX

- Project: BudouX
- Copyright: Google LLC
- Source: https://github.com/google/budoux
- Runtime package: `budoux` 0.7.0
- License: Apache License 2.0

The Japanese phrase segmenter is used locally to choose natural text-to-speech
chunk boundaries. Its model and parser remain inside the packaged application;
no response text is sent to an additional service.

### piper-plus (optional external runtime)

- Project: piper-plus
- Author: ayutaz and contributors
- Source: https://github.com/ayutaz/piper-plus
- License: MIT License

piper-plus's MIT-licensed multilingual WebAssembly G2P runtime is bundled for
Japanese phonemization. The native piper-plus executable and voice models are
not bundled. On Windows, the user may choose to download the pinned official
`piper-windows-x64.zip` runtime and Tsukuyomi-chan FP16 model from their original
distribution servers. Each file is verified against a fixed SHA-256 digest and
stored in the app user-data directory. A separately obtained compatible runtime
and voice model can still be selected manually.

The optional sample voice is based on the Tsukuyomi-chan Corpus. Its required
credit and use restrictions are shown prominently in the model download UI:

> 本ソフトウェアの音声合成には、フリー素材キャラクター「つくよみちゃん」（© Rei Yumesaki）が無料公開している音声データを使用しています。
>
> ■つくよみちゃんコーパス（CV.夢前黎）
> https://tyc.rei-yumesaki.net/material/corpus/

The corpus terms prohibit using this voice for attacks or criticism of people,
calls to support or oppose political positions, religions, or ideologies,
publication of strong content without appropriate zoning, or publication that
permits the generated audio to be reused as material. The complete current
terms at the URL above control.

### Kokoro 82M (optional model)

- Project: Kokoro
- Author: hexgrad and contributors
- Source: https://github.com/hexgrad/kokoro
- Model: https://huggingface.co/hexgrad/Kokoro-82M
- License: Apache License 2.0

Kokoro model and Japanese voice files are not bundled. The user may download
the pinned q8 ONNX WebGPU/CPU files and five Japanese voice style files from
the original model repository. Every file is verified against a fixed SHA-256
digest and stored in the app user-data directory. Inference and Japanese G2P
then run locally.

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

Supertonic 3 model files are not bundled. The user may download the official
sherpa-onnx int8 archive on demand; it is verified against a pinned SHA-256
digest and stored in the app user-data directory. The model archive includes
the Supertonic 3 MIT license and copyright notice (Copyright (c) 2025 Supertone
Inc.).

### Irodori TTS WebGPU runtime

- Project: irodori-tts-webgpu
- Copyright: 2026 NOGUCHI Shoji
- Source: https://github.com/ngc-shj/irodori-tts-webgpu
- License: MIT License

CharaDock includes a modified, environment-specific copy of the inference core.
The MIT copyright and permission notice are retained in the vendored source.
Irodori model files and reference audio are not bundled. The user may download
only the required FP16 ONNX artifacts and tokenizer from the original model
repository; every file is pinned to one repository commit and verified against
its SHA-256 digest. The user selects a consented reference WAV from local
storage and inference stays on the device. The upstream model/runtime notice
identifies Irodori-TTS and Semantic-DACVAE weights as MIT and the llm-jp
tokenizer as Apache-2.0. Voice cloning or impersonation without explicit
consent, deepfakes, and misleading speech are prohibited by the ethical-use
notice carried from the model card.

### ONNX Runtime Web

- Project: ONNX Runtime
- Provider: Microsoft
- Source: https://github.com/microsoft/onnxruntime
- Runtime package: `onnxruntime-web` 1.27.0
- License: MIT License

### Tokenizers.js

- Project: Tokenizers.js
- Provider: Hugging Face
- Source: https://github.com/huggingface/tokenizers.js
- Runtime package: `@huggingface/tokenizers` 0.1.3
- License: Apache License 2.0

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
