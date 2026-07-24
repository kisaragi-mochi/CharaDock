// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
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
