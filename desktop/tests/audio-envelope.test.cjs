// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");
const { createAdaptiveSpeechEnvelope } = require("../audio-envelope.js");

test("adaptive speech envelope ignores silence and expands quiet speech", () => {
  const envelope = createAdaptiveSpeechEnvelope();
  let now = 0;
  for (let index = 0; index < 20; index += 1) envelope.sample(0.001, now += 16.667);
  assert.equal(envelope.state().envelope, 0);
  let level = 0;
  for (let index = 0; index < 4; index += 1) level = envelope.sample(0.016, now += 16.667);
  assert.ok(level > 0.16 && level <= 0.5);
});

test("adaptive speech envelope attacks faster than it releases", () => {
  const envelope = createAdaptiveSpeechEnvelope();
  const attack = envelope.sample(0.08, 16.667);
  const firstRelease = envelope.sample(0, 33.334);
  assert.ok(attack > 0.2);
  assert.ok(firstRelease > 0 && firstRelease < attack);
  let released = firstRelease;
  for (let index = 0; index < 24; index += 1) released = envelope.sample(0, 50 + index * 16.667);
  assert.equal(released, 0);
});
