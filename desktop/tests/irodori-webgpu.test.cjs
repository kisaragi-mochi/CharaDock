// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { IRODORI_CHUNK_LENGTH, MODEL_NAMES, irodoriModelStatus, resolveIrodoriModelDirectory, splitIrodoriText, validateIrodoriModelDirectory } = require("../lib/irodori-webgpu.cjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "purupet-irodori-"));
  const models = path.join(root, "onnx_fp16");
  const tokenizer = path.join(root, "tokenizer", "llmjp_tok");
  fs.mkdirSync(models, { recursive: true });
  fs.mkdirSync(tokenizer, { recursive: true });
  for (const name of MODEL_NAMES) {
    fs.writeFileSync(path.join(models, `${name}.onnx`), name);
    fs.writeFileSync(path.join(models, `${name}.onnx.data`), name);
  }
  fs.writeFileSync(path.join(tokenizer, "tokenizer.json"), "{}");
  fs.writeFileSync(path.join(tokenizer, "tokenizer_config.json"), "{}");
  return root;
}

test("Irodori recognizes the official FP16 artifact layout", () => {
  const root = fixture();
  const resolved = resolveIrodoriModelDirectory(root);
  assert.equal(resolved.models, path.join(root, "onnx_fp16"));
  assert.equal(validateIrodoriModelDirectory(root), root);
  assert.equal(irodoriModelStatus(root).modelReady, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("Irodori remains unavailable until model, tokenizer, and reference WAV are present", () => {
  const root = fixture();
  const reference = path.join(root, "voice.wav");
  assert.equal(irodoriModelStatus(root, reference).ready, false);
  fs.writeFileSync(reference, "RIFF");
  assert.equal(irodoriModelStatus(root, reference).ready, true);
  fs.rmSync(path.join(root, "tokenizer", "llmjp_tok", "tokenizer.json"));
  assert.equal(irodoriModelStatus(root, reference).modelReady, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("Irodori splits long Japanese text at punctuation into short inference chunks", () => {
  const chunks = splitIrodoriText("最初の文章です。次の文章は少し長いので、自然な読点でも区切れるようにします。".repeat(8));
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.length <= IRODORI_CHUNK_LENGTH));
  assert.match(chunks[0], /。$/);
});

test("Irodori keeps short sentences in separate inference chunks", () => {
  assert.deepEqual(splitIrodoriText("今日は晴れです。明日は雨です！でも出かけます？"), [
    "今日は晴れです。",
    "明日は雨です！",
    "でも出かけます？",
  ]);
});
