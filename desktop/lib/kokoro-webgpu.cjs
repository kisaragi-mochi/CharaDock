// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");

const KOKORO_VOICES = Object.freeze([
  Object.freeze({ id: "jf_alpha", label: "Alpha（女性）" }),
  Object.freeze({ id: "jf_gongitsune", label: "Gongitsune（女性）" }),
  Object.freeze({ id: "jf_nezumi", label: "Nezumi（女性）" }),
  Object.freeze({ id: "jf_tebukuro", label: "Tebukuro（女性）" }),
  Object.freeze({ id: "jm_kumo", label: "Kumo（男性）" }),
]);
const KOKORO_VOICE_IDS = new Set(KOKORO_VOICES.map((voice) => voice.id));
const MODEL_FILES = Object.freeze([
  "onnx/model.onnx",
  "onnx/model_quantized.onnx",
  ...KOKORO_VOICES.map((voice) => `voices/${voice.id}.bin`),
]);

function isFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function validateKokoroModelDirectory(directory) {
  const root = path.resolve(String(directory || ""));
  const missingFiles = MODEL_FILES.filter((relativePath) => !isFile(path.join(root, relativePath)));
  return { root, missingFiles, ready: missingFiles.length === 0 };
}

function kokoroModelStatus(directory, webgpuAvailable = null) {
  if (!directory) return {
    ready: false,
    directoryName: "",
    missingFiles: [...MODEL_FILES],
    webgpuAvailable,
  };
  const result = validateKokoroModelDirectory(directory);
  return {
    ready: result.ready,
    directoryName: path.basename(result.root),
    missingFiles: result.missingFiles,
    webgpuAvailable,
  };
}

function normalizeKokoroVoice(value) {
  const voice = String(value || "");
  return KOKORO_VOICE_IDS.has(voice) ? voice : "jf_alpha";
}

module.exports = {
  KOKORO_VOICES,
  MODEL_FILES,
  kokoroModelStatus,
  normalizeKokoroVoice,
  validateKokoroModelDirectory,
};
