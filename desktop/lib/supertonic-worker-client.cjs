// SPDX-License-Identifier: Apache-2.0
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function runWorker(command, args, options, execFileImpl) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, options, (error, stdout, stderr) => {
      if (!error) return resolve();
      const detail = String(stderr || stdout || error.message || "").trim().slice(0, 500);
      reject(new Error(`Supertonic 3ワーカーが音声を生成できませんでした${detail ? `: ${detail}` : "。"}`));
    });
  });
}

async function synthesizeSupertonicInWorker(request, {
  executablePath = process.execPath,
  workerPath = path.join(__dirname, "supertonic-worker.cjs"),
  temporaryRoot = os.tmpdir(),
  execFileImpl = execFile,
} = {}) {
  const temporaryDirectory = fs.mkdtempSync(path.join(temporaryRoot, "purupet-supertonic-"));
  const requestPath = path.join(temporaryDirectory, "request.json");
  const resultPath = path.join(temporaryDirectory, "result.json");
  try {
    fs.writeFileSync(requestPath, JSON.stringify(request), { mode: 0o600 });
    let processError = null;
    try {
      await runWorker(
        executablePath,
        ["-e", `require(${JSON.stringify(workerPath)})`],
        {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            PURUPET_SUPERTONIC_REQUEST: requestPath,
            PURUPET_SUPERTONIC_RESULT: resultPath,
          },
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
        },
        execFileImpl,
      );
    } catch (error) {
      processError = error;
    }
    if (!fs.existsSync(resultPath)) throw processError || new Error("Supertonic 3ワーカーから応答がありません。");
    const payload = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    if (!payload.ok) throw new Error(String(payload.error || "Supertonic 3ワーカーでエラーが発生しました。"));
    if (!Array.isArray(payload.result?.audioDataUrls)) throw new Error("Supertonic 3ワーカーから正しい音声を受け取れませんでした。");
    return payload.result;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

module.exports = { synthesizeSupertonicInWorker };
