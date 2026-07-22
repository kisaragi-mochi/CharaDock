// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { SILERO_VAD_MODEL, SILERO_VAD_PROFILES } = require("../lib/sherpa-vad.cjs");

test("Silero VAD uses the verified official sherpa-onnx model", () => {
  assert.equal(SILERO_VAD_MODEL.bytes, 643_854);
  assert.match(SILERO_VAD_MODEL.downloadUrl, /^https:\/\/github\.com\/k2-fsa\/sherpa-onnx\/releases\/download\/asr-models\//);
  assert.match(SILERO_VAD_MODEL.sha256, /^[a-f0-9]{64}$/);
});

test("Silero VAD sensitivity raises the speech threshold in noisy environments", () => {
  assert.ok(SILERO_VAD_PROFILES.low.threshold > SILERO_VAD_PROFILES.normal.threshold);
  assert.ok(SILERO_VAD_PROFILES.normal.threshold > SILERO_VAD_PROFILES.high.threshold);
  assert.ok(SILERO_VAD_PROFILES.low.minSilenceDuration > SILERO_VAD_PROFILES.high.minSilenceDuration);
});
