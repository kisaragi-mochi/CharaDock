// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const EXPECTED = Object.freeze({
  "hiro.wav": "23c8fd4deb6c7164048a42f46a26c168e012d3bb733ae39f9439618ca1f9c927",
  "kohaku.wav": "e5fc3fdd29b9dac1238172d0254cfddf9df80c204085125a9dce646b669a2f56",
});

test("bundled Irodori reference voices are stable PCM WAV assets included in packaging", () => {
  for (const [name, expectedHash] of Object.entries(EXPECTED)) {
    const bytes = fs.readFileSync(path.join(projectRoot, "assets", "reference-voices", name));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WAVE");
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expectedHash);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(packageJson.build.files.includes("assets/reference-voices/**/*"), true);
  const notices = fs.readFileSync(path.join(projectRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notices, /あみたろの声素材工房/);
  assert.match(notices, /https:\/\/amitaro\.net\/voice\/voice_rule\//);
});
