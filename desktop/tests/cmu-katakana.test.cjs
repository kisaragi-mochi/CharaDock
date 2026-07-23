// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  arpabetToKatakana,
  cmuPronunciation,
  cmuWordToKatakana,
} = require("../lib/cmu-katakana.cjs");

test("ARPABET phonemes are converted to compact Katakana readings", () => {
  assert.equal(arpabetToKatakana("HH AH0 L OW1"), "ハロー");
  assert.equal(arpabetToKatakana("W ER1 L D"), "ワールド");
});

test("CMUdict lookup is case insensitive and returns nothing for missing entries", () => {
  assert.equal(cmuPronunciation("Hello"), "HH AH0 L OW1");
  assert.equal(cmuWordToKatakana("HELLO"), "ハロー");
  assert.equal(cmuWordToKatakana("notarealcmudictword"), "");
});
