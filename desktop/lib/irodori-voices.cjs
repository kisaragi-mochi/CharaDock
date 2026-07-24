// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VOICE_ID_PATTERN = /^[a-z0-9-]{8,80}$/;

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
      ready: this.isReady(voice),
      selected: voice.id === selectedId,
    }));
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
    fs.rmSync(this.voicePath(voice), { force: true });
    return list.filter((item) => item.id !== voiceId);
  }
}

module.exports = {
  IrodoriVoiceLibrary,
  VOICE_ID_PATTERN,
  isPcmWave,
  safeVoiceName,
};
