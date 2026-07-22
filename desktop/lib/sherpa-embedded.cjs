// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const SHERPA_MODELS = Object.freeze({
  "nemo-parakeet-ja-int8": Object.freeze({
    id: "nemo-parakeet-ja-int8",
    label: "Parakeet CTC 日本語 int8",
    description: "ReazonSpeech 3.5万時間で学習した高精度・高負荷モデル",
    archiveName: "sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8.tar.bz2",
    directoryName: "sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8",
    downloadUrl: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8.tar.bz2",
    archiveBytes: 489_389_564,
    sha256: "4b0a800ef29f4f4c8667339bf6f60d5bfdc2852ddc9dc5741aea65b6f8d1306b",
    kind: "nemoCtc",
    files: Object.freeze({ model: "model.int8.onnx", tokens: "tokens.txt" }),
  }),
  "reazonspeech-ja-int8": Object.freeze({
    id: "reazonspeech-ja-int8",
    label: "ReazonSpeech 日本語特化 int8",
    description: "日本語3.5万時間で学習した精度優先モデル",
    recommended: true,
    archiveName: "sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2",
    directoryName: "sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01",
    downloadUrl: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2",
    archiveBytes: 713_097_333,
    sha256: "e0981d0d5d7b446d41010831b59091ebf57d2aa7b79980f67ca37af460b5842d",
    kind: "transducer",
    files: Object.freeze({
      encoder: "encoder-epoch-99-avg-1.int8.onnx",
      decoder: "decoder-epoch-99-avg-1.onnx",
      joiner: "joiner-epoch-99-avg-1.int8.onnx",
      tokens: "tokens.txt",
    }),
  }),
  "sensevoice-ja-int8": Object.freeze({
    id: "sensevoice-ja-int8",
    label: "SenseVoice 日本語 int8",
    description: "句読点と数字整形に対応したバランスモデル",
    archiveName: "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2",
    directoryName: "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17",
    downloadUrl: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2",
    archiveBytes: 163_002_883,
    sha256: "7d1efa2138a65b0b488df37f8b89e3d91a60676e416f515b952358d83dfd347e",
    kind: "senseVoice",
    files: Object.freeze({ model: "model.int8.onnx", tokens: "tokens.txt" }),
  }),
  "whisper-base-multilingual-int8": Object.freeze({
    id: "whisper-base-multilingual-int8",
    label: "Whisper base 多言語 int8",
    description: "tinyより高精度な多言語Whisper",
    archiveName: "sherpa-onnx-whisper-base.tar.bz2",
    directoryName: "sherpa-onnx-whisper-base",
    downloadUrl: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.tar.bz2",
    archiveBytes: 207_557_382,
    sha256: "911b2083efd7c0dca2ac3b358b75222660dc09fb716d64fbfc417ba6c99ff3de",
    kind: "whisper",
    files: Object.freeze({ encoder: "base-encoder.int8.onnx", decoder: "base-decoder.int8.onnx", tokens: "base-tokens.txt" }),
  }),
  "whisper-tiny-multilingual-int8": Object.freeze({
    id: "whisper-tiny-multilingual-int8",
    label: "Whisper tiny 多言語 int8",
    description: "軽量・従来モデル",
    archiveName: "sherpa-onnx-whisper-tiny.tar.bz2",
    directoryName: "sherpa-onnx-whisper-tiny",
    downloadUrl: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2",
    archiveBytes: 116_204_861,
    sha256: "c46116994e539aa165266d96b325252728429c12535eb9d8b6a2b10f129e66b1",
    kind: "whisper",
    files: Object.freeze({ encoder: "tiny-encoder.int8.onnx", decoder: "tiny-decoder.int8.onnx", tokens: "tiny-tokens.txt" }),
  }),
});

const DEFAULT_SHERPA_MODEL_ID = "reazonspeech-ja-int8";
const SHERPA_MODEL = SHERPA_MODELS[DEFAULT_SHERPA_MODEL_ID];
const REQUIRED_MODEL_FILES = Object.freeze(Object.values(SHERPA_MODELS["whisper-tiny-multilingual-int8"].files));

function modelForId(modelId) {
  return SHERPA_MODELS[String(modelId || "")] || null;
}

function requiredFiles(model) {
  return [...new Set(Object.values(model.files))];
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

class EmbeddedSherpaOnnx {
  constructor(baseDirectory, { fetchImpl = globalThis.fetch, modelId = DEFAULT_SHERPA_MODEL_ID } = {}) {
    this.baseDirectory = path.resolve(baseDirectory);
    this.modelId = modelForId(modelId)?.id || DEFAULT_SHERPA_MODEL_ID;
    this.fetchImpl = fetchImpl;
    this.downloadPromise = null;
    this.downloadModelId = null;
    this.recognizerPromise = null;
    this.recognizerModelId = null;
    this.progress = null;
  }

  get model() {
    return SHERPA_MODELS[this.modelId];
  }

  get modelDirectory() {
    return this.directoryFor(this.model);
  }

  hasModel(modelId) {
    return Boolean(modelForId(modelId));
  }

  directoryFor(model) {
    return path.join(this.baseDirectory, model.directoryName);
  }

  isModelInstalled(modelId) {
    const model = modelForId(modelId);
    if (!model) return false;
    const directory = this.directoryFor(model);
    return requiredFiles(model).every((file) => fs.existsSync(path.join(directory, file)));
  }

  isInstalled() {
    return this.isModelInstalled(this.modelId);
  }

  selectModel(modelId) {
    const model = modelForId(modelId);
    if (!model) throw new Error("対応していないsherpa-onnxモデルです。");
    if (model.id !== this.modelId) {
      this.modelId = model.id;
      this.recognizerPromise = null;
      this.recognizerModelId = null;
    }
    return this.status();
  }

  status() {
    const selected = this.model;
    return {
      modelId: selected.id,
      label: selected.label,
      description: selected.description,
      downloadBytes: selected.archiveBytes,
      installed: this.isInstalled(),
      downloading: Boolean(this.downloadPromise),
      downloadingModelId: this.downloadModelId,
      progress: this.progress,
      models: Object.values(SHERPA_MODELS).map((model) => ({
        modelId: model.id,
        label: model.label,
        description: model.description,
        recommended: Boolean(model.recommended),
        downloadBytes: model.archiveBytes,
        installed: this.isModelInstalled(model.id),
        downloading: this.downloadModelId === model.id,
      })),
    };
  }

  emitProgress(onProgress, model, phase, receivedBytes = 0, totalBytes = model.archiveBytes) {
    this.progress = { modelId: model.id, phase, receivedBytes, totalBytes };
    onProgress?.(this.status());
  }

  async download(onProgress, modelId = this.modelId) {
    const model = modelForId(modelId);
    if (!model) throw new Error("対応していないsherpa-onnxモデルです。");
    if (this.isModelInstalled(model.id)) return this.status();
    if (this.downloadPromise) {
      if (this.downloadModelId !== model.id) throw new Error("別の音声モデルをダウンロード中です。");
      return this.downloadPromise;
    }
    this.downloadModelId = model.id;
    this.downloadPromise = this.downloadModel(model, onProgress).finally(() => {
      this.downloadPromise = null;
      this.downloadModelId = null;
      this.progress = null;
    });
    return this.downloadPromise;
  }

  async downloadModel(model, onProgress) {
    fs.mkdirSync(this.baseDirectory, { recursive: true });
    const archivePath = path.join(this.baseDirectory, `${model.archiveName}.download`);
    const extractDirectory = path.join(this.baseDirectory, `.extract-${model.id}-${Date.now()}`);
    try {
      this.emitProgress(onProgress, model, "downloading");
      const response = await this.fetchImpl(model.downloadUrl, { redirect: "follow" });
      if (!response?.ok || !response.body) throw new Error(`モデルをダウンロードできませんでした (HTTP ${response?.status || "unknown"})`);
      const totalBytes = Number(response.headers?.get?.("content-length")) || model.archiveBytes;
      const reader = response.body.getReader();
      const output = fs.openSync(archivePath, "w", 0o600);
      const hash = crypto.createHash("sha256");
      let receivedBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          fs.writeSync(output, chunk);
          hash.update(chunk);
          receivedBytes += chunk.length;
          this.emitProgress(onProgress, model, "downloading", receivedBytes, totalBytes);
        }
      } finally {
        fs.closeSync(output);
      }
      if (hash.digest("hex") !== model.sha256) throw new Error("ダウンロードした音声モデルのSHA-256が一致しません。");
      this.emitProgress(onProgress, model, "extracting", receivedBytes, totalBytes);
      fs.mkdirSync(extractDirectory, { recursive: true });
      await runProcess(process.platform === "win32" ? "tar.exe" : "tar", ["-xjf", archivePath, "-C", extractDirectory]);
      const extractedModel = path.join(extractDirectory, model.directoryName);
      if (!requiredFiles(model).every((file) => fs.existsSync(path.join(extractedModel, file)))) {
        throw new Error("展開した音声モデルに必要なファイルがありません。");
      }
      const destination = this.directoryFor(model);
      if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
      fs.renameSync(extractedModel, destination);
      this.emitProgress(onProgress, model, "done", receivedBytes, totalBytes);
      return this.status();
    } finally {
      try { fs.rmSync(archivePath, { force: true }); } catch {}
      try { fs.rmSync(extractDirectory, { recursive: true, force: true }); } catch {}
    }
  }

  remove(modelId = this.modelId) {
    const model = modelForId(modelId);
    if (!model) throw new Error("対応していないsherpa-onnxモデルです。");
    if (this.downloadPromise && this.downloadModelId === model.id) throw new Error("モデルのダウンロード中は削除できません。");
    fs.rmSync(this.directoryFor(model), { recursive: true, force: true });
    if (this.recognizerModelId === model.id) {
      this.recognizerPromise = null;
      this.recognizerModelId = null;
    }
    return this.status();
  }

  runtimeInfo() {
    const runtime = require("sherpa-onnx-node");
    return { version: String(runtime.version || ""), gitSha1: String(runtime.gitSha1 || "") };
  }

  recognizerConfig(model) {
    const file = (name) => path.join(this.directoryFor(model), name);
    const modelConfig = {
      tokens: file(model.files.tokens),
      numThreads: Math.max(1, Math.min(4, Number(process.env.NUMBER_OF_PROCESSORS) || 2)),
      provider: "cpu",
      debug: 0,
    };
    if (model.kind === "whisper") {
      modelConfig.whisper = {
        encoder: file(model.files.encoder), decoder: file(model.files.decoder),
        language: "ja", task: "transcribe", tailPaddings: 300,
      };
    } else if (model.kind === "senseVoice") {
      modelConfig.senseVoice = {
        model: file(model.files.model), language: "ja", useInverseTextNormalization: 1,
      };
    } else if (model.kind === "nemoCtc") {
      modelConfig.nemoCtc = { model: file(model.files.model) };
    } else {
      modelConfig.transducer = {
        encoder: file(model.files.encoder), decoder: file(model.files.decoder), joiner: file(model.files.joiner),
      };
    }
    return { featConfig: { sampleRate: 16000, featureDim: 80 }, modelConfig };
  }

  async recognizer() {
    const model = this.model;
    if (!this.isModelInstalled(model.id)) throw new Error(`${model.label}が未ダウンロードです。設定画面からダウンロードしてください。`);
    if (!this.recognizerPromise || this.recognizerModelId !== model.id) {
      this.recognizerModelId = model.id;
      this.recognizerPromise = (async () => {
        let sherpaOnnx;
        try { sherpaOnnx = require("sherpa-onnx-node"); } catch (error) {
          throw new Error(`内蔵sherpa-onnxランタイムを読み込めません: ${error.message}`);
        }
        const config = this.recognizerConfig(model);
        const recognizer = typeof sherpaOnnx.OfflineRecognizer.createAsync === "function"
          ? await sherpaOnnx.OfflineRecognizer.createAsync(config)
          : new sherpaOnnx.OfflineRecognizer(config);
        return { sherpaOnnx, recognizer, modelId: model.id };
      })().catch((error) => {
        if (this.recognizerModelId === model.id) {
          this.recognizerPromise = null;
          this.recognizerModelId = null;
        }
        throw error;
      });
    }
    return this.recognizerPromise;
  }

  async transcribe({ samples, sampleRate } = {}) {
    const waveform = samples instanceof Float32Array ? samples : new Float32Array(samples || []);
    const rate = Math.round(Number(sampleRate));
    if (!waveform.length || waveform.byteLength > 60 * 1024 * 1024) throw new Error("録音音声が空か、長すぎます。");
    if (rate < 8_000 || rate > 192_000) throw new Error("録音音声のサンプルレートが正しくありません。");
    const { recognizer } = await this.recognizer();
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: rate, samples: waveform });
    const result = typeof recognizer.decodeAsync === "function"
      ? await recognizer.decodeAsync(stream)
      : (recognizer.decode(stream), recognizer.getResult(stream));
    const text = String(result?.text || "").trim();
    if (!text) throw new Error("音声を認識できませんでした。もう少し長く、はっきり話してください。");
    return text;
  }
}

module.exports = {
  DEFAULT_SHERPA_MODEL_ID, EmbeddedSherpaOnnx, REQUIRED_MODEL_FILES, SHERPA_MODEL, SHERPA_MODELS,
};
