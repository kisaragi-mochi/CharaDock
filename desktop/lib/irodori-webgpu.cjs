// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { splitTtsText } = require("./style-bert-vits2.cjs");

const IRODORI_CHUNK_LENGTH = 48;
const IRODORI_FIRST_CHUNK_LENGTH = 24;
const IRODORI_MAX_CHUNKS = 24;

const MODEL_NAMES = Object.freeze([
  "text_encoder",
  "speaker_encoder",
  "duration",
  "dit",
  "dacvae_decoder",
  "dacvae_encoder",
]);

function isFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function hasModels(directory) {
  return MODEL_NAMES.every((name) => isFile(path.join(directory, `${name}.onnx`)) && isFile(path.join(directory, `${name}.onnx.data`)));
}

function resolveIrodoriModelDirectory(directory) {
  const root = path.resolve(String(directory || "."));
  if (hasModels(root)) return { root, models: root, tokenizer: path.join(root, "tokenizer", "llmjp_tok") };
  const fp16 = path.join(root, "onnx_fp16");
  if (hasModels(fp16)) return { root, models: fp16, tokenizer: path.join(root, "tokenizer", "llmjp_tok") };
  const artifactsFp16 = path.join(root, "artifacts", "onnx_fp16");
  if (hasModels(artifactsFp16)) return { root, models: artifactsFp16, tokenizer: path.join(root, "tokenizer", "llmjp_tok") };
  return { root, models: fp16, tokenizer: path.join(root, "tokenizer", "llmjp_tok") };
}

function irodoriModelStatus(directory, referenceAudioPath = "", webgpuAvailable = null) {
  const resolved = directory ? resolveIrodoriModelDirectory(directory) : { root: "", models: "", tokenizer: "" };
  const missingFiles = resolved.models
    ? MODEL_NAMES.flatMap((name) => [`${name}.onnx`, `${name}.onnx.data`]).filter((name) => !isFile(path.join(resolved.models, name)))
    : MODEL_NAMES.flatMap((name) => [`${name}.onnx`, `${name}.onnx.data`]);
  const tokenizerReady = Boolean(resolved.tokenizer)
    && isFile(path.join(resolved.tokenizer, "tokenizer.json"))
    && isFile(path.join(resolved.tokenizer, "tokenizer_config.json"));
  const referenceReady = isFile(referenceAudioPath) && path.extname(referenceAudioPath).toLowerCase() === ".wav";
  return {
    ready: Boolean(resolved.root) && missingFiles.length === 0 && tokenizerReady && referenceReady,
    modelReady: Boolean(resolved.root) && missingFiles.length === 0 && tokenizerReady,
    referenceReady,
    directoryName: resolved.root ? path.basename(resolved.root) : "",
    referenceName: referenceReady ? path.basename(referenceAudioPath) : "",
    missingFiles,
    tokenizerReady,
    webgpuAvailable,
  };
}

function validateIrodoriModelDirectory(directory) {
  const resolved = resolveIrodoriModelDirectory(directory);
  const status = irodoriModelStatus(resolved.root);
  if (!status.modelReady) {
    const detail = !status.tokenizerReady ? "tokenizer/llmjp_tok/{tokenizer.json, tokenizer_config.json}" : status.missingFiles.slice(0, 3).join(", ");
    throw new Error(`Irodori TTSのFP16モデル一式が揃っていません（不足: ${detail}）。`);
  }
  return resolved.root;
}

function validateIrodoriReferenceAudio(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  if (!isFile(resolved) || path.extname(resolved).toLowerCase() !== ".wav") {
    throw new Error("Irodori TTSの参照音声はWAVファイルを選択してください。");
  }
  return resolved;
}

function splitIrodoriText(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim().slice(0, IRODORI_CHUNK_LENGTH * IRODORI_MAX_CHUNKS);
  if (!normalized) return [];
  const sentences = [];
  let start = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    if (!/[。！？!?]/u.test(normalized[index])) continue;
    let end = index + 1;
    while (end < normalized.length && /[。！？!?]/u.test(normalized[end])) end += 1;
    while (end < normalized.length && /[」』】）)\]"'”’]/u.test(normalized[end])) end += 1;
    const sentence = normalized.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
    index = end - 1;
  }
  const remainder = normalized.slice(start).trim();
  if (remainder) sentences.push(remainder);

  const chunks = [];
  for (const sentence of sentences) {
    if (chunks.length >= IRODORI_MAX_CHUNKS) break;
    if (!chunks.length && sentence.length > IRODORI_FIRST_CHUNK_LENGTH) {
      const first = splitTtsText(sentence, IRODORI_FIRST_CHUNK_LENGTH, IRODORI_MAX_CHUNKS)[0];
      if (first) chunks.push(first);
      const remainder = sentence.slice(first?.length || 0).trim();
      if (remainder) chunks.push(...splitTtsText(remainder, IRODORI_CHUNK_LENGTH, IRODORI_MAX_CHUNKS - chunks.length));
    } else {
      chunks.push(...splitTtsText(sentence, IRODORI_CHUNK_LENGTH, IRODORI_MAX_CHUNKS - chunks.length));
    }
  }
  return chunks.slice(0, IRODORI_MAX_CHUNKS);
}

module.exports = {
  IRODORI_CHUNK_LENGTH,
  IRODORI_FIRST_CHUNK_LENGTH,
  MODEL_NAMES,
  irodoriModelStatus,
  resolveIrodoriModelDirectory,
  splitIrodoriText,
  validateIrodoriModelDirectory,
  validateIrodoriReferenceAudio,
};
