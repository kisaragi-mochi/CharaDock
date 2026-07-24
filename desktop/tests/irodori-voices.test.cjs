// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { IrodoriVoiceLibrary } = require("../lib/irodori-voices.cjs");

function emptyWave() {
  const bytes = Buffer.alloc(44);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(96000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  return bytes;
}

test("Irodori imports, renames, selects, and removes app-owned voices", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "purupet-irodori-voices-"));
  try {
    const library = new IrodoriVoiceLibrary(root);
    const first = library.importWave(emptyWave(), "Sample / Voice");
    assert.equal(first.record.name, "Sample Voice");
    assert.equal(fs.existsSync(library.voicePath(first.record)), true);
    const second = library.importWave(emptyWave(), "Voice 2", first.voices);
    assert.equal(library.publicVoices(second.voices, second.record.id).length, 2);
    assert.equal(library.selectedVoice(second.voices, second.record.id).id, second.record.id);
    const renamed = library.rename(second.voices, first.record.id, "琥珀の声");
    assert.equal(renamed[0].name, "琥珀の声");
    const remaining = library.remove(renamed, first.record.id);
    assert.equal(remaining.length, 1);
    assert.equal(fs.existsSync(library.voicePath(first.record)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
