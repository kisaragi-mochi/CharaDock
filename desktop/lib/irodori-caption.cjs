// SPDX-License-Identifier: Apache-2.0
const { responseExpression } = require("./expression.cjs");

const DEFAULT_IRODORI_CAPTION = "自然で明瞭な日本語。落ち着いた親しみやすい口調で話す。";
const IRODORI_EMOTION_STRENGTHS = Object.freeze(["subtle", "natural", "expressive"]);

const EMOTION_INSTRUCTIONS = Object.freeze({
  subtle: Object.freeze({
    happy: "ほんの少し明るく、嬉しさをにじませて話す。",
    surprised: "驚きをわずかに含め、急ぎすぎずに話す。",
    soft: "声量を少し抑え、やわらかく話す。",
    sad: "やさしく寄り添い、切なさをわずかに含めて話す。",
    angry: "怒鳴らず、強い意志をわずかに込めて話す。",
    thinking: "少し考えるような間合いで、落ち着いて話す。",
  }),
  natural: Object.freeze({
    happy: "明るく嬉しそうに、自然な笑みを含めて話す。",
    surprised: "自然な驚きを含め、少しだけ勢いを上げて話す。",
    soft: "声量を抑え、やさしく穏やかに話す。",
    sad: "やさしく寄り添い、少し切なさを含めて話す。",
    angry: "怒鳴らず、芯のある強い意志を込めて明瞭に話す。",
    thinking: "考えながら語るように、落ち着いた間合いで話す。",
  }),
  expressive: Object.freeze({
    happy: "とても明るく嬉しそうに、弾む調子と笑顔を感じさせて話す。",
    surprised: "はっきりした驚きと高揚感を込め、勢いよく話す。",
    soft: "声量をしっかり抑え、包み込むようにやさしく話す。",
    sad: "深く寄り添い、切なさといたわりを込めて話す。",
    angry: "怒鳴らず、強い意志と緊張感をはっきり込めて話す。",
    thinking: "じっくり考えを巡らせるように、意味のある間合いで話す。",
  }),
});

function normalizeIrodoriEmotionStrength(value) {
  return IRODORI_EMOTION_STRENGTHS.includes(value) ? value : "natural";
}

function irodoriEmotionForText(text) {
  const expression = responseExpression(text);
  if (["sad", "angry"].includes(expression.reaction)) return expression.reaction;
  return ["happy", "surprised", "soft", "thinking"].includes(expression.emotion)
    ? expression.emotion
    : "neutral";
}

function dynamicIrodoriCaption(baseCaption, text, { enabled = true, strength = "natural" } = {}) {
  const base = String(baseCaption || DEFAULT_IRODORI_CAPTION).trim() || DEFAULT_IRODORI_CAPTION;
  const emotion = irodoriEmotionForText(text);
  const normalizedStrength = normalizeIrodoriEmotionStrength(strength);
  const instruction = enabled ? EMOTION_INSTRUCTIONS[normalizedStrength][emotion] || "" : "";
  if (!instruction) return { caption: base.slice(0, 1000), emotion, instruction: "", dynamic: false };
  const available = Math.max(0, 999 - instruction.length);
  return {
    caption: `${base.slice(0, available).trim()} ${instruction}`.trim().slice(0, 1000),
    emotion,
    instruction,
    dynamic: true,
  };
}

module.exports = {
  DEFAULT_IRODORI_CAPTION,
  IRODORI_EMOTION_STRENGTHS,
  dynamicIrodoriCaption,
  irodoriEmotionForText,
  normalizeIrodoriEmotionStrength,
};
