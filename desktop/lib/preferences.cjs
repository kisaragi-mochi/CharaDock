// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = Object.freeze({
  backend: "codex",
  characterId: "amber-avatar",
  openaiModel: "gpt-5.6-luna",
  transcriptionModel: "gpt-4o-mini-transcribe",
  codexModel: "",
  codexChatModel: "",
  codexChatReasoningEffort: "",
  codexWorkModel: "",
  codexWorkReasoningEffort: "",
  alwaysOnTop: true,
  clickThrough: false,
  mouseFollow: true,
  launchAtLogin: false,
  ttsEnabled: true,
  ttsProvider: "system",
  styleBertVits2Url: "http://localhost:5000",
  styleBertVits2ModelId: 0,
  styleBertVits2Speed: 1,
  speechInputProvider: "auto",
  sherpaModelId: "reazonspeech-ja-int8",
  speechLanguage: "ja-JP",
  voiceActivationMode: "vad",
  vadSensitivity: "normal",
  voiceAutoSend: true,
  onboardingComplete: false,
  positionLocked: false,
  edgeSnap: true,
  preferredDisplayId: "",
  interactionMode: "chat",
  workDirectory: "",
  characterProfiles: {},
  customCharacters: [],
  mascotBounds: null,
  controlBounds: null,
});

const PUBLIC_KEYS = new Set(Object.keys(DEFAULTS));

class Preferences {
  constructor(filePath, safeStorage = null) {
    this.filePath = filePath;
    this.safeStorage = safeStorage;
    this.data = { ...DEFAULTS };
    this.sessionApiKey = "";
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      for (const key of PUBLIC_KEYS) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) this.data[key] = parsed[key];
      }
      // Migrate the former single Codex model setting without discarding it.
      if (typeof parsed.codexModel === "string") {
        if (!Object.prototype.hasOwnProperty.call(parsed, "codexChatModel")) this.data.codexChatModel = parsed.codexModel;
        if (!Object.prototype.hasOwnProperty.call(parsed, "codexWorkModel")) this.data.codexWorkModel = parsed.codexModel;
      }
      if (!["manual", "vad"].includes(this.data.voiceActivationMode)) this.data.voiceActivationMode = "vad";
      if (!["low", "normal", "high"].includes(this.data.vadSensitivity)) this.data.vadSensitivity = "normal";
      if (typeof parsed.encryptedApiKey === "string") this.data.encryptedApiKey = parsed.encryptedApiKey;
    } catch (error) {
      if (error?.code !== "ENOENT") console.warn("Preferences load failed:", error);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }

  publicState() {
    const state = {};
    for (const key of PUBLIC_KEYS) {
      if (!["customCharacters", "workDirectory"].includes(key)) state[key] = this.data[key];
    }
    state.hasWorkDirectory = Boolean(this.data.workDirectory);
    state.workDirectoryName = this.data.workDirectory ? path.basename(this.data.workDirectory) : "";
    state.hasApiKey = Boolean(this.getApiKey());
    state.apiKeyPersistence = this.canEncrypt() ? "encrypted" : "session";
    return state;
  }

  patch(values = {}) {
    for (const key of PUBLIC_KEYS) {
      if (Object.prototype.hasOwnProperty.call(values, key)) this.data[key] = values[key];
    }
    this.save();
    return this.publicState();
  }

  canEncrypt() {
    try {
      return Boolean(this.safeStorage?.isEncryptionAvailable?.());
    } catch {
      return false;
    }
  }

  setApiKey(apiKey) {
    const normalized = String(apiKey || "").trim();
    this.sessionApiKey = normalized;
    delete this.data.encryptedApiKey;
    if (normalized && this.canEncrypt()) {
      this.data.encryptedApiKey = this.safeStorage.encryptString(normalized).toString("base64");
      this.sessionApiKey = "";
    }
    this.save();
    return this.publicState();
  }

  getApiKey() {
    if (this.sessionApiKey) return this.sessionApiKey;
    if (!this.data.encryptedApiKey || !this.canEncrypt()) return "";
    try {
      return this.safeStorage.decryptString(Buffer.from(this.data.encryptedApiKey, "base64"));
    } catch (error) {
      console.warn("API key decrypt failed:", error);
      return "";
    }
  }
}

module.exports = { DEFAULTS, Preferences };
