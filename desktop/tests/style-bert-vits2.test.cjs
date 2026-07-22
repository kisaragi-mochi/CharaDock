// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  audioMimeType,
  splitTtsText,
  styleBertVoiceEndpoint,
  synthesizeStyleBertVits2,
} = require("../lib/style-bert-vits2.cjs");

test("Style-Bert-VITS2 audio MIME type follows the response or file signature", () => {
  assert.equal(audioMimeType(Buffer.from("RIFF"), "audio/x-wav; charset=binary"), "audio/x-wav");
  assert.equal(audioMimeType(Buffer.from("OggS"), "application/octet-stream"), "audio/ogg");
  assert.equal(audioMimeType(Buffer.from("ID3x"), "application/octet-stream"), "audio/mpeg");
});

test("Style-Bert-VITS2 endpoint accepts only local HTTP servers", () => {
  assert.equal(styleBertVoiceEndpoint("http://localhost:5000/docs").href, "http://localhost:5000/voice");
  assert.equal(styleBertVoiceEndpoint("http://127.0.0.1:5000/voice").href, "http://127.0.0.1:5000/voice");
  assert.throws(() => styleBertVoiceEndpoint("https://example.com"), /localhost/);
  assert.throws(() => styleBertVoiceEndpoint("file:///tmp/audio"), /localhost/);
});

test("Style-Bert-VITS2 text respects the 100 character API limit", () => {
  const chunks = splitTtsText("長い文章です。".repeat(40));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
});

test("Style-Bert-VITS2 synthesis maps speaking speed to inverse length", async () => {
  let requestedUrl;
  const result = await synthesizeStyleBertVits2({
    text: "音声テストです。",
    url: "http://localhost:5000/docs",
    modelId: 3,
    speed: 1.25,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200, headers: { "content-type": "audio/wav" } });
    },
  });
  assert.equal(requestedUrl.pathname, "/voice");
  assert.equal(requestedUrl.searchParams.get("model_id"), "3");
  assert.equal(requestedUrl.searchParams.get("length"), "0.8");
  assert.equal(requestedUrl.searchParams.get("language"), "JP");
  assert.deepEqual(result.audioDataUrls, ["data:audio/wav;base64,UklGRg=="]);
});
