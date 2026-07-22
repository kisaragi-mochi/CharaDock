// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { sherpaOnnxEndpoint } = require("../lib/sherpa-onnx.cjs");

test("sherpa-onnx endpoint accepts only local unencrypted WebSocket servers", () => {
  assert.equal(sherpaOnnxEndpoint("ws://localhost:6006").href, "ws://localhost:6006/");
  assert.equal(sherpaOnnxEndpoint("ws://127.0.0.1:6006/asr").href, "ws://127.0.0.1:6006/asr");
  assert.throws(() => sherpaOnnxEndpoint("wss://example.com"), /localhost/);
  assert.throws(() => sherpaOnnxEndpoint("ws://example.com:6006"), /localhost/);
});
