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
  assert.equal(state.styleBertVits2Url, "http://localhost:5000");
  assert.equal(state.styleBertVits2ModelId, 0);
  assert.equal(state.styleBertVits2Speed, 1);
  assert.equal(state.speechInputProvider, "auto");
  assert.equal(state.sherpaOnnxUrl, "ws://localhost:6006");
  assert.equal(state.codexChatModel, "");
  assert.equal(state.codexChatReasoningEffort, "");
  assert.equal(state.codexWorkModel, "");
  assert.equal(state.codexWorkReasoningEffort, "");
  assert.equal(state.hasWorkDirectory, false);
  assert.equal(state.workDirectoryName, "");
});

test("preferences migrate the former Codex model to chat and work", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupuru-prefs-"));
  const file = path.join(directory, "preferences.json");
  fs.writeFileSync(file, JSON.stringify({ codexModel: "legacy-model" }));
  const state = new Preferences(file).publicState();
  assert.equal(state.codexChatModel, "legacy-model");
  assert.equal(state.codexWorkModel, "legacy-model");
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
