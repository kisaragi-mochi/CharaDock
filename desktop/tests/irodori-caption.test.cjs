// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  dynamicIrodoriCaption,
  irodoriEmotionForText,
  normalizeIrodoriEmotionStrength,
} = require("../lib/irodori-caption.cjs");

test("Irodori v4 caption follows the same emotion used by the mascot", () => {
  assert.equal(irodoriEmotionForText("できた！ありがとう"), "happy");
  assert.equal(irodoriEmotionForText("えっ！？まさか！"), "surprised");
  assert.equal(irodoriEmotionForText("今日は疲れた。おやすみ"), "sad");
  assert.equal(irodoriEmotionForText("それは許せない、腹が立つ"), "angry");
  assert.equal(irodoriEmotionForText("どう思う？"), "thinking");
});

test("dynamic Irodori caption preserves the character direction and adds a bounded instruction", () => {
  const result = dynamicIrodoriCaption("低めで落ち着いた声。", "成功したよ、ありがとう！", { strength: "natural" });
  assert.match(result.caption, /^低めで落ち着いた声。/);
  assert.match(result.caption, /明るく嬉しそう/);
  assert.equal(result.emotion, "happy");
  assert.equal(result.dynamic, true);
  assert.ok(result.caption.length <= 1000);
});

test("dynamic Irodori caption can be disabled and neutral speech avoids needless changes", () => {
  assert.deepEqual(dynamicIrodoriCaption("静かな声。", "通常のお知らせです。", { enabled: true }), {
    caption: "静かな声。", emotion: "neutral", instruction: "", dynamic: false,
  });
  assert.equal(dynamicIrodoriCaption("静かな声。", "すごい！", { enabled: false }).caption, "静かな声。");
});

test("Irodori emotion strength uses three stable caption variants", () => {
  assert.equal(normalizeIrodoriEmotionStrength("subtle"), "subtle");
  assert.equal(normalizeIrodoriEmotionStrength("expressive"), "expressive");
  assert.equal(normalizeIrodoriEmotionStrength("unknown"), "natural");
  const subtle = dynamicIrodoriCaption("自然な声。", "うれしい！", { strength: "subtle" }).caption;
  const expressive = dynamicIrodoriCaption("自然な声。", "うれしい！", { strength: "expressive" }).caption;
  assert.notEqual(subtle, expressive);
});
