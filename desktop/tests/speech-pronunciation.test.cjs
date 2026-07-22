// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeSpeechPronunciation } = require("../lib/speech-pronunciation.cjs");

test("known alphabetic product names are pronounced as words", () => {
  assert.equal(
    normalizeSpeechPronunciation("Codexでbrowserとsherpa-onnxを使う"),
    "コーデックスでブラウザーとシェルパオニキスを使う",
  );
});

test("all-caps abbreviations are expanded to Japanese letter names", () => {
  assert.equal(normalizeSpeechPronunciation("APIとGPUとVAD"), "エーピーアイとジーピーユーとブイエーディー");
});

test("unknown words and code-like identifiers are preserved", () => {
  assert.equal(normalizeSpeechPronunciation("PuruPet foo.js build_123"), "PuruPet foo.js build_123");
});
