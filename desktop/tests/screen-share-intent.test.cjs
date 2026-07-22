// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { screenShareConversationAction } = require("../lib/screen-share-intent.cjs");

test("screen sharing is proposed from natural visual-context requests", () => {
  assert.equal(screenShareConversationAction("今の画面を見て、どこがおかしいか教えて"), "request");
  assert.equal(screenShareConversationAction("スクショを確認して"), "request");
  assert.equal(screenShareConversationAction("画面を撮影して内容を教えて"), "request");
  assert.equal(screenShareConversationAction("デスクトップをキャプチャして"), "request");
  assert.equal(screenShareConversationAction("明日の予定を教えて"), "");
});

test("a pending screen share can be approved or denied conversationally", () => {
  assert.equal(screenShareConversationAction("いいよ、見て", true), "approve");
  assert.equal(screenShareConversationAction("どうぞ", true), "approve");
  assert.equal(screenShareConversationAction("今は共有しない", true), "deny");
  assert.equal(screenShareConversationAction("別の話をしよう", true), "replace");
});
