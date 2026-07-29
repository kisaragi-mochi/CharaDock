// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  EmbeddedTtsModels,
  TTS_MODELS,
  downloadVerifiedFile,
  requiredPaths,
} = require("../lib/tts-model-download.cjs");

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "charadock-tts-model-test-"));
}

function streamResponse(bytes) {
  return new Response(bytes, { status: 200 });
}

test("TTS model manifests have fixed sizes and SHA-256 values", () => {
  assert.deepEqual(Object.keys(TTS_MODELS), ["piper-plus", "supertonic-3", "irodori-webgpu", "kokoro"]);
  for (const model of Object.values(TTS_MODELS)) {
    const files = [model.runtime, model.archive, ...(model.files || [])].filter(Boolean);
    assert.equal(files.reduce((sum, file) => sum + file.bytes, 0), model.downloadBytes);
    for (const file of files) {
      assert.match(file.url, /^https:\/\//);
      assert.match(file.sha256, /^[a-f0-9]{64}$/);
      assert.ok(file.bytes > 0);
    }
  }
});

test("downloadVerifiedFile streams, hashes, and atomically stores a file", async (t) => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("verified local voice model");
  const destination = path.join(directory, "nested", "model.onnx");
  let progress = 0;
  await downloadVerifiedFile({
    fetchImpl: async () => streamResponse(bytes),
    file: {
      name: "model.onnx",
      url: "https://example.invalid/model.onnx",
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    },
    destination,
    onChunk: (value) => { progress += value; },
  });
  assert.deepEqual(fs.readFileSync(destination), bytes);
  assert.equal(progress, bytes.length);
  assert.equal(fs.existsSync(`${destination}.download`), false);
});

test("downloadVerifiedFile rejects a hash mismatch", async (t) => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("bad model");
  const destination = path.join(directory, "model.onnx");
  await assert.rejects(downloadVerifiedFile({
    fetchImpl: async () => streamResponse(bytes),
    file: {
      name: "model.onnx",
      url: "https://example.invalid/model.onnx",
      bytes: bytes.length,
      sha256: "0".repeat(64),
    },
    destination,
  }), /SHA-256/);
  assert.equal(fs.existsSync(destination), false);
});

test("managed model status only reports complete installations", (t) => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const models = new EmbeddedTtsModels(directory, { platform: "win32" });
  for (const model of Object.values(TTS_MODELS)) {
    assert.equal(models.status(model.id).installed, false);
    const destination = path.join(directory, model.directoryName);
    for (const filePath of requiredPaths(model, destination)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "test");
    }
    assert.equal(models.status(model.id).installed, true);
    assert.equal(models.status(model.id).supported, true);
  }
  const piperPaths = models.installedPaths("piper-plus");
  assert.equal(path.basename(piperPaths.executablePath), "piper.exe");
  assert.equal(path.extname(piperPaths.modelPath), ".onnx");
});

test("piper-plus automatic runtime is marked Windows-only", (t) => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const models = new EmbeddedTtsModels(directory, { platform: "linux" });
  assert.equal(models.status("piper-plus").supported, false);
  assert.equal(models.status("supertonic-3").supported, true);
  assert.equal(models.status("irodori-webgpu").supported, true);
  assert.equal(models.status("kokoro").supported, true);
});

test("stale managed downloads are cleaned without touching other folders", (t) => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const stale = path.join(directory, ".download-irodori-webgpu-1234");
  const unrelated = path.join(directory, ".download-user-backup-1234");
  fs.mkdirSync(stale, { recursive: true });
  fs.mkdirSync(unrelated, { recursive: true });
  new EmbeddedTtsModels(directory, { platform: "win32" });
  assert.equal(fs.existsSync(stale), false);
  assert.equal(fs.existsSync(unrelated), true);
});
