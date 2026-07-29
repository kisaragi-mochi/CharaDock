// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

test("desktop distribution contains only approved character and reference-voice assets", () => {
  const files = packageJson.build.files;
  const assetEntries = files.filter((entry) => entry.startsWith("assets/"));
  assert.deepEqual(assetEntries.sort(), [
    "assets/amber-avatar/**/*",
    "assets/bronze-avatar/**/*",
    "assets/reference-voices/**/*",
    "assets/sage-avatar/**/*",
    "assets/towa-avatar/**/*",
  ]);
  assert.equal(files.some((entry) => entry.includes("demo-avatar")), false);
  assert.equal(files.includes("favicon.ico"), false);
});

test("desktop distribution includes its license and modification records", () => {
  const files = packageJson.build.files;
  for (const required of ["LICENSE", "NOTICE", "MODIFICATIONS.md", "DISTRIBUTION_ASSET_LICENSE.md", "THIRD_PARTY_NOTICES.md"]) {
    assert.equal(files.includes(required), true, `${required} must be packaged`);
  }
});

test("Windows package metadata identifies ochisamu as the publisher", () => {
  assert.equal(packageJson.author, "ochisamu");
  assert.match(packageJson.build.copyright, /ochisamu/);
});

test("voice input UI requires one explicit supported provider", () => {
  const html = fs.readFileSync(path.join(projectRoot, "desktop", "control.html"), "utf8");
  const main = fs.readFileSync(path.join(projectRoot, "desktop", "main.cjs"), "utf8");
  const select = html.match(/<select id="speechInputProviderSelect">([\s\S]*?)<\/select>/)?.[1] || "";
  for (const provider of ["realtime", "sherpa-onnx", "browser", "openai"]) {
    assert.match(select, new RegExp(`<option value="${provider}">`));
  }
  assert.doesNotMatch(select, /<option value="(?:auto|codex-audio)">/);
  assert.doesNotMatch(main, /audio:sendCodex|mascotInline:chatAudio/);
});

test("settings conversation stays text-only and character voice routing is explicit", () => {
  const html = fs.readFileSync(path.join(projectRoot, "desktop", "control.html"), "utf8");
  assert.doesNotMatch(html, /id="(?:micLipSyncButton|speechInputButton|speechInputMode|micMeter)"/);
  for (const id of ["characterVoiceMount", "voiceRoutingSummary", "realtimeVoiceSettings", "standardTtsSettings"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("Codex memory tools proactively create and update character memories", () => {
  const main = fs.readFileSync(path.join(projectRoot, "desktop", "main.cjs"), "utf8");
  assert.match(main, /name: "memory_save"/);
  assert.match(main, /name: "memory_update"/);
  assert.match(main, /Evaluate every user message for durable personalization/);
});
