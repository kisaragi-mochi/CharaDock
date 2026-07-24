// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const IRODORI_COMMIT = "b75a9bbf2c10e12682d37e91e0efaf6d4e54bd29";
const PIPER_MODEL_COMMIT = "36b59c825c36bd386b8960cf3f604382f52f2a87";
const KOKORO_COMMIT = "1939ad2a8e416c0acfeecc08a694d14ef25f2231";

const TTS_MODELS = Object.freeze({
  "piper-plus": Object.freeze({
    id: "piper-plus",
    label: "piper-plus · つくよみちゃん FP16",
    description: "日本語向けの軽量サンプル音声。公式Windowsランタイムも一緒に導入します。",
    directoryName: "piper-plus-tsukuyomi-v1.13.0",
    downloadBytes: 72_120_860,
    platforms: Object.freeze(["win32"]),
    sourceUrl: "https://github.com/ayutaz/piper-plus",
    licenseUrl: "https://tyc.rei-yumesaki.net/material/corpus/#terms3",
    runtime: Object.freeze({
      archiveName: "piper-windows-x64.zip",
      url: "https://github.com/ayutaz/piper-plus/releases/download/v1.13.0/piper-windows-x64.zip",
      bytes: 32_461_242,
      sha256: "d8b6237a546d996a65009bd88f2eb845fad876505952cce98eb3fedaf99fa3d7",
    }),
    files: Object.freeze([
      Object.freeze({
        name: "tsukuyomi-chan-6lang-fp16.onnx",
        relativePath: "models/tsukuyomi-chan-6lang-fp16.onnx",
        url: `https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/${PIPER_MODEL_COMMIT}/tsukuyomi-chan-6lang-fp16.onnx`,
        bytes: 39_652_717,
        sha256: "5289e9b6eaf21080803b7fe1c4dc85b5491d4c216121207a41df18dd5f68e5d7",
      }),
      Object.freeze({
        name: "config.json",
        relativePath: "models/tsukuyomi-chan-6lang-fp16.onnx.json",
        url: `https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/${PIPER_MODEL_COMMIT}/config.json`,
        bytes: 6_901,
        sha256: "516058f405ec914140f34832a9d8bb5d8272ba62af9bc7ffb29349715a539780",
      }),
    ]),
  }),
  "supertonic-3": Object.freeze({
    id: "supertonic-3",
    label: "Supertonic 3 · int8",
    description: "10種類の声を選べる公式sherpa-onnx向け軽量モデル。CPUで処理します。",
    directoryName: "sherpa-onnx-supertonic-3-tts-int8-2026-05-11",
    downloadBytes: 128_774_318,
    sourceUrl: "https://github.com/k2-fsa/sherpa-onnx",
    licenseUrl: "https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models",
    archive: Object.freeze({
      archiveName: "sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2",
      url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2",
      bytes: 128_774_318,
      sha256: "82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427",
    }),
  }),
  "irodori-webgpu": Object.freeze({
    id: "irodori-webgpu",
    label: "Irodori TTS · FP16 WebGPU",
    description: "日本語ゼロショット音声合成モデル。GPUで処理し、利用には参照WAV音声が必要です。",
    directoryName: "irodori-tts-onnx-fp16",
    downloadBytes: 1_261_860_326,
    sourceUrl: "https://github.com/ngc-shj/irodori-tts-webgpu",
    licenseUrl: "https://huggingface.co/noguchis/irodori-tts-onnx/blob/main/LICENSE",
    files: Object.freeze([
      ["onnx_fp16/dacvae_decoder.onnx", 892_789, "b3ab98722feafbfec13847da4d234109c2b9b8347d3673158fbd2a7bdda66157"],
      ["onnx_fp16/dacvae_decoder.onnx.data", 166_184_768, "eb3ecfc543eb957e06e9165796014d5c17951bd933d30d76fd00a6eda3b21930"],
      ["onnx_fp16/dacvae_encoder.onnx", 962_319, "cbe594dd6a65c419ff1fa874b0504574293cbeab1b90822d1a0206559cc8b7e1"],
      ["onnx_fp16/dacvae_encoder.onnx.data", 54_697_984, "a963ab4f4be69451b04243e0b8ef9b53e3be5d615e09595e5eb83be5b9094489"],
      ["onnx_fp16/dit.onnx", 3_090_595, "5371d8acda0ac8572c759d67c2e2999c26e6394d4e70521628215f3cd0aa804e"],
      ["onnx_fp16/dit.onnx.data", 700_841_984, "d7d33eb22e9c3eed2b73be7173eabda651c4d15cf33a976e12050f06fc7f61f4"],
      ["onnx_fp16/duration.onnx", 237_373, "f946d1ad1aa430a5544566aaad26a9694ddb278662e663d951b2dd051543740f"],
      ["onnx_fp16/duration.onnx.data", 34_144_256, "edbbbf614879e777ca32735d8d8dae757b5ce6ce7d468999e1cf597510bc1097"],
      ["onnx_fp16/speaker_encoder.onnx", 1_635_127, "cd04bee8baf8e3025201f21874646fad3dba47cd5362d10251fbb1571837ad66"],
      ["onnx_fp16/speaker_encoder.onnx.data", 121_292_800, "ce0f22b345e475d8dc259c447412da0afcbca691d5dc559e2534374fa72f67c5"],
      ["onnx_fp16/text_encoder.onnx", 1_871_518, "b48771a1a41b73fd4eda6be285312cf4126940d52f9181dddb8a6a08d0412db5"],
      ["onnx_fp16/text_encoder.onnx.data", 169_596_928, "53958b363fecc91d0357d2a3208abce7411860b93f9207f6cdccc4398411502f"],
      ["tokenizer/llmjp_tok/tokenizer.json", 6_409_995, "d0fcf4e1e7a08e855273824678363335b0cd707937332ec1cc48eee259065219"],
      ["tokenizer/llmjp_tok/tokenizer_config.json", 1_890, "dab1702ffb28ea713a5302c9b9bf3bdeb5907be931e8f72384de535f1fb26272"],
    ].map(([relativePath, bytes, sha256]) => Object.freeze({
      name: path.basename(relativePath),
      relativePath,
      url: `https://huggingface.co/noguchis/irodori-tts-onnx/resolve/${IRODORI_COMMIT}/${relativePath}`,
      bytes,
      sha256,
    }))),
  }),
  kokoro: Object.freeze({
    id: "kokoro",
    label: "Kokoro 82M · 日本語 WebGPU / CPU",
    description: "WebGPU推奨FP32とCPU用q8、日本語5音声を含むKokoro ONNXモデルです。",
    directoryName: "kokoro-82m-v1.0-onnx-ja-fp32-q8",
    downloadBytes: 420_504_548,
    sourceUrl: "https://github.com/hexgrad/kokoro",
    licenseUrl: "https://huggingface.co/hexgrad/Kokoro-82M/blob/main/LICENSE",
    files: Object.freeze([
      ["onnx/model.onnx", 325_532_232, "8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb"],
      ["onnx/model_quantized.onnx", 92_361_116, "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478"],
      ["voices/jf_alpha.bin", 522_240, "56b479360aad9f367aeb8cef908f9201cf48b4555e488c5f4590c9dfcd978bb6"],
      ["voices/jf_gongitsune.bin", 522_240, "0f1181f3772d27b7c12aaf4bcd71e31b186c4146e330d074a3dc64ee392af396"],
      ["voices/jf_nezumi.bin", 522_240, "13cb71eebb0b48739d444558322aa35a8c9a489b80e1e631f14d2e6aea93026b"],
      ["voices/jf_tebukuro.bin", 522_240, "29c6c0561b4288d59639677bebe7533c919743d5ea68d0d2ae992644beea6696"],
      ["voices/jm_kumo.bin", 522_240, "09e959d239724c734d65661f06f14cdabcddfd476bfaaad905a937099ae9e64f"],
    ].map(([relativePath, bytes, sha256]) => Object.freeze({
      name: path.basename(relativePath),
      relativePath,
      url: `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${KOKORO_COMMIT}/${relativePath}`,
      bytes,
      sha256,
    }))),
  }),
});

function modelForId(provider) {
  return TTS_MODELS[String(provider || "")] || null;
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`モデルの展開に失敗しました (${code}): ${stderr.trim()}`));
    });
  });
}

function isFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function requiredPaths(model, directory) {
  if (model.id === "piper-plus") return [
    path.join(directory, "piper", "bin", "piper.exe"),
    path.join(directory, "models", "tsukuyomi-chan-6lang-fp16.onnx"),
    path.join(directory, "models", "tsukuyomi-chan-6lang-fp16.onnx.json"),
  ];
  if (model.id === "supertonic-3") return [
    "duration_predictor.int8.onnx", "text_encoder.int8.onnx", "vector_estimator.int8.onnx",
    "vocoder.int8.onnx", "tts.json", "unicode_indexer.bin", "voice.bin",
  ].map((name) => path.join(directory, name));
  return model.files.map((file) => path.join(directory, file.relativePath));
}

function assertEnoughDiskSpace(directory, requiredBytes) {
  if (typeof fs.statfsSync !== "function") return;
  const stats = fs.statfsSync(directory);
  const available = Number(stats.bavail) * Number(stats.bsize);
  const required = Math.ceil(requiredBytes * 1.15) + 64 * 1024 * 1024;
  if (Number.isFinite(available) && available < required) {
    const requiredGb = (required / 1024 / 1024 / 1024).toFixed(1);
    throw new Error(`モデルの保存容量が不足しています（空き容量を約${requiredGb}GB以上確保してください）。`);
  }
}

async function downloadVerifiedFile({ fetchImpl, file, destination, onChunk }) {
  const response = await fetchImpl(file.url, { redirect: "follow" });
  if (!response?.ok || !response.body) throw new Error(`モデルをダウンロードできませんでした (HTTP ${response?.status || "unknown"})`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.download`;
  const output = fs.openSync(temporaryPath, "w", 0o600);
  const hash = crypto.createHash("sha256");
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      fs.writeSync(output, chunk);
      hash.update(chunk);
      received += chunk.length;
      onChunk?.(chunk.length);
    }
  } finally {
    fs.closeSync(output);
  }
  if (received !== file.bytes) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(`${file.name}のダウンロードサイズが一致しません。`);
  }
  if (hash.digest("hex") !== file.sha256) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(`${file.name}のSHA-256が一致しません。`);
  }
  fs.renameSync(temporaryPath, destination);
}

class EmbeddedTtsModels {
  constructor(baseDirectory, { fetchImpl = globalThis.fetch, platform = process.platform } = {}) {
    this.baseDirectory = path.resolve(baseDirectory);
    this.fetchImpl = fetchImpl;
    this.platform = platform;
    this.downloadPromise = null;
    this.downloadingProvider = null;
    this.progress = null;
    this.cleanupStaleDownloads();
  }

  cleanupStaleDownloads() {
    try {
      for (const entry of fs.readdirSync(this.baseDirectory, { withFileTypes: true })) {
        if (entry.isDirectory() && /^\.download-(piper-plus|supertonic-3|irodori-webgpu|kokoro)-\d+$/.test(entry.name)) {
          fs.rmSync(path.join(this.baseDirectory, entry.name), { recursive: true, force: true });
        }
      }
    } catch {}
  }

  directoryFor(model) {
    return path.join(this.baseDirectory, model.directoryName);
  }

  isSupported(model) {
    return !model.platforms || model.platforms.includes(this.platform);
  }

  isInstalled(provider) {
    const model = modelForId(provider);
    return Boolean(model) && requiredPaths(model, this.directoryFor(model)).every(isFile);
  }

  installedPaths(provider) {
    const model = modelForId(provider);
    if (!model || !this.isInstalled(provider)) return {};
    const directory = this.directoryFor(model);
    if (provider === "piper-plus") return {
      executablePath: path.join(directory, "piper", "bin", "piper.exe"),
      modelPath: path.join(directory, "models", "tsukuyomi-chan-6lang-fp16.onnx"),
    };
    return { modelDirectory: directory };
  }

  status(provider) {
    const model = modelForId(provider);
    if (!model) throw new Error("対応していない音声合成モデルです。");
    return {
      provider: model.id,
      label: model.label,
      description: model.description,
      downloadBytes: model.downloadBytes,
      supported: this.isSupported(model),
      installed: this.isInstalled(model.id),
      downloading: this.downloadingProvider === model.id,
      progress: this.downloadingProvider === model.id ? this.progress : null,
      sourceUrl: model.sourceUrl,
      licenseUrl: model.licenseUrl,
      ...this.installedPaths(model.id),
    };
  }

  emitProgress(onProgress, model, phase, receivedBytes, currentFile = "") {
    this.progress = { phase, receivedBytes, totalBytes: model.downloadBytes, currentFile };
    onProgress?.(this.status(model.id));
  }

  async download(provider, onProgress) {
    const model = modelForId(provider);
    if (!model) throw new Error("対応していない音声合成モデルです。");
    if (!this.isSupported(model)) throw new Error(`${model.label}のサンプルはWindows版アプリでダウンロードできます。`);
    if (this.isInstalled(model.id)) return this.status(model.id);
    if (this.downloadPromise) {
      if (this.downloadingProvider !== model.id) throw new Error("別の音声合成モデルをダウンロード中です。");
      return this.downloadPromise;
    }
    this.downloadingProvider = model.id;
    this.downloadPromise = this.downloadModel(model, onProgress).finally(() => {
      this.downloadPromise = null;
      this.downloadingProvider = null;
      this.progress = null;
    });
    return this.downloadPromise;
  }

  async downloadModel(model, onProgress) {
    fs.mkdirSync(this.baseDirectory, { recursive: true });
    assertEnoughDiskSpace(this.baseDirectory, model.downloadBytes);
    const temporaryDirectory = path.join(this.baseDirectory, `.download-${model.id}-${Date.now()}`);
    let receivedBytes = 0;
    const downloadFile = async (file, destination) => {
      this.emitProgress(onProgress, model, "downloading", receivedBytes, file.name);
      await downloadVerifiedFile({
        fetchImpl: this.fetchImpl,
        file,
        destination,
        onChunk: (bytes) => {
          receivedBytes += bytes;
          this.emitProgress(onProgress, model, "downloading", receivedBytes, file.name);
        },
      });
    };
    try {
      fs.mkdirSync(temporaryDirectory, { recursive: true });
      if (model.id === "piper-plus") {
        const archivePath = path.join(temporaryDirectory, model.runtime.archiveName);
        await downloadFile({ ...model.runtime, name: model.runtime.archiveName }, archivePath);
        const extracted = path.join(temporaryDirectory, "runtime");
        fs.mkdirSync(extracted, { recursive: true });
        this.emitProgress(onProgress, model, "extracting", receivedBytes, model.runtime.archiveName);
        await runProcess(this.platform === "win32" ? "tar.exe" : "unzip", this.platform === "win32"
          ? ["-xf", archivePath, "-C", extracted]
          : ["-q", archivePath, "-d", extracted]);
        fs.rmSync(archivePath, { force: true });
        for (const file of model.files) await downloadFile(file, path.join(temporaryDirectory, "ready", file.relativePath));
        fs.renameSync(path.join(extracted, "piper"), path.join(temporaryDirectory, "ready", "piper"));
      } else if (model.archive) {
        const archivePath = path.join(temporaryDirectory, model.archive.archiveName);
        await downloadFile({ ...model.archive, name: model.archive.archiveName }, archivePath);
        const extracted = path.join(temporaryDirectory, "extracted");
        fs.mkdirSync(extracted, { recursive: true });
        this.emitProgress(onProgress, model, "extracting", receivedBytes, model.archive.archiveName);
        await runProcess(this.platform === "win32" ? "tar.exe" : "tar", ["-xjf", archivePath, "-C", extracted]);
        fs.rmSync(archivePath, { force: true });
        fs.renameSync(path.join(extracted, model.directoryName), path.join(temporaryDirectory, "ready"));
      } else {
        for (const file of model.files) await downloadFile(file, path.join(temporaryDirectory, "ready", file.relativePath));
      }
      const ready = path.join(temporaryDirectory, "ready");
      if (!requiredPaths(model, ready).every(isFile)) throw new Error("ダウンロードした音声合成モデルに必要なファイルがありません。");
      const destination = this.directoryFor(model);
      if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
      fs.renameSync(ready, destination);
      this.emitProgress(onProgress, model, "done", model.downloadBytes);
      return this.status(model.id);
    } finally {
      try { fs.rmSync(temporaryDirectory, { recursive: true, force: true }); } catch {}
    }
  }

  remove(provider) {
    const model = modelForId(provider);
    if (!model) throw new Error("対応していない音声合成モデルです。");
    if (this.downloadingProvider === model.id) throw new Error("モデルのダウンロード中は削除できません。");
    fs.rmSync(this.directoryFor(model), { recursive: true, force: true });
    return this.status(model.id);
  }
}

module.exports = {
  EmbeddedTtsModels,
  TTS_MODELS,
  assertEnoughDiskSpace,
  downloadVerifiedFile,
  modelForId,
  requiredPaths,
};
