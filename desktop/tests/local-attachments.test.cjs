// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { localAttachmentInstructions, normalizeLocalAttachments } = require("../lib/local-attachments.cjs");

function fakeFs(entries) {
  return {
    realpathSync(value) { if (!entries[value]) throw new Error("missing"); return value; },
    statSync(value) { return { isFile: () => entries[value].file, size: entries[value].size }; },
  };
}

test("local attachments accept unique regular files and identify images", () => {
  const root = process.platform === "win32" ? "C:\\tmp" : "/tmp";
  const text = `${root}${process.platform === "win32" ? "\\" : "/"}notes.txt`;
  const image = `${root}${process.platform === "win32" ? "\\" : "/"}face.png`;
  const result = normalizeLocalAttachments([text, image, text], fakeFs({
    [text]: { file: true, size: 20 },
    [image]: { file: true, size: 40 },
  }));
  assert.deepEqual(result.map(({ name, image: isImage }) => [name, isImage]), [["notes.txt", false], ["face.png", true]]);
});

test("local attachments reject folders, missing files, and excessive lists", () => {
  const root = process.platform === "win32" ? "C:\\tmp" : "/tmp";
  assert.throws(() => normalizeLocalAttachments([root], fakeFs({ [root]: { file: false, size: 0 } })), /フォルダー/);
  assert.throws(() => normalizeLocalAttachments([`${root}/missing`], fakeFs({})), /見つかりません/);
  assert.throws(() => normalizeLocalAttachments(Array.from({ length: 9 }, (_, index) => `${root}/${index}`), fakeFs({})), /8個/);
});

test("attachment instructions mark file content as untrusted", () => {
  const text = localAttachmentInstructions([{ path: "/tmp/notes.txt" }], "ja");
  assert.match(text, /\/tmp\/notes\.txt/);
  assert.match(text, /信頼できないデータ/);
});
