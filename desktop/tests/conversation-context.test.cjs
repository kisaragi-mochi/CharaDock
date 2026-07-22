// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { boundedConversationHistory, recentConversationContext } = require("../lib/conversation-context.cjs");

test("recent conversation context preserves an elliptical weather follow-up", () => {
  const history = boundedConversationHistory([], "名古屋の天気は？", "今日は晴れです。");
  const context = recentConversationContext(history);
  assert.match(context, /ユーザー: 名古屋の天気は？/);
  assert.match(context, /キャラクター: 今日は晴れです。/);
  assert.match(context, /『明日は？』/);
});

test("conversation backup stays bounded", () => {
  let history = [];
  for (let index = 0; index < 10; index += 1) history = boundedConversationHistory(history, `u${index}`, `a${index}`);
  assert.equal(history.length, 12);
  assert.equal(history[0].text, "u4");
  assert.equal(history.at(-1).text, "a9");
});
