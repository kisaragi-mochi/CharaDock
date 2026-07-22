// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { StreamingTextSegmenter, sanitizeSpeechText } = require("../lib/speech-stream.cjs");

test("streaming speech emits complete sentences once and flushes the remainder", () => {
  const segmenter = new StreamingTextSegmenter();
  assert.deepEqual(segmenter.push("今日は晴れ"), []);
  assert.deepEqual(segmenter.push("今日は晴れです。次は"), ["今日は晴れです。"]);
  assert.deepEqual(segmenter.push("今日は晴れです。次は買い物です！あとで"), ["次は買い物です！"]);
  assert.deepEqual(segmenter.push("今日は晴れです。次は買い物です！あとで", { flush: true }), ["あとで"]);
  assert.deepEqual(segmenter.push("今日は晴れです。次は買い物です！あとで", { flush: true }), []);
});

test("streaming speech bounds long text before punctuation", () => {
  const segmenter = new StreamingTextSegmenter({ maxLength: 24 });
  const result = segmenter.push("これは句読点を含まない非常に長い文章なので途中でも音声生成を始められるように分割します");
  assert.equal(result.length, 1);
  assert.ok(result[0].length <= 24);
});

test("speech text removes markdown links and raw URLs", () => {
  assert.equal(sanitizeSpeechText("- [公式サイト](https://example.com) を確認 https://example.com/a"), "公式サイト を確認");
  assert.equal(sanitizeSpeechText("晴れです。 citeturn5search2"), "晴れです。");
});
