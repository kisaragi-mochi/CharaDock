// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  piperPlusArguments,
  piperPlusStatus,
  piperPlusWorkingDirectory,
  synthesizePiperPlus,
  validatePiperPlusModel,
} = require("../lib/piper-plus.cjs");

function piperFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "charadock-piper-test-"));
  const bin = path.join(root, "bin");
  const models = path.join(root, "models");
  const temporaryRoot = path.join(root, "temporary");
  fs.mkdirSync(bin);
  fs.mkdirSync(models);
  fs.mkdirSync(temporaryRoot);
  const executablePath = path.join(bin, "piper-plus.exe");
  const modelPath = path.join(models, "voice.onnx");
  fs.writeFileSync(executablePath, "fixture");
  fs.writeFileSync(modelPath, "fixture");
  fs.writeFileSync(`${modelPath}.json`, "{}");
  return { root, executablePath, modelPath, temporaryRoot };
}

test("piper-plus uses its extracted package root and inverse length scale", () => {
  const fixture = piperFixture();
  try {
    assert.equal(piperPlusWorkingDirectory(fixture.executablePath), fixture.root);
    assert.deepEqual(
      piperPlusArguments({ modelPath: fixture.modelPath, text: "こんにちは", outputPath: "voice.wav", speed: 1.25 }),
      ["--model", fixture.modelPath, "--text", "こんにちは", "--output_file", "voice.wav", "--length-scale", "0.8", "--sentence_silence", "0.35", "--quiet"],
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("piper-plus status requires the runtime, ONNX model, and companion config", () => {
  const fixture = piperFixture();
  try {
    assert.equal(piperPlusStatus(fixture).ready, true);
    fs.rmSync(`${fixture.modelPath}.json`);
    assert.equal(piperPlusStatus(fixture).ready, false);
    assert.throws(() => validatePiperPlusModel(fixture.modelPath), /設定ファイル/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("piper-plus synthesis returns WAV data and deletes temporary output", async () => {
  const fixture = piperFixture();
  try {
    const calls = [];
    const execFileImpl = (command, args, options, callback) => {
      calls.push({ command, args, options });
      const outputPath = args[args.indexOf("--output_file") + 1];
      fs.writeFileSync(outputPath, Buffer.from("RIFF0000WAVE", "ascii"));
      callback(null, "", "");
    };
    const result = await synthesizePiperPlus({
      text: "音声テストです。",
      executablePath: fixture.executablePath,
      modelPath: fixture.modelPath,
      temporaryRoot: fixture.temporaryRoot,
      execFileImpl,
    });
    assert.deepEqual(result.audioDataUrls, ["data:audio/wav;base64,UklGRjAwMDBXQVZF"]);
    assert.equal(calls[0].command, fixture.executablePath);
    assert.equal(calls[0].options.windowsHide, true);
    assert.deepEqual(fs.readdirSync(fixture.temporaryRoot), []);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
