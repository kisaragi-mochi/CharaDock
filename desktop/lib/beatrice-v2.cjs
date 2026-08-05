// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const BEATRICE_SAMPLE_RATE = 48_000;
const BEATRICE_BLOCK_SAMPLES = 480;

function normalizeBeatriceMode(value) {
  return value === "beatrice-v2" ? "beatrice-v2" : "none";
}

function normalizeBeatriceVoiceId(value) {
  return Math.max(0, Math.min(999, Math.round(Number(value) || 0)));
}

function parseBeatriceVoices(tomlPath) {
  if (!tomlPath || !fs.statSync(tomlPath, { throwIfNoEntry: false })?.isFile()) return [];
  const text = fs.readFileSync(tomlPath, "utf8");
  const voices = [];
  const section = /^\s*\[voice\.(\d+)\]\s*$/gm;
  let match;
  while ((match = section.exec(text))) {
    const start = section.lastIndex;
    const next = text.slice(start).search(/^\s*\[/m);
    const body = text.slice(start, next < 0 ? text.length : start + next);
    const name = body.match(/^\s*name\s*=\s*"([^"]+)"\s*$/m)?.[1] || `Voice ${match[1]}`;
    voices.push({ id: Number(match[1]), name: String(name).slice(0, 100) });
  }
  return voices.slice(0, 1000);
}

function parseTomlString(text, key, section = "model") {
  const sectionMatch = text.match(new RegExp(`^\\s*\\[${section.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\]\\s*$`, "m"));
  if (!sectionMatch) return "";
  const start = sectionMatch.index + sectionMatch[0].length;
  const next = text.slice(start).search(/^\s*\[/m);
  const body = text.slice(start, next < 0 ? text.length : start + next);
  return body.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"\\s*$`, "m"))?.[1] || "";
}

function beatriceModelId(modelPath) {
  return `beatrice-${createHash("sha256").update(path.resolve(String(modelPath || "")).toLowerCase()).digest("hex").slice(0, 16)}`;
}

function describeBeatriceModel(modelPath) {
  if (!modelPath || !fs.statSync(modelPath, { throwIfNoEntry: false })?.isFile()) return null;
  const text = fs.readFileSync(modelPath, "utf8");
  const voices = parseBeatriceVoices(modelPath);
  return {
    id: beatriceModelId(modelPath),
    name: String(parseTomlString(text, "name") || path.basename(path.dirname(modelPath)) || "Beatrice model").slice(0, 100),
    version: String(parseTomlString(text, "version") || "").slice(0, 40),
    modelPath: path.resolve(modelPath),
    voices,
  };
}

function walk(directory, depth = 0) {
  if (depth > 4) return [];
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? [item, ...walk(item, depth + 1)] : [item];
  });
}

function findBeatriceInstallation(directory) {
  const root = String(directory || "");
  const stat = fs.statSync(root, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) return { directory: root, vstPath: "", modelPath: "", voices: [] };
  const items = walk(root);
  const vstPath = items.find((item) => item.toLowerCase().endsWith(".vst3") && fs.statSync(item, { throwIfNoEntry: false })?.isDirectory())
    || items.find((item) => item.toLowerCase().endsWith(".vst3") && fs.statSync(item, { throwIfNoEntry: false })?.isFile()) || "";
  const models = items
    .filter((item) => item.toLowerCase().endsWith(".toml") && fs.statSync(item, { throwIfNoEntry: false })?.isFile())
    .map(describeBeatriceModel)
    .filter((model) => model?.voices?.length);
  const preferred = models.find((model) => /beatrice/i.test(path.basename(model.modelPath))) || models[0] || null;
  return { directory: root, vstPath, modelPath: preferred?.modelPath || "", voices: preferred?.voices || [], models };
}

function findBeatriceModels(directory) {
  const root = String(directory || "");
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) return [];
  return walk(root)
    .filter((item) => item.toLowerCase().endsWith(".toml") && fs.statSync(item, { throwIfNoEntry: false })?.isFile())
    .map(describeBeatriceModel)
    .filter((model) => model?.voices?.length);
}

function resolveBeatriceHostExecutable({ appPath, resourcesPath, packaged = false, platform = process.platform, arch = process.arch } = {}) {
  let executableName = "";
  if (platform === "win32") executableName = "charadock-beatrice-host.exe";
  else if (platform === "darwin" && arch === "arm64") executableName = "charadock-beatrice-host";
  if (!executableName) return "";
  return packaged
    ? path.join(resourcesPath, "bin", executableName)
    : path.join(appPath, "native", "bin", executableName);
}

function beatriceStatus({ hostPath, vstPath, modelPath, voiceId = 0 } = {}) {
  const hostReady = Boolean(hostPath && fs.statSync(hostPath, { throwIfNoEntry: false })?.isFile());
  const vstReady = Boolean(vstPath && fs.statSync(vstPath, { throwIfNoEntry: false }));
  const modelReady = Boolean(modelPath && fs.statSync(modelPath, { throwIfNoEntry: false })?.isFile());
  const voices = modelReady ? parseBeatriceVoices(modelPath) : [];
  const selectedVoiceId = normalizeBeatriceVoiceId(voiceId);
  return {
    ready: hostReady && vstReady && modelReady,
    hostReady,
    vstReady,
    modelReady,
    vstPath: String(vstPath || ""),
    modelPath: String(modelPath || ""),
    voices,
    selectedVoiceId,
    selectedVoice: voices.find((voice) => voice.id === selectedVoiceId) || null,
  };
}

module.exports = {
  BEATRICE_BLOCK_SAMPLES,
  BEATRICE_SAMPLE_RATE,
  beatriceStatus,
  beatriceModelId,
  describeBeatriceModel,
  findBeatriceInstallation,
  findBeatriceModels,
  normalizeBeatriceMode,
  normalizeBeatriceVoiceId,
  parseBeatriceVoices,
  resolveBeatriceHostExecutable,
};
