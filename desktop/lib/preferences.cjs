// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_REALTIME_VOICE, normalizeRealtimeVoice } = require("./realtime-voice.cjs");
const { normalizeCharacterMemories } = require("./character-memory.cjs");

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
  speechInputProvider: "browser",
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
  conversationHistories: {},
  characterMemories: {},
  workHistory: [],
  mascotBounds: null,
  controlBounds: null,
});

const PUBLIC_KEYS = new Set(Object.keys(DEFAULTS));
const LEGACY_TOWA_CHARACTER_ID = "user-avatar-ms5afs58";
const BUILT_IN_TOWA_CHARACTER_ID = "towa-avatar";

function normalizeConversationHistories(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 40).flatMap(([characterId, entries]) => {
    const id = String(characterId || "").slice(0, 120);
    if (!id || !Array.isArray(entries)) return [];
    const history = entries.slice(-40).flatMap((entry) => {
      const role = entry?.role === "assistant" ? "assistant" : entry?.role === "user" ? "user" : "";
      const text = String(entry?.text || "").trim().slice(0, 12_000);
      const createdAt = String(entry?.createdAt || "").slice(0, 40);
      return role && text ? [{ role, text, createdAt }] : [];
    });
    return history.length ? [[id, history]] : [];
  }));
}

function normalizeWorkHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const id = String(entry.id || "").slice(0, 120);
    const request = String(entry.request || "").trim().slice(0, 12_000);
    if (!id || !request) return [];
    const wasActive = ["running", "stopping"].includes(entry.status);
    const status = wasActive ? "interrupted" : ["completed", "interrupted", "failed"].includes(entry.status) ? entry.status : "failed";
    return [{
      id,
      startedAt: String(entry.startedAt || "").slice(0, 40),
      finishedAt: String(entry.finishedAt || (wasActive ? new Date().toISOString() : "")).slice(0, 40),
      status,
      request,
      activities: (Array.isArray(entry.activities) ? entry.activities : []).slice(-12).map((item) => String(item || "").slice(0, 160)).filter(Boolean),
      result: String(entry.result || (wasActive ? "アプリの終了により作業を中断しました。" : "")).slice(0, 24_000),
      characterId: String(entry.characterId || "").slice(0, 120),
      characterName: String(entry.characterName || "").slice(0, 80),
      workDirectoryName: String(entry.workDirectoryName || "").slice(0, 260),
    }];
  });
}

function migrateBundledTowaPreferenceData(data) {
  let changed = false;
  if (data.characterId === LEGACY_TOWA_CHARACTER_ID) {
    data.characterId = BUILT_IN_TOWA_CHARACTER_ID;
    changed = true;
  }
  if (Array.isArray(data.customCharacters)) {
    const remaining = data.customCharacters.filter((character) => character?.id !== LEGACY_TOWA_CHARACTER_ID);
    if (remaining.length !== data.customCharacters.length) {
      data.customCharacters = remaining;
      changed = true;
    }
  }
  for (const profileKey of ["characterProfiles", "characterTtsProfiles", "conversationHistories", "characterMemories"]) {
    const profiles = data[profileKey];
    if (!profiles || typeof profiles !== "object" || Array.isArray(profiles) || !profiles[LEGACY_TOWA_CHARACTER_ID]) continue;
    if (!profiles[BUILT_IN_TOWA_CHARACTER_ID]) profiles[BUILT_IN_TOWA_CHARACTER_ID] = profiles[LEGACY_TOWA_CHARACTER_ID];
    delete profiles[LEGACY_TOWA_CHARACTER_ID];
    changed = true;
  }
  if (Array.isArray(data.workHistory)) {
    for (const run of data.workHistory) {
      if (run?.characterId === LEGACY_TOWA_CHARACTER_ID) {
        run.characterId = BUILT_IN_TOWA_CHARACTER_ID;
        changed = true;
      }
    }
  }
  return changed;
}

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
      if (!["realtime", "sherpa-onnx", "browser", "openai"].includes(this.data.speechInputProvider)) {
        this.data.speechInputProvider = "browser";
      }
      this.data.conversationHistories = normalizeConversationHistories(this.data.conversationHistories);
      this.data.characterMemories = normalizeCharacterMemories(this.data.characterMemories);
      this.data.workHistory = normalizeWorkHistory(this.data.workHistory);
      if (typeof parsed.encryptedApiKey === "string") this.data.encryptedApiKey = parsed.encryptedApiKey;
      if (migrateBundledTowaPreferenceData(this.data)) this.save();
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
      if (!["customCharacters", "workDirectory", "piperPlusExecutablePath", "piperPlusModelPath", "supertonicModelDirectory", "irodoriModelDirectory", "irodoriReferenceAudioPath", "irodoriVoices", "kokoroModelDirectory", "characterTtsProfiles", "conversationHistories", "characterMemories", "workHistory"].includes(key)) state[key] = this.data[key];
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

module.exports = { DEFAULTS, Preferences, migrateBundledTowaPreferenceData, normalizeConversationHistories, normalizeWorkHistory };
