// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { findNaturalSpeechBoundary, splitNaturalSpeechText } = require("../lib/natural-speech-chunks.cjs");

test("BudouX boundaries keep Japanese TTS chunks on natural clauses", () => {
  assert.deepEqual(splitNaturalSpeechText(
    "音声合成モデルの推論速度を改善しながら自然な発話の区切りも維持します",
    28,
  ), ["音声合成モデルの推論速度を改善しながら", "自然な発話の区切りも維持します"]);
  assert.equal(findNaturalSpeechBoundary(
    "本日は晴天ですが午後から雲が増える見込みなので洗濯物は早めに取り込んでください",
    28,
  ), "本日は晴天ですが午後から雲が増える見込みなので".length);
});

test("sentence punctuation wins over phrase boundaries and chunks stay bounded", () => {
  const text = "今日は晴れです。明日は午後から雨が降る可能性があります。傘を持っていくと安心です。";
  const chunks = splitNaturalSpeechText(text, 28, 10);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 28));
  assert.equal(chunks[0], "今日は晴れです。");
});
