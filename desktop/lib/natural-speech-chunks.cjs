// SPDX-License-Identifier: Apache-2.0
const path = require("node:path");

// Load only BudouX's parser and Japanese model. Its public entry also loads the
// HTML processor, which is unnecessary for plain TTS text.
const budouxDirectory = path.dirname(require.resolve("budoux"));
const { Parser } = require(path.join(budouxDirectory, "parser.js"));
const { model: japaneseModel } = require(path.join(budouxDirectory, "data", "models", "ja.js"));
const japaneseParser = new Parser(japaneseModel);

const SENTENCE_END = /[。！？!?]/u;
const SOFT_BREAK = /[、，,:：；;]|\.\s/u;
const TRAILING_CLOSER = /[」』】）)\]"'”’]/u;

function includeTrailingPunctuation(text, boundary, limit) {
  let end = boundary;
  while (end < text.length && end < limit && (TRAILING_CLOSER.test(text[end]) || SENTENCE_END.test(text[end]))) end += 1;
  return end;
}

function lastExplicitBoundary(text, limit, minimum, matcher) {
  let best = -1;
  const head = text.slice(0, limit);
  for (let index = 0; index < head.length; index += 1) {
    if (!matcher.test(head[index])) continue;
    let end = index + 1;
    while (end < head.length && (matcher.test(head[end]) || TRAILING_CLOSER.test(head[end]))) end += 1;
    if (end >= minimum) best = end;
  }
  return best;
}

function firstSentenceBoundary(text, limit) {
  const head = text.slice(0, limit);
  for (let index = 0; index < head.length; index += 1) {
    if (!SENTENCE_END.test(head[index])) continue;
    let end = index + 1;
    while (end < head.length && (SENTENCE_END.test(head[end]) || TRAILING_CLOSER.test(head[end]))) end += 1;
    return end;
  }
  return -1;
}

function phraseBoundaryScore(text, boundary, limit) {
  const before = text.slice(0, boundary);
  let score = boundary / limit;
  // Clause and predicate endings are good places for a brief spoken pause,
  // even when the model omitted a Japanese comma.
  if (/(?:ので|のに|けれども?|けど|ですが|だが|ながら|つつ|ため|ならば?|から|場合|一方|ものの|ように)$/u.test(before)) return score + .4;
  if (/(?:です|ます|でした|ました|ません|である|ください|しよう|している|していた|できる|なる)$/u.test(before)) score += .35;
  // BudouX also proposes visual line breaks after short particles. They are
  // useful fallbacks, but usually sound less natural than a clause boundary.
  if (/(?:の|を|が|に|へ|と|や|な)$/u.test(before)) score -= .65;
  return score;
}

function findNaturalSpeechBoundary(value, maxLength, { minimumRatio = .45 } = {}) {
  const text = String(value || "");
  const limit = Math.max(1, Math.min(text.length, Number(maxLength) || text.length));
  if (text.length <= limit) return text.length;
  const minimum = Math.max(1, Math.floor(limit * minimumRatio));

  const sentenceBoundary = firstSentenceBoundary(text, limit);
  if (sentenceBoundary > 0) return sentenceBoundary;
  const punctuationBoundary = lastExplicitBoundary(text, limit, minimum, SOFT_BREAK);
  if (punctuationBoundary > 0) return punctuationBoundary;

  // BudouX needs only a few following characters for its feature window. A
  // small look-ahead keeps the boundary before `limit` stable without parsing
  // the remainder of a very long response.
  const phrases = japaneseParser.parse(text.slice(0, Math.min(text.length, limit + 4)));
  let consumed = 0;
  let phraseBoundary = -1;
  let phraseScore = -Infinity;
  for (const phrase of phrases) {
    consumed += phrase.length;
    if (consumed > limit) break;
    if (consumed < minimum) continue;
    const score = phraseBoundaryScore(text, consumed, limit);
    if (score >= phraseScore) {
      phraseScore = score;
      phraseBoundary = consumed;
    }
  }
  if (phraseBoundary > 0) return includeTrailingPunctuation(text, phraseBoundary, limit);

  const whitespace = text.slice(0, limit).search(/\s+[^\s]*$/u);
  return whitespace >= minimum ? whitespace + 1 : limit;
}

function splitNaturalSpeechText(value, maxLength = 100, maxChunks = 10, { maxOverflow = 0 } = {}) {
  let remaining = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength * maxChunks);
  const chunks = [];
  while (remaining && chunks.length < maxChunks) {
    if (remaining.length <= maxLength + Math.max(0, maxOverflow)) {
      chunks.push(remaining);
      break;
    }
    const splitAt = findNaturalSpeechBoundary(remaining, maxLength);
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks.filter(Boolean);
}

module.exports = { findNaturalSpeechBoundary, splitNaturalSpeechText };
