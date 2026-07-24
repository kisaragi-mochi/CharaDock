// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { EmbeddedSupertonicTts, REQUIRED_FILES, supertonicStatus, wavDataUrl } = require("../lib/supertonic-tts.cjs");

function modelDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "purupet-supertonic-"));
  for (const name of REQUIRED_FILES) fs.writeFileSync(path.join(directory, name), name);
  return directory;
}

test("Supertonic status requires every sherpa-onnx model artifact", () => {
  const directory = modelDirectory();
  assert.equal(supertonicStatus(directory).ready, true);
  fs.rmSync(path.join(directory, REQUIRED_FILES[0]));
  assert.equal(supertonicStatus(directory).ready, false);
  assert.deepEqual(supertonicStatus(directory).missingFiles, [REQUIRED_FILES[0]]);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("Supertonic uses Japanese GenerationConfig and returns WAV audio", async () => {
  const directory = modelDirectory();
  const requests = [];
  let capturedConfig;
  class OfflineTts {
    static async createAsync(config) {
      capturedConfig = config;
      return new OfflineTts();
    }
    async generateAsync(request) {
      requests.push(request);
      return { samples: new Float32Array([0, .25, -.25]), sampleRate: 44100 };
    }
  }
  class GenerationConfig { constructor(config) { Object.assign(this, config); } }
  const engine = new EmbeddedSupertonicTts({ sherpaOnnx: { OfflineTts, GenerationConfig } });
  const result = await engine.synthesize({ text: "こんにちは。", modelDirectory: directory, voice: "M2", speed: 1.2, numSteps: 10 });
  assert.equal(capturedConfig.model.provider, "cpu");
  assert.equal(capturedConfig.model.supertonic.voiceStyle, path.join(directory, "voice.bin"));
  assert.equal(requests[0].generationConfig.sid, 6);
  assert.equal(requests[0].generationConfig.extra.lang, "ja");
  assert.equal(requests[0].enableExternalBuffer, false);
  assert.match(result.audioDataUrls[0], /^data:audio\/wav;base64,/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("Supertonic WAV encoder writes a valid RIFF/WAVE header", () => {
  const bytes = Buffer.from(wavDataUrl(new Float32Array([0, 1, -1]), 24000).split(",")[1], "base64");
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString(), "WAVE");
  assert.equal(bytes.readUInt32LE(24), 24000);
});
