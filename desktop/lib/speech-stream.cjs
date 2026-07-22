// SPDX-License-Identifier: Apache-2.0

function sanitizeSpeechText(value) {
  return String(value || "")
    .replace(/cite[^]*(?:|$)/gu, " ")
    .replace(/cite(?:[^]*)?$/gu, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/^\s{0,3}(?:#{1,6}|[-*+] |\d+[.)] )/gm, "")
    .replace(/[>*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findNaturalBoundary(text, limit) {
  const head = text.slice(0, limit + 1);
  let best = -1;
  for (const marker of ["。", "！", "？", "!", "?", "\n", "、", ". ", ", ", " "]) {
    const index = head.lastIndexOf(marker);
    if (index >= Math.floor(limit * .45)) best = Math.max(best, index + marker.length);
  }
  return best > 0 ? best : limit;
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
      if (!length && remaining.length >= this.maxLength) length = findNaturalBoundary(remaining, this.maxLength);
      if (!length && flush) length = remaining.length;
      if (!length) break;
      if (length > this.maxLength) length = findNaturalBoundary(remaining, this.maxLength);

      const raw = remaining.slice(0, length);
      this.consumed += length;
      const spoken = sanitizeSpeechText(raw);
      if (spoken) output.push(spoken);
    }
    return output;
  }
}

module.exports = { StreamingTextSegmenter, sanitizeSpeechText };
