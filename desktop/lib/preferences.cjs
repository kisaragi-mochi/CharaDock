// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_REALTIME_VOICE, normalizeRealtimeVoice } = require("./realtime-voice.cjs");

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
  piperPlusExecutablePath: "",
  piperPlusModelPath: "",
  piperPlusSpeed: 1,
  supertonicModelDirectory: "",
  supertonicVoice: "F1",
  supertonicSpeed: 1,
  supertonicSteps: 8,
  irodoriModelDirectory: "",
  irodoriReferenceAudioPath: "",
  irodoriVoices: [],
  irodoriVoiceId: "",
  irodoriSpeed: 1,
  irodoriSteps: 8,
  irodoriSamplingMode: "sway",
  irodoriSeed: 0,
  kokoroModelDirectory: "",
  kokoroVoice: "jf_alpha",
  kokoroSpeed: 1,
  kokoroDevice: "auto",
  characterTtsProfiles: {},
  realtimeVoice: DEFAULT_REALTIME_VOICE,
  englishPronunciationEnabled: true,
  englishPronunciationDictionary: "",
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
      if (typeof this.data.englishPronunciationEnabled !== "boolean") this.data.englishPronunciationEnabled = true;
      if (typeof this.data.englishPronunciationDictionary !== "string") this.data.englishPronunciationDictionary = "";
      this.data.englishPronunciationDictionary = this.data.englishPronunciationDictionary.slice(0, 12_000);
      if (typeof this.data.piperPlusExecutablePath !== "string") this.data.piperPlusExecutablePath = "";
      if (typeof this.data.piperPlusModelPath !== "string") this.data.piperPlusModelPath = "";
      this.data.piperPlusExecutablePath = this.data.piperPlusExecutablePath.slice(0, 1000);
      this.data.piperPlusModelPath = this.data.piperPlusModelPath.slice(0, 1000);
      this.data.piperPlusSpeed = Math.min(2, Math.max(.5, Number(this.data.piperPlusSpeed) || 1));
      if (typeof this.data.supertonicModelDirectory !== "string") this.data.supertonicModelDirectory = "";
      this.data.supertonicModelDirectory = this.data.supertonicModelDirectory.slice(0, 1000);
      if (!/^[FM][1-5]$/.test(this.data.supertonicVoice)) this.data.supertonicVoice = "F1";
      this.data.supertonicSpeed = Math.min(2, Math.max(.5, Number(this.data.supertonicSpeed) || 1));
      this.data.supertonicSteps = Math.min(20, Math.max(2, Math.round(Number(this.data.supertonicSteps) || 8)));
      if (typeof this.data.irodoriModelDirectory !== "string") this.data.irodoriModelDirectory = "";
      if (typeof this.data.irodoriReferenceAudioPath !== "string") this.data.irodoriReferenceAudioPath = "";
      this.data.irodoriModelDirectory = this.data.irodoriModelDirectory.slice(0, 1000);
      this.data.irodoriReferenceAudioPath = this.data.irodoriReferenceAudioPath.slice(0, 1000);
      if (!Array.isArray(this.data.irodoriVoices)) this.data.irodoriVoices = [];
      this.data.irodoriVoices = this.data.irodoriVoices.slice(0, 100).flatMap((voice) => {
        const id = String(voice?.id || "");
        const fileName = String(voice?.fileName || "");
        if (!/^[a-z0-9-]{8,80}$/.test(id) || fileName !== `${id}.wav`) return [];
        return [{
          id,
          fileName,
          name: String(voice?.name || "Voice").trim().slice(0, 80) || "Voice",
          createdAt: String(voice?.createdAt || "").slice(0, 40),
        }];
      });
      this.data.irodoriVoiceId = String(this.data.irodoriVoiceId || "").slice(0, 80);
      this.data.irodoriSpeed = Math.min(2, Math.max(.5, Number(this.data.irodoriSpeed) || 1));
      const firstSwayMigration = !Object.prototype.hasOwnProperty.call(parsed, "irodoriSamplingMode");
      if (!["linear", "sway"].includes(this.data.irodoriSamplingMode)) this.data.irodoriSamplingMode = "sway";
      if (firstSwayMigration && Number(this.data.irodoriSteps) === 16) this.data.irodoriSteps = 8;
      this.data.irodoriSteps = Math.min(40, Math.max(4, Math.round(Number(this.data.irodoriSteps) || 8)));
      this.data.irodoriSeed = Math.min(2147483647, Math.max(0, Math.round(Number(this.data.irodoriSeed) || 0)));
      if (typeof this.data.kokoroModelDirectory !== "string") this.data.kokoroModelDirectory = "";
      this.data.kokoroModelDirectory = this.data.kokoroModelDirectory.slice(0, 1000);
      if (!["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"].includes(this.data.kokoroVoice)) this.data.kokoroVoice = "jf_alpha";
      this.data.kokoroSpeed = Math.min(2, Math.max(.5, Number(this.data.kokoroSpeed) || 1));
      if (!["auto", "webgpu", "wasm"].includes(this.data.kokoroDevice)) this.data.kokoroDevice = "auto";
      if (!this.data.characterTtsProfiles || typeof this.data.characterTtsProfiles !== "object" || Array.isArray(this.data.characterTtsProfiles)) {
        this.data.characterTtsProfiles = {};
      }
      this.data.characterTtsProfiles = Object.fromEntries(Object.entries(this.data.characterTtsProfiles).slice(0, 100).flatMap(([characterId, profile]) => {
        const id = String(characterId || "").slice(0, 120);
        if (!id || !profile || typeof profile !== "object" || Array.isArray(profile)) return [];
        const provider = ["system", "style-bert-vits2", "piper-plus", "supertonic-3", "irodori-webgpu", "kokoro"].includes(profile.provider)
          ? profile.provider : "system";
        return [[id, {
          provider,
          realtimeVoice: normalizeRealtimeVoice(profile.realtimeVoice, normalizeRealtimeVoice(this.data.realtimeVoice)),
          irodoriVoiceId: String(profile.irodoriVoiceId || "").slice(0, 80),
          supertonicVoice: /^[FM][1-5]$/.test(String(profile.supertonicVoice || "")) ? String(profile.supertonicVoice) : "F1",
          kokoroVoice: ["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"].includes(profile.kokoroVoice)
            ? profile.kokoroVoice : "jf_alpha",
        }]];
      }));
      this.data.realtimeVoice = normalizeRealtimeVoice(this.data.realtimeVoice);
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
      if (!["customCharacters", "workDirectory", "piperPlusExecutablePath", "piperPlusModelPath", "supertonicModelDirectory", "irodoriModelDirectory", "irodoriReferenceAudioPath", "irodoriVoices", "kokoroModelDirectory", "characterTtsProfiles"].includes(key)) state[key] = this.data[key];
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
