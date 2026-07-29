// SPDX-License-Identifier: Apache-2.0

const { findNaturalSpeechBoundary } = require("./natural-speech-chunks.cjs");

function sanitizeSpeechText(value) {
  const cleaned = String(value || "")
    .replace(/cite[^]*(?:|$)/gu, " ")
    .replace(/cite(?:[^]*)?$/gu, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`[^`]+`/g, " ")
    .replace(/<https?:\/\/[^>]+>/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\b[A-Za-z]:\\[^\s]+/g, " ")
    .replace(/(^|\s)(?:\.{0,2}\/|\/)[^\s]+/g, "$1")
    .replace(/(^|\s)--?[a-z][\w-]*/g, "$1")
    .replace(/\b[\w-]+\.(?:js|cjs|mjs|ts|tsx|jsx|json|yaml|yml|toml|ini|exe|dll|wasm|onnx|bin|zip|png|jpe?g|webp|wav|mp3|md)\b/gi, " ")
    .replace(/\b[A-Fa-f0-9]{20,}\b/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}|[-*+] |\d+[.)] )/gm, "")
    .replace(/^\s*[-*_~=|]{3,}\s*$/gm, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/[>*_~#@&^<>\[\]{}|=+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : "";
}

class StreamingTextSegmenter {
  constructor({ maxLength = 90 } = {}) {
    this.maxLength = Math.max(24, Math.min(160, Number(maxLength) || 90));
    this.fullText = "";
    this.consumed = 0;
  }

  reset() {
    this.fullText = "";
    this.consumed = 0;
  }

  push(value, { flush = false } = {}) {
    const next = String(value || "");
    if (!next.startsWith(this.fullText)) this.reset();
    this.fullText = next;
    const output = [];

    while (this.consumed < this.fullText.length) {
      const remaining = this.fullText.slice(this.consumed);
      const sentence = remaining.match(/^[\s\S]*?[。！？!?]+[」』】）)\]"'”’]*(?:\s+|$)?/);
      let length = sentence?.[0]?.length || 0;
      if (!length && remaining.length >= this.maxLength) length = findNaturalSpeechBoundary(remaining, this.maxLength);
      if (!length && flush) length = remaining.length;
      if (!length) break;
      if (length > this.maxLength) length = findNaturalSpeechBoundary(remaining, this.maxLength);

      const raw = remaining.slice(0, length);
      this.consumed += length;
      const spoken = sanitizeSpeechText(raw);
      if (spoken) output.push(spoken);
    }
    return output;
  }
}

module.exports = { StreamingTextSegmenter, sanitizeSpeechText };
