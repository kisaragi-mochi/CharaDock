// SPDX-License-Identifier: Apache-2.0

function expressionForText(text, { listening = false } = {}) {
  const value = String(text || "");
  const durationScale = listening ? 0.72 : 1;
  const make = (emotion, forceMouth, forceEyesClosed, durationMs) => ({
    emotion,
    forceMouth,
    forceEyesClosed,
    durationMs: Math.round(durationMs * durationScale),
  });

  if (/眠|おやす|疲れ|休も|休ん|つら|辛い|悲し|さみし|寂し|ごめん|残念/.test(value)) {
    return make("soft", 0, false, 2200);
  }
  if (/[!?！？]{2,}|びっくり|驚|まさか|すごい|本当[？?]|えっ|わっ/.test(value)) {
    return make("surprised", 2, false, 1500);
  }
  if (/ありがとう|うれし|嬉し|よかった|楽しい|好き|最高|できた|成功|おめでとう|😊|😄|笑|ｗ/.test(value)) {
    return make("happy", 1, false, 2100);
  }
  if (/[?？]|どう思|なぜ|なんで|教えて|考え/.test(value)) {
    return make("thinking", 0, false, 1150);
  }
  return make(listening ? "listening" : "neutral", listening ? 0 : 1, false, listening ? 850 : 1050);
}

function messageExpression(text) {
  return expressionForText(text, { listening: true });
}

function responseExpression(text) {
  return expressionForText(text);
}

module.exports = { expressionForText, messageExpression, responseExpression };
