// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  KOKORO_VOICES,
  MODEL_FILES,
  kokoroModelStatus,
  normalizeKokoroVoice,
  validateKokoroModelDirectory,
} = require("../lib/kokoro-webgpu.cjs");

test("Kokoro exposes the five Japanese voices", () => {
  assert.deepEqual(KOKORO_VOICES.map((voice) => voice.id), [
    "jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo",
  ]);
  assert.equal(normalizeKokoroVoice("jm_kumo"), "jm_kumo");
  assert.equal(normalizeKokoroVoice("unknown"), "jf_alpha");
});

test("Kokoro model validation requires GPU, CPU, and Japanese voice files", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-kokoro-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.equal(validateKokoroModelDirectory(directory).ready, false);
  for (const relativePath of MODEL_FILES) {
    const filePath = path.join(directory, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "test");
  }
  assert.equal(validateKokoroModelDirectory(directory).ready, true);
  assert.equal(kokoroModelStatus(directory, true).webgpuAvailable, true);
});

test("Kokoro initializes the large Japanese G2P WASM asynchronously", () => {
  const preload = fs.readFileSync(path.join(__dirname, "..", "preload-kokoro.cjs"), "utf8");
  assert.match(preload, /await wasmModule\.default\(/);
  assert.doesNotMatch(preload, /wasmModule\.initSync|new WebAssembly\.Module/);
});

test("desktop playback remains allowed after delayed local TTS generation", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
  assert.match(main, /appendSwitch\("autoplay-policy", "no-user-gesture-required"\)/);
});

test("Kokoro downloads WebGPU output and falls back when the GPU returns silence", () => {
  const preload = fs.readFileSync(path.join(__dirname, "..", "preload-kokoro.cjs"), "utf8");
  assert.match(preload, /output\.waveform\?\.getData\?\.\(true\)/);
  assert.match(preload, /KOKORO_SILENT_WEBGPU/);
  assert.match(preload, /!Number\.isFinite\(sample\)/);
  assert.match(preload, /disabledWebGpuRoots\.add\(engine\.root\)/);
  const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
  assert.match(main, /payload\.fallbackFrom === "webgpu"/);
  assert.match(main, /preferences\.patch\(\{ kokoroDevice: "wasm" \}\)/);
});
