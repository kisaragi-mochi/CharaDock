// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { IrodoriVoiceLibrary } = require("../lib/irodori-voices.cjs");

function emptyWave(sampleRate = 48000) {
  const bytes = Buffer.alloc(44);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  return bytes;
}

test("Irodori imports, renames, selects, and removes app-owned voices", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-irodori-voices-"));
  try {
    const library = new IrodoriVoiceLibrary(root);
    const first = library.importWave(emptyWave(), "Sample / Voice");
    assert.equal(first.record.name, "Sample Voice");
    assert.equal(fs.existsSync(library.voicePath(first.record)), true);
    const second = library.importWave(emptyWave(), "Voice 2", first.voices);
    assert.equal(library.publicVoices(second.voices, second.record.id).length, 2);
    assert.equal(library.selectedVoice(second.voices, second.record.id).id, second.record.id);
    const renamed = library.rename(second.voices, first.record.id, "コハクの声");
    assert.equal(renamed[0].name, "コハクの声");
    const remaining = library.remove(renamed, first.record.id);
    assert.equal(remaining.length, 1);
    assert.equal(fs.existsSync(library.voicePath(first.record)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Irodori installs protected bundled voices into app-owned storage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-irodori-bundled-"));
  const source = path.join(root, "source");
  const storage = path.join(root, "storage");
  try {
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "hiro.wav"), emptyWave(48000));
    fs.writeFileSync(path.join(source, "kohaku.wav"), emptyWave(44100));
    const library = new IrodoriVoiceLibrary(storage);
    const custom = library.importWave(emptyWave(32000), "Custom");
    const legacyKohaku = library.importWave(emptyWave(44100), "rusuden_02", custom.voices);
    const installed = library.installBundledVoices(legacyKohaku.voices, source);
    assert.deepEqual(installed.voices.map((voice) => voice.id), ["builtin-hiro", "builtin-kohaku", custom.record.id]);
    assert.equal(installed.replacements[legacyKohaku.record.id], "builtin-kohaku");
    assert.equal(library.publicVoices(installed.voices)[0].builtIn, true);
    assert.equal(library.isReady(installed.voices[0]), true);
    assert.equal(fs.readFileSync(path.join(storage, "builtin-kohaku.wav")).equals(emptyWave(44100)), true);
    assert.throws(() => library.rename(installed.voices, "builtin-hiro", "Changed"), /変更できません/);
    assert.throws(() => library.remove(installed.voices, "builtin-kohaku"), /削除できません/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
