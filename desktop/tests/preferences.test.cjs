// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { Preferences } = require("../lib/preferences.cjs");

test("preferences encrypts the API key and never exposes it publicly", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const file = path.join(directory, "preferences.json");
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString().replace(/^encrypted:/, ""),
  };
  const preferences = new Preferences(file, safeStorage);
  preferences.setApiKey("sk-test-secret");
  const disk = fs.readFileSync(file, "utf8");
  assert.equal(disk.includes("sk-test-secret"), false);
  assert.equal(preferences.getApiKey(), "sk-test-secret");
  assert.equal(preferences.publicState().hasApiKey, true);
  assert.equal(Object.prototype.hasOwnProperty.call(preferences.publicState(), "encryptedApiKey"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(preferences.publicState(), "customCharacters"), false);
});

test("preferences keeps API key in memory when encryption is unavailable", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const preferences = new Preferences(path.join(directory, "preferences.json"), {
    isEncryptionAvailable: () => false,
  });
  preferences.setApiKey("sk-session-only");
  assert.equal(preferences.getApiKey(), "sk-session-only");
  assert.equal(preferences.publicState().apiKeyPersistence, "session");
  assert.equal(fs.readFileSync(preferences.filePath, "utf8").includes("sk-session-only"), false);
});

test("new installs enable onboarding and desktop positioning defaults", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const preferences = new Preferences(path.join(directory, "preferences.json"));
  const state = preferences.publicState();
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.positionLocked, false);
  assert.equal(state.edgeSnap, true);
  assert.equal(state.preferredDisplayId, "");
  assert.equal(state.interactionMode, "chat");
  assert.equal(state.ttsProvider, "system");
  assert.equal(state.realtimeVoice, "cove");
  assert.equal(state.styleBertVits2Url, "http://localhost:5000");
  assert.equal(state.styleBertVits2ModelId, 0);
  assert.equal(state.styleBertVits2Speed, 1);
  assert.equal(state.piperPlusSpeed, 1);
  assert.equal(state.piperPlusExecutablePath, undefined);
  assert.equal(state.piperPlusModelPath, undefined);
  assert.equal(state.englishPronunciationEnabled, true);
  assert.equal(state.englishPronunciationDictionary, "");
  assert.equal(state.speechInputProvider, "auto");
  assert.equal(state.sherpaModelId, "reazonspeech-ja-int8");
  assert.equal(state.supertonicVoice, "F1");
  assert.equal(state.supertonicSpeed, 1);
  assert.equal(state.supertonicSteps, 8);
  assert.equal(state.supertonicModelDirectory, undefined);
  assert.equal(state.irodoriSteps, 8);
  assert.equal(state.irodoriSamplingMode, "sway");
  assert.equal(state.irodoriSpeed, 1);
  assert.equal(state.irodoriVoiceId, "");
  assert.equal(state.irodoriSeed, 0);
  assert.equal(state.irodoriModelDirectory, undefined);
  assert.equal(state.irodoriReferenceAudioPath, undefined);
  assert.equal(state.kokoroVoice, "jf_alpha");
  assert.equal(state.kokoroSpeed, 1);
  assert.equal(state.kokoroDevice, "auto");
  assert.equal(state.kokoroModelDirectory, undefined);
  assert.equal(state.voiceActivationMode, "vad");
  assert.equal(state.vadSensitivity, "normal");
  assert.equal(state.voiceAutoSend, true);
  assert.equal(state.codexChatModel, "");
  assert.equal(state.codexChatReasoningEffort, "");
  assert.equal(state.codexWorkModel, "");
  assert.equal(state.codexWorkReasoningEffort, "");
  assert.equal(state.hasWorkDirectory, false);
  assert.equal(state.workDirectoryName, "");
});

test("preferences store a separate realtime voice for each character", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const file = path.join(directory, "preferences.json");
  fs.writeFileSync(file, JSON.stringify({
    realtimeVoice: "sol",
    characterTtsProfiles: {
      "amber-avatar": { provider: "system", realtimeVoice: "ember" },
      "sage-avatar": { provider: "kokoro", realtimeVoice: "not-a-voice" },
    },
  }));
  const preferences = new Preferences(file);
  assert.equal(preferences.data.characterTtsProfiles["amber-avatar"].realtimeVoice, "ember");
  assert.equal(preferences.data.characterTtsProfiles["sage-avatar"].realtimeVoice, "sol");
});

test("preferences persist and sanitize English pronunciation settings", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const file = path.join(directory, "preferences.json");
  const preferences = new Preferences(file);
  preferences.patch({ englishPronunciationEnabled: false, englishPronunciationDictionary: "Foo=フー" });
  const restored = new Preferences(file).publicState();
  assert.equal(restored.englishPronunciationEnabled, false);
  assert.equal(restored.englishPronunciationDictionary, "Foo=フー");

  fs.writeFileSync(file, JSON.stringify({ englishPronunciationEnabled: "yes", englishPronunciationDictionary: 42 }));
  const sanitized = new Preferences(file).publicState();
  assert.equal(sanitized.englishPronunciationEnabled, true);
  assert.equal(sanitized.englishPronunciationDictionary, "");
});

test("preferences migrate the former Codex model to chat and work", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const file = path.join(directory, "preferences.json");
  fs.writeFileSync(file, JSON.stringify({ codexModel: "legacy-model" }));
  const state = new Preferences(file).publicState();
  assert.equal(state.codexChatModel, "legacy-model");
  assert.equal(state.codexWorkModel, "legacy-model");
});

test("preferences migrate removed wake-word activation to VAD", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const file = path.join(directory, "preferences.json");
  fs.writeFileSync(file, JSON.stringify({ voiceActivationMode: "wake-word", voiceWakeWord: "ぷるぺっと" }));
  const state = new Preferences(file).publicState();
  assert.equal(state.voiceActivationMode, "vad");
  assert.equal(state.vadSensitivity, "normal");
  assert.equal(Object.prototype.hasOwnProperty.call(state, "voiceWakeWord"), false);
});

test("preferences migrate the former Irodori default to Sway 8", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "purupet-preferences-"));
  const file = path.join(root, "preferences.json");
  fs.writeFileSync(file, JSON.stringify({ irodoriSteps: 16 }));
  const preferences = new Preferences(file);
  const state = preferences.publicState();
  assert.equal(state.irodoriSamplingMode, "sway");
  assert.equal(state.irodoriSteps, 8);
  fs.rmSync(root, { recursive: true, force: true });
});

test("preferences expose only the work folder name to renderer windows", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-work-"));
  const preferences = new Preferences(path.join(directory, "preferences.json"));
  preferences.patch({ interactionMode: "work", workDirectory: path.join(directory, "private-project") });
  const state = preferences.publicState();
  assert.equal(state.interactionMode, "work");
  assert.equal(state.workDirectoryName, "private-project");
  assert.equal(Object.prototype.hasOwnProperty.call(state, "workDirectory"), false);
});
