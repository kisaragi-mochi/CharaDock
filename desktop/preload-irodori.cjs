// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { ipcRenderer } = require("electron");

const { resolveIrodoriModelDirectory } = require("./lib/irodori-webgpu.cjs");
const { wavDataUrl } = require("./lib/supertonic-tts.cjs");

const MODEL_NAMES = Object.freeze({
  text: "text_encoder",
  speaker: "speaker_encoder",
  duration: "duration",
  dit: "dit",
  dac: "dacvae_decoder",
  enc: "dacvae_encoder",
});
let cached = null;

function decodeWav(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("参照音声はPCMまたはFloat形式のWAVファイルを使用してください。");
  }
  let offset = 12, format = null, data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8, end = Math.min(buffer.length, start + size);
    if (id === "fmt " && end - start >= 16) {
      const rawType = buffer.readUInt16LE(start);
      format = {
        type: rawType === 0xfffe && end - start >= 40 ? buffer.readUInt16LE(start + 24) : rawType,
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4), bits: buffer.readUInt16LE(start + 14),
      };
    } else if (id === "data") data = buffer.subarray(start, end);
    offset = start + size + (size % 2);
  }
  if (!format || !data || ![1, 3].includes(format.type) || format.channels < 1 || format.channels > 8) {
    throw new Error("このWAV形式には対応していません。PCMまたは32-bit Floatを使用してください。");
  }
  const bytesPerSample = format.bits / 8;
  if (![2, 3, 4].includes(bytesPerSample) || (format.type === 3 && format.bits !== 32)) throw new Error("WAVのビット深度には対応していません。");
  const frameBytes = bytesPerSample * format.channels;
  const frames = Math.floor(data.length / frameBytes);
  if (frames < format.sampleRate * .4) throw new Error("参照音声が短すぎます。1秒以上の明瞭な音声を使用してください。");
  if (frames > format.sampleRate * 60) throw new Error("参照音声は60秒以内にしてください。");
  const mono = new Float32Array(frames);
  const sample = (at) => {
    if (format.type === 3) { const value = data.readFloatLE(at); return Number.isFinite(value) ? value : 0; }
    if (format.bits === 16) return data.readInt16LE(at) / 32768;
    if (format.bits === 24) return data.readIntLE(at, 3) / 8388608;
    return data.readInt32LE(at) / 2147483648;
  };
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let channel = 0; channel < format.channels; channel++) sum += sample(frame * frameBytes + channel * bytesPerSample);
    mono[frame] = sum / format.channels;
  }
  return { samples: mono, sampleRate: format.sampleRate };
}

function resample48k(input, sampleRate) {
  if (sampleRate === 48000) return input;
  const length = Math.max(1, Math.round(input.length * 48000 / sampleRate));
  const output = new Float32Array(length);
  const ratio = sampleRate / 48000;
  for (let i = 0; i < length; i++) {
    const position = i * ratio, left = Math.floor(position), right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

async function loadEngine(modelDirectory) {
  const resolved = resolveIrodoriModelDirectory(modelDirectory);
  if (cached?.root === resolved.root) return cached.engine;
  if (!navigator.gpu) throw new Error("このPCまたはElectronではWebGPUを利用できません。");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("WebGPU対応GPUアダプターを取得できません。");
  const [ort, tokenizers, pipeline] = await Promise.all([
    import("onnxruntime-web/webgpu"),
    import("@huggingface/tokenizers"),
    import(pathToFileURL(path.join(__dirname, "irodori", "pipeline.mjs")).href),
  ]);
  ort.env.wasm.numThreads = 1;
  let ortDist = path.dirname(require.resolve("onnxruntime-web/webgpu"));
  ortDist = ortDist.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  ort.env.wasm.wasmPaths = pathToFileURL(ortDist + path.sep).href;
  const sessions = {};
  for (const [key, name] of Object.entries(MODEL_NAMES)) {
    const [model, externalData] = await Promise.all([
      fs.readFile(path.join(resolved.models, `${name}.onnx`)),
      fs.readFile(path.join(resolved.models, `${name}.onnx.data`)),
    ]);
    sessions[key] = await ort.InferenceSession.create(new Uint8Array(model), {
      executionProviders: ["webgpu"],
      graphOptimizationLevel: "all",
      externalData: [{ path: `${name}.onnx.data`, data: new Uint8Array(externalData) }],
    });
  }
  const [tokenizerJson, tokenizerConfig] = await Promise.all([
    fs.readFile(path.join(resolved.tokenizer, "tokenizer.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(resolved.tokenizer, "tokenizer_config.json"), "utf8").then(JSON.parse),
  ]);
  const tokenizer = new tokenizers.Tokenizer(tokenizerJson, tokenizerConfig);
  const tokenizerAdapter = { encode: (text, options) => tokenizer.encode(text, options).ids };
  const engine = new pipeline.IrodoriTTS({ ort, sessions, tokenizer: tokenizerAdapter });
  cached = { root: resolved.root, engine };
  return engine;
}

ipcRenderer.on("irodori:synthesize", async (_event, request = {}) => {
  const requestId = String(request.requestId || "");
  try {
    const [engine, referenceBytes] = await Promise.all([
      loadEngine(request.modelDirectory),
      fs.readFile(request.referenceAudioPath),
    ]);
    const decoded = decodeWav(referenceBytes);
    const reference = resample48k(decoded.samples, decoded.sampleRate);
    const result = await engine.synthesize(String(request.text || ""), reference, 48000, {
      numSteps: Math.min(40, Math.max(4, Math.round(Number(request.numSteps) || 16))),
      seed: Math.max(0, Math.round(Number(request.seed) || 0)),
    });
    ipcRenderer.send("irodori:result", { requestId, audioDataUrl: wavDataUrl(result.audio, result.sampleRate) });
  } catch (error) {
    ipcRenderer.send("irodori:result", { requestId, error: String(error?.message || error) });
  }
});

ipcRenderer.on("irodori:convertReference", async (_event, request = {}) => {
  const requestId = String(request.requestId || "");
  try {
    const bytes = await fs.readFile(String(request.sourcePath || ""));
    if (bytes.length > 100 * 1024 * 1024) throw new Error("参照音声は100MB以内にしてください。");
    const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const audioContext = new AudioContext({ sampleRate: 48000 });
    try {
      const decoded = await audioContext.decodeAudioData(source);
      if (decoded.duration < .4) throw new Error("参照音声が短すぎます。1秒以上の明瞭な音声を使用してください。");
      if (decoded.duration > 60) throw new Error("参照音声は60秒以内にしてください。");
      const mono = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const samples = decoded.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) mono[index] += samples[index] / decoded.numberOfChannels;
      }
      const converted = resample48k(mono, decoded.sampleRate);
      ipcRenderer.send("irodori:referenceConverted", {
        requestId,
        audioDataUrl: wavDataUrl(converted, 48000),
      });
    } finally {
      await audioContext.close();
    }
  } catch (error) {
    ipcRenderer.send("irodori:referenceConverted", { requestId, error: String(error?.message || error) });
  }
});

window.addEventListener("DOMContentLoaded", () => {
  ipcRenderer.send("irodori:ready", { webgpuAvailable: Boolean(navigator.gpu) });
});
