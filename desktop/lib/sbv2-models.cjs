// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MODEL_ID_PATTERN = /^sbv2-[a-z0-9-]{8,80}$/;
const MAX_MODEL_BYTES = 2 * 1024 * 1024 * 1024;

function safeModelName(value, fallback = "JP-Extra Voice") {
  return String(value || "").trim().replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").slice(0, 80) || fallback;
}

function normalizeManifest(manifest = {}) {
  const architecture = String(manifest.modelArchitecture || "").slice(0, 120);
  if (architecture !== "Style-Bert-VITS2 (JP-Extra)") {
    throw new Error("Style-Bert-VITS2 JP-Extra形式のAIVMXモデルを選択してください。");
  }
  const speakers = (Array.isArray(manifest.speakers) ? manifest.speakers : []).slice(0, 64).flatMap((speaker) => {
    const localId = Math.max(0, Math.min(255, Math.round(Number(speaker?.localId))));
    const styles = (Array.isArray(speaker?.styles) ? speaker.styles : []).slice(0, 64).flatMap((style) => {
      const styleId = Number(style?.localId);
      if (!Number.isInteger(styleId) || styleId < 0 || styleId > 255) return [];
      return [{ name: safeModelName(style?.name, `Style ${styleId}`), localId: styleId }];
    });
    if (!Number.isInteger(Number(speaker?.localId)) || !styles.length) return [];
    return [{
      name: safeModelName(speaker?.name, `Speaker ${localId}`),
      localId,
      supportedLanguages: (Array.isArray(speaker?.supportedLanguages) ? speaker.supportedLanguages : []).map((value) => String(value).slice(0, 20)).slice(0, 12),
      styles,
    }];
  });
  if (!speakers.length) throw new Error("AIVMXモデルに利用できる話者・スタイルがありません。");
  return {
    name: safeModelName(manifest.name),
    description: String(manifest.description || "").trim().slice(0, 1000),
    architecture,
    version: String(manifest.version || "").slice(0, 80),
    creators: (Array.isArray(manifest.creators) ? manifest.creators : []).map((value) => safeModelName(value, "Creator")).slice(0, 20),
    license: String(manifest.license || "").trim().slice(0, 20_000),
    speakers,
  };
}

class Sbv2ModelLibrary {
  constructor(baseDirectory) {
    this.baseDirectory = path.resolve(baseDirectory);
  }

  modelDirectory(modelOrId) {
    const id = String(typeof modelOrId === "object" ? modelOrId?.id : modelOrId || "");
    if (!MODEL_ID_PATTERN.test(id)) throw new Error("JP-ExtraモデルIDが正しくありません。");
    return path.join(this.baseDirectory, id);
  }

  modelPath(modelOrId) {
    return path.join(this.modelDirectory(modelOrId), "model.aivmx");
  }

  isReady(model) {
    try {
      return model?.fileName === "model.aivmx" && fs.statSync(this.modelPath(model)).isFile();
    } catch {
      return false;
    }
  }

  publicModels(models, selectedId = "") {
    return (Array.isArray(models) ? models : []).map((model) => ({
      id: String(model.id || ""),
      name: safeModelName(model.name),
      sourceFileName: safeModelName(model.sourceFileName, "model.aivmx"),
      createdAt: String(model.createdAt || ""),
      sizeBytes: Math.max(0, Number(model.sizeBytes) || 0),
      description: String(model.description || ""),
      architecture: String(model.architecture || ""),
      version: String(model.version || ""),
      creators: Array.isArray(model.creators) ? [...model.creators] : [],
      license: String(model.license || ""),
      speakers: Array.isArray(model.speakers) ? model.speakers.map((speaker) => ({ ...speaker, styles: speaker.styles.map((style) => ({ ...style })) })) : [],
      ready: this.isReady(model),
      selected: model.id === selectedId,
    }));
  }

  selectedModel(models, selectedId = "") {
    const list = Array.isArray(models) ? models : [];
    return list.find((model) => model.id === selectedId && this.isReady(model))
      || list.find((model) => this.isReady(model))
      || null;
  }

  async importAivmx(sourcePath, manifest, models = []) {
    const source = path.resolve(String(sourcePath || ""));
    const stat = await fs.promises.stat(source);
    if (!stat.isFile()) throw new Error("選択したAIVMXモデルを読み込めません。");
    if (path.extname(source).toLowerCase() !== ".aivmx") throw new Error(".aivmx形式のモデルを選択してください。");
    if (stat.size <= 0 || stat.size > MAX_MODEL_BYTES) throw new Error("AIVMXモデルは2GB以内にしてください。");
    const info = normalizeManifest(manifest);
    const id = `sbv2-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
    const record = {
      id,
      fileName: "model.aivmx",
      sourceFileName: safeModelName(path.basename(source), "model.aivmx"),
      createdAt: new Date().toISOString(),
      sizeBytes: stat.size,
      ...info,
    };
    const directory = this.modelDirectory(id);
    const temporaryDirectory = `${directory}.tmp-${process.pid}`;
    await fs.promises.mkdir(this.baseDirectory, { recursive: true });
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
    await fs.promises.mkdir(temporaryDirectory, { recursive: true });
    try {
      await fs.promises.copyFile(source, path.join(temporaryDirectory, "model.aivmx"));
      await fs.promises.rename(temporaryDirectory, directory);
    } catch (error) {
      await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
    return { models: [...(Array.isArray(models) ? models : []), record], record };
  }

  rename(models, modelId, name) {
    let found = false;
    const updated = (Array.isArray(models) ? models : []).map((model) => {
      if (model.id !== modelId) return model;
      found = true;
      return { ...model, name: safeModelName(name, model.name) };
    });
    if (!found) throw new Error("名前を変更するJP-Extraモデルが見つかりません。");
    return updated;
  }

  remove(models, modelId) {
    const list = Array.isArray(models) ? models : [];
    if (!list.some((model) => model.id === modelId)) throw new Error("削除するJP-Extraモデルが見つかりません。");
    fs.rmSync(this.modelDirectory(modelId), { recursive: true, force: true });
    return list.filter((model) => model.id !== modelId);
  }
}

module.exports = { MAX_MODEL_BYTES, MODEL_ID_PATTERN, Sbv2ModelLibrary, normalizeManifest, safeModelName };
