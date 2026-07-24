// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { normalizeRealtimeVoice, normalizeRealtimeVoiceList } = require("../lib/realtime-voice.cjs");

test("realtime voice selection accepts current app-server voices only", () => {
  assert.equal(normalizeRealtimeVoice("Ember"), "ember");
  assert.equal(normalizeRealtimeVoice("marin"), "cove");
});

test("realtime voice list exposes only the voice set accepted by Realtime V3", () => {
  assert.deepEqual(normalizeRealtimeVoiceList({ voices: {
    v2: ["marin", "cedar", "invalid"],
    v1: ["cove", "ember"],
    defaultV1: "cove",
  } }), {
    voices: ["cove", "ember"],
    defaultVoice: "cove",
  });
});

test("Realtime voice preview and character click speech are wired through appendSpeech", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "control.html"), "utf8");
  const control = fs.readFileSync(path.join(root, "control.js"), "utf8");
  const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(root, "preload-control.cjs"), "utf8");
  assert.match(html, /id="realtimeVoiceTestButton"/);
  assert.match(control, /addTransceiver\("audio", \{ direction: "recvonly" \}\)/);
  assert.match(control, /appendCodexRealtimeSpeech\(sample\)/);
  assert.match(main, /codexClient\.appendRealtimeSpeech\(spokenText\)/);
  assert.match(preload, /audio:realtimeAppendSpeech/);
});
