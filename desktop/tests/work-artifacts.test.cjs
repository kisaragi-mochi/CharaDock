// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { discoverWorkArtifacts, fileChangeCandidates, relativeArtifactPath } = require("../lib/work-artifacts.cjs");

test("work artifacts combine file-change events and response links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-artifacts-"));
  fs.mkdirSync(path.join(root, "dist"));
  fs.writeFileSync(path.join(root, "dist", "report.html"), "done");
  fs.writeFileSync(path.join(root, "README.md"), "done");
  const eventCandidates = fileChangeCandidates({ type: "fileChange", changes: [{ path: "README.md", kind: "update" }] });
  const artifacts = discoverWorkArtifacts(root, {
    eventCandidates,
    resultText: "[レポート](dist/report.html) を作成しました。",
  });
  assert.deepEqual(artifacts.map((item) => item.path), ["dist/report.html", "README.md"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("artifact paths cannot escape the selected work folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-artifacts-"));
  const outside = path.join(path.dirname(root), "outside-secret.txt");
  fs.writeFileSync(outside, "secret");
  assert.equal(relativeArtifactPath(root, "../outside-secret.txt"), "");
  assert.deepEqual(discoverWorkArtifacts(root, { resultText: `[外部](${outside})` }), []);
  if (process.platform !== "win32") {
    fs.symlinkSync(outside, path.join(root, "linked-secret.txt"));
    assert.deepEqual(discoverWorkArtifacts(root, { resultText: "`linked-secret.txt`" }), []);
  }
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { force: true });
});
