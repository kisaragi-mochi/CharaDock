// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");

const { EmbeddedSupertonicTts } = require("./supertonic-tts.cjs");

async function run() {
  const requestPath = String(process.env.CHARADOCK_SUPERTONIC_REQUEST || "");
  const resultPath = String(process.env.CHARADOCK_SUPERTONIC_RESULT || "");
  if (!requestPath || !resultPath) throw new Error("Supertonicワーカーの入出力先がありません。");
  const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
  // Electron's main-process V8 isolate rejects the external ArrayBuffers
  // returned by the native async bindings. Keep every native buffer in this
  // disposable Node-mode process and only return base64 strings.
  const engine = new EmbeddedSupertonicTts({ forceSynchronous: true });
  const result = await engine.synthesize(request);
  fs.writeFileSync(resultPath, JSON.stringify({ ok: true, result }), { mode: 0o600 });
}

run().catch((error) => {
  const resultPath = String(process.env.CHARADOCK_SUPERTONIC_RESULT || "");
  if (resultPath) {
    try { fs.writeFileSync(resultPath, JSON.stringify({ ok: false, error: String(error?.message || error) }), { mode: 0o600 }); } catch {}
  }
  process.exitCode = 1;
});
