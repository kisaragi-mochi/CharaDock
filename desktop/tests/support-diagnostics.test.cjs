// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { createSupportBundle, redactDiagnosticText, sanitizeDiagnosticValue } = require("../lib/support-diagnostics.cjs");

test("diagnostic text redacts credentials, tokens, and user home paths", () => {
  const text = redactDiagnosticText("C:\\Users\\Kai\\app sk-secret123456 token=abcdef123456 Bearer top.secret.value", {
    homeDirectories: ["C:\\Users\\Kai"],
  });
  assert.doesNotMatch(text, /secret123456|abcdef123456|top\.secret|Users\\Kai/);
  assert.match(text, /<USER_HOME>/);
});

test("diagnostic objects drop content-bearing and sensitive fields", () => {
  const safe = sanitizeDiagnosticValue({ platform: "win32", apiKey: "sk-secret123456", conversationHistory: ["private"], nested: { token: "secret", ready: true } });
  assert.deepEqual(safe, { platform: "win32", nested: { ready: true } });
});

test("support bundle is a ZIP containing diagnostics without private values", () => {
  const bundle = createSupportBundle({ app: { version: "0.1.0" }, settings: { backend: "codex" } }, "safe log\n");
  assert.equal(bundle.readUInt32LE(0), 0x04034b50);
  assert.match(bundle.toString("utf8"), /diagnostics\.json/);
  assert.match(bundle.toString("utf8"), /charadock\.log/);
  assert.doesNotMatch(bundle.toString("utf8"), /conversationHistory/);
});
