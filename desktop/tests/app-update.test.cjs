// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  RELEASES_PAGE_URL,
  checkForAppUpdate,
  compareVersions,
  releasePageUrl,
  selectLatestRelease,
} = require("../lib/app-update.cjs");

test("app update versions compare stable and prerelease builds correctly", () => {
  assert.equal(compareVersions("0.1.3", "0.1.2"), 1);
  assert.equal(compareVersions("v1.0.0-beta.2", "1.0.0-beta.1"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0-beta.9"), 1);
  assert.equal(compareVersions("not-a-version", "1.0.0"), null);
});

test("stable update checks ignore drafts and prereleases", async () => {
  const releases = [
    { tag_name: "v0.2.0-beta.1", prerelease: true, draft: false },
    { tag_name: "v0.1.3", name: "CharaDock 0.1.3", body: "Fixes", prerelease: false, draft: false },
    { tag_name: "v9.0.0", prerelease: false, draft: true },
  ];
  assert.equal(selectLatestRelease(releases, "stable").version, "0.1.3");
  assert.equal(selectLatestRelease(releases, "beta").version, "0.2.0-beta.1");
  const result = await checkForAppUpdate({
    currentVersion: "0.1.2",
    fetchImpl: async () => ({ ok: true, json: async () => releases }),
  });
  assert.equal(result.status, "available");
  assert.equal(result.releaseUrl, `${RELEASES_PAGE_URL}/tag/v0.1.3`);
});

test("stable update checks use the latest prerelease until the first stable release exists", () => {
  const prereleases = [
    { tag_name: "v0.1.2", prerelease: true, draft: false },
    { tag_name: "v0.1.1", prerelease: true, draft: false },
  ];
  assert.equal(selectLatestRelease(prereleases, "stable").version, "0.1.2");
});

test("release links are constructed only from semantic version tags", () => {
  assert.equal(releasePageUrl("v0.1.2"), `${RELEASES_PAGE_URL}/tag/v0.1.2`);
  assert.equal(releasePageUrl("../../malicious"), RELEASES_PAGE_URL);
});
