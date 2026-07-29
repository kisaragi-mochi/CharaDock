// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VOICE_ID_PATTERN = /^[a-z0-9-]{8,80}$/;
const BUNDLED_IRODORI_VOICES = Object.freeze([
  Object.freeze({
    id: "builtin-hiro",
    fileName: "builtin-hiro.wav",
    sourceFileName: "hiro.wav",
    name: "Hiro（同梱）",
    createdAt: "bundled",
    builtIn: true,
    attributionUrl: "",
  }),
  Object.freeze({
    id: "builtin-kohaku",
    fileName: "builtin-kohaku.wav",
    sourceFileName: "kohaku.wav",
    name: "Kohaku（あみたろの声素材工房）",
    createdAt: "bundled",
    builtIn: true,
    attributionUrl: "https://amitaro.net/voice/voice_rule/",
  }),
]);

function safeVoiceName(value, fallback = "Irodori Voice") {
  return String(value || "").trim().replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").slice(0, 80) || fallback;
}

function isPcmWave(bytes) {
  const buffer = Buffer.from(bytes || []);
  return buffer.length >= 44
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WAVE";
}

class IrodoriVoiceLibrary {
  constructor(baseDirectory) {
    this.baseDirectory = path.resolve(baseDirectory);
  }

  voicePath(voiceOrId) {
    const id = String(typeof voiceOrId === "object" ? voiceOrId?.id : voiceOrId || "");
    if (!VOICE_ID_PATTERN.test(id)) throw new Error("Irodori音声IDが正しくありません。");
    return path.join(this.baseDirectory, `${id}.wav`);
  }

  isReady(voice) {
    try {
      return voice?.fileName === `${voice.id}.wav` && fs.statSync(this.voicePath(voice)).isFile();
    } catch {
      return false;
    }
  }

  publicVoices(voices, selectedId = "") {
    return (Array.isArray(voices) ? voices : []).map((voice) => ({
      id: String(voice.id || ""),
      name: safeVoiceName(voice.name),
      createdAt: String(voice.createdAt || ""),
      builtIn: Boolean(voice.builtIn),
      attributionUrl: String(voice.attributionUrl || ""),
      ready: this.isReady(voice),
      selected: voice.id === selectedId,
    }));
  }

  installBundledVoices(voices, sourceDirectory) {
    const sourceRoot = path.resolve(String(sourceDirectory || ""));
    fs.mkdirSync(this.baseDirectory, { recursive: true });
    const records = [];
    const bundledBytes = new Map();
    for (const definition of BUNDLED_IRODORI_VOICES) {
      const source = path.join(sourceRoot, definition.sourceFileName);
      const bytes = fs.readFileSync(source);
      if (!isPcmWave(bytes)) throw new Error(`同梱Irodori参照音声がWAV形式ではありません: ${definition.sourceFileName}`);
      const record = {
        id: definition.id,
        fileName: definition.fileName,
        name: definition.name,
        createdAt: definition.createdAt,
        builtIn: true,
        attributionUrl: definition.attributionUrl,
      };
      const destination = this.voicePath(record);
      const current = (() => { try { return fs.readFileSync(destination); } catch { return null; } })();
      if (!current || !current.equals(bytes)) {
        const temporary = `${destination}.tmp`;
        fs.writeFileSync(temporary, bytes, { mode: 0o600 });
        fs.renameSync(temporary, destination);
      }
      records.push(record);
      bundledBytes.set(record.id, bytes);
    }
    const bundledIds = new Set(records.map((record) => record.id));
    const replacements = {};
    const customVoices = (Array.isArray(voices) ? voices : []).filter((voice) => {
      if (bundledIds.has(voice?.id)) return false;
      let bytes;
      try { bytes = fs.readFileSync(this.voicePath(voice)); } catch { return true; }
      const replacement = records.find((record) => bundledBytes.get(record.id).equals(bytes));
      if (!replacement) return true;
      replacements[voice.id] = replacement.id;
      return false;
    });
    return { voices: [...records, ...customVoices], replacements };
  }

  selectedVoice(voices, selectedId = "") {
    const list = Array.isArray(voices) ? voices : [];
    return list.find((voice) => voice.id === selectedId && this.isReady(voice))
      || list.find((voice) => this.isReady(voice))
      || null;
  }

  importWave(bytes, displayName, voices = []) {
    const buffer = Buffer.from(bytes || []);
    if (!isPcmWave(buffer)) throw new Error("変換したIrodori参照音声がWAV形式ではありません。");
    if (buffer.length > 16 * 1024 * 1024) throw new Error("Irodori参照音声は60秒以内にしてください。");
    const id = `voice-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
    const record = {
      id,
      fileName: `${id}.wav`,
      name: safeVoiceName(displayName),
      createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(this.baseDirectory, { recursive: true });
    const destination = this.voicePath(record);
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, buffer, { mode: 0o600 });
    fs.renameSync(temporary, destination);
    return { voices: [...(Array.isArray(voices) ? voices : []), record], record };
  }

  migrateLegacyWave(filePath, voices = []) {
    const source = path.resolve(String(filePath || ""));
    let bytes;
    try { bytes = fs.readFileSync(source); } catch { return null; }
    if (path.extname(source).toLowerCase() !== ".wav" || !isPcmWave(bytes)) return null;
    return this.importWave(bytes, path.basename(source, path.extname(source)), voices);
  }

  rename(voices, voiceId, name) {
    let found = false;
    const updated = (Array.isArray(voices) ? voices : []).map((voice) => {
      if (voice.id !== voiceId) return voice;
      if (voice.builtIn) throw new Error("同梱参照音声の名前は変更できません。");
      found = true;
      return { ...voice, name: safeVoiceName(name, voice.name) };
    });
    if (!found) throw new Error("変更するIrodori音声が見つかりません。");
    return updated;
  }

  remove(voices, voiceId) {
    const list = Array.isArray(voices) ? voices : [];
    const voice = list.find((item) => item.id === voiceId);
    if (!voice) throw new Error("削除するIrodori音声が見つかりません。");
    if (voice.builtIn) throw new Error("同梱参照音声は削除できません。");
    fs.rmSync(this.voicePath(voice), { force: true });
    return list.filter((item) => item.id !== voiceId);
  }
}

module.exports = {
  BUNDLED_IRODORI_VOICES,
  IrodoriVoiceLibrary,
  VOICE_ID_PATTERN,
  isPcmWave,
  safeVoiceName,
};
