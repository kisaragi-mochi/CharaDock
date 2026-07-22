// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { cleanAssistantText, latestWorkDisplayText } = require("../lib/assistant-text.cjs");

test("assistant text removes Codex citation control tokens", () => {
  assert.equal(cleanAssistantText("名古屋は晴れです。 citeturn5search2"), "名古屋は晴れです。");
  assert.equal(cleanAssistantText("回答 citeturn5", { streaming: true }), "回答 ");
});

test("work display keeps only the latest message while retaining a bounded layout", () => {
  assert.equal(latestWorkDisplayText("調査しています。\nファイルを更新しています。"), "ファイルを更新しています。");
  assert.equal(latestWorkDisplayText("確認しました。次にテストします。"), "次にテストします。");
  assert.ok(latestWorkDisplayText("長い説明".repeat(100)).length <= 181);
});
