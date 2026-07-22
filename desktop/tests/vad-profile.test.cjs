// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { vadProfile } = require("../lib/vad-profile.cjs");

test("VAD sensitivity becomes progressively easier to trigger", () => {
  const low = vadProfile("low");
  const normal = vadProfile("normal");
  const high = vadProfile("high");
  assert.ok(low.startMin > normal.startMin && normal.startMin > high.startMin);
  assert.ok(low.onsetMs > normal.onsetMs && normal.onsetMs > high.onsetMs);
  assert.ok(low.silenceMs > normal.silenceMs && normal.silenceMs > high.silenceMs);
});

test("unknown VAD sensitivity uses the conservative normal profile", () => {
  assert.equal(vadProfile("unknown"), vadProfile("normal"));
});
