// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { synthesizeSupertonicInWorker } = require("../lib/supertonic-worker-client.cjs");

test("Supertonic worker returns only serialized audio and cleans temporary files", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "purupet-supertonic-client-"));
  let captured;
  try {
    const result = await synthesizeSupertonicInWorker({ text: "音声テスト" }, {
      temporaryRoot: root,
      executablePath: "electron.exe",
      workerPath: "worker.cjs",
      execFileImpl: (command, args, options, callback) => {
        captured = { command, args, options };
        fs.writeFileSync(options.env.PURUPET_SUPERTONIC_RESULT, JSON.stringify({
          ok: true,
          result: { audioDataUrls: ["data:audio/wav;base64,UklGRg=="] },
        }));
        callback(null, "", "");
      },
    });
    assert.deepEqual(result.audioDataUrls, ["data:audio/wav;base64,UklGRg=="]);
    assert.equal(captured.command, "electron.exe");
    assert.equal(captured.options.env.ELECTRON_RUN_AS_NODE, "1");
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
