// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { messageExpression, responseExpression } = require("../lib/expression.cjs");

test("conversation text maps to distinct mascot expressions", () => {
  assert.equal(responseExpression("できた！ありがとう").emotion, "happy");
  assert.equal(responseExpression("えっ！？まさか！").emotion, "surprised");
  assert.equal(responseExpression("今日は疲れた。おやすみ").emotion, "soft");
  assert.equal(responseExpression("どう思う？").emotion, "thinking");
});

test("user-message reaction is shorter than the reply expression", () => {
  assert.ok(messageExpression("ありがとう").durationMs < responseExpression("ありがとう").durationMs);
});
