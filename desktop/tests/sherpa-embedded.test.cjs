// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  DEFAULT_SHERPA_MODEL_ID, EmbeddedSherpaOnnx, REQUIRED_MODEL_FILES, SHERPA_MODEL, SHERPA_MODELS,
} = require("../lib/sherpa-embedded.cjs");

test("embedded sherpa model is optional and reports installation state", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-sherpa-"));
  const manager = new EmbeddedSherpaOnnx(base, { modelId: "whisper-tiny-multilingual-int8" });
  assert.equal(manager.status().installed, false);
  assert.match(manager.runtimeInfo().version, /^1\./);
  assert.equal(DEFAULT_SHERPA_MODEL_ID, "reazonspeech-ja-int8");
  assert.equal(SHERPA_MODEL.archiveBytes, 713_097_333);
  assert.match(SHERPA_MODEL.downloadUrl, /^https:\/\/github\.com\/k2-fsa\/sherpa-onnx\/releases\//);
  assert.match(SHERPA_MODEL.sha256, /^[a-f0-9]{64}$/);
  assert.equal(manager.status().models.length, 5);
  fs.mkdirSync(manager.modelDirectory, { recursive: true });
  for (const file of REQUIRED_MODEL_FILES) fs.writeFileSync(path.join(manager.modelDirectory, file), "test");
  assert.equal(manager.status().installed, true);
  assert.equal(manager.remove().installed, false);
});

test("embedded sherpa switches between Japanese model configurations", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-sherpa-"));
  const manager = new EmbeddedSherpaOnnx(base);
  assert.equal(manager.status().modelId, "reazonspeech-ja-int8");
  assert.ok(manager.recognizerConfig(SHERPA_MODELS["reazonspeech-ja-int8"]).modelConfig.transducer);
  assert.equal(manager.recognizerConfig(SHERPA_MODELS["sensevoice-ja-int8"]).modelConfig.senseVoice.language, "ja");
  assert.equal(manager.recognizerConfig(SHERPA_MODELS["sensevoice-ja-int8"]).modelConfig.senseVoice.useInverseTextNormalization, 1);
  assert.ok(manager.recognizerConfig(SHERPA_MODELS["nemo-parakeet-ja-int8"]).modelConfig.nemoCtc);
  manager.selectModel("whisper-base-multilingual-int8");
  assert.equal(manager.status().modelId, "whisper-base-multilingual-int8");
  assert.equal(manager.recognizerConfig(SHERPA_MODELS[manager.modelId]).modelConfig.whisper.language, "ja");
  assert.throws(() => manager.selectModel("unknown"), /対応していない/);
});

test("embedded sherpa rejects transcription until the optional model is installed", async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-sherpa-"));
  const manager = new EmbeddedSherpaOnnx(base);
  await assert.rejects(
    manager.transcribe({ samples: new Float32Array([0.1, 0.2]), sampleRate: 16_000 }),
    /未ダウンロード/,
  );
});
