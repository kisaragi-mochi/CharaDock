// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

test("desktop distribution contains only the three cleared built-in character sets", () => {
  const files = packageJson.build.files;
  const assetEntries = files.filter((entry) => entry.startsWith("assets/"));
  assert.deepEqual(assetEntries.sort(), [
    "assets/amber-avatar/**/*",
    "assets/bronze-avatar/**/*",
    "assets/silver-hood-avatar/**/*",
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
