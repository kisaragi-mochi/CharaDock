// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { ttsSetupGuidance } = require("../lib/tts-readiness.cjs");

test("TTS readiness gives an actionable download-or-change message for missing models", () => {
  assert.match(ttsSetupGuidance("supertonic-3", { ready: false }, "ja"), /サンプルをダウンロード.*音声方式を変更/);
  assert.match(ttsSetupGuidance("irodori-webgpu", { modelReady: false }, "en"), /Download FP16 model.*another voice method/);
  assert.equal(ttsSetupGuidance("kokoro", { ready: true }, "ja"), "");
});

test("Irodori readiness distinguishes reference audio and WebGPU problems", () => {
  assert.match(ttsSetupGuidance("irodori-webgpu", { modelReady: true, referenceReady: false }, "ja"), /参照音声/);
  assert.match(ttsSetupGuidance("irodori-webgpu", { modelReady: true, referenceReady: true, webgpuAvailable: false }, "en"), /WebGPU/);
});
