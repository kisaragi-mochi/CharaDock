// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { ipcRenderer } = require("electron");

const { normalizeKokoroVoice, validateKokoroModelDirectory } = require("./lib/kokoro-webgpu.cjs");
const { wavDataUrl } = require("./lib/supertonic-tts.cjs");

const PIPER_CONFIG = Object.freeze({
  phoneme_id_map: Object.freeze({
    _: [0], "^": [1], $: [2], "?": [3], "\ue016": [4], "\ue017": [5], "\ue018": [6],
    "#": [7], "[": [8], "]": [9], a: [10], i: [11], u: [12], e: [13], o: [14],
    A: [15], I: [16], U: [17], E: [18], O: [19], "\ue000": [20], "\ue001": [21],
    "\ue002": [22], "\ue003": [23], "\ue004": [24], N: [25], "\ue019": [26],
    "\ue01a": [27], "\ue01b": [28], "\ue01c": [29], "\ue005": [30], q: [31], k: [32],
    "\ue006": [33], "\ue007": [34], g: [35], "\ue008": [36], "\ue009": [37], t: [38],
    "\ue00a": [39], d: [40], "\ue00b": [41], p: [42], "\ue00c": [43], b: [44],
    "\ue00d": [45], "\ue00e": [46], "\ue00f": [47], s: [48], "\ue010": [49], z: [50],
    j: [51], "\ue011": [52], f: [53], h: [54], "\ue012": [55], v: [56], n: [57],
    "\ue013": [58], m: [59], "\ue014": [60], r: [61], "\ue015": [62], w: [63], y: [64],
  }),
  language_id_map: Object.freeze({ ja: 0 }),
});

// piper-plusのOpenJTalk出力IDをKokoro tokenizerの文字IDへ変換する。
const KOKORO_IDS = new Map([
  [1, [0]], [2, [0]], [3, [6]], [4, [6]], [5, [6]], [6, [6]],
  [7, []], [8, []], [9, []], [10, [43]], [11, [51]], [12, [110]], [13, [47]], [14, [57]],
  [15, [43]], [16, [51]], [17, [110]], [18, [47]], [19, [57]],
  [20, [43, 158]], [21, [51, 158]], [22, [110, 158]], [23, [47, 158]], [24, [57, 158]],
  [25, [115]], [26, [55]], [27, [56]], [28, [112]], [29, [115]], [30, [148]], [31, [148]],
  [32, [53]], [33, [53, 164]], [34, [53, 22]], [35, [92]], [36, [92, 164]], [37, [92, 22]],
  [38, [62]], [39, [77]], [40, [46]], [41, [114]], [42, [58]], [43, [78]], [44, [44]],
  [45, [55, 164]], [46, [21]], [47, [20]], [48, [61]], [49, [125, 164]], [50, [68]],
  [51, [52]], [52, [62, 164]], [53, [118]], [54, [50]], [55, [46, 164]], [56, [64]],
  [57, [56]], [58, [44, 164]], [59, [55]], [60, [58, 164]], [61, [125]], [62, [6]],
  [63, [75]], [64, [52]],
]);

let g2pPromise = null;
let cachedEngine = null;
const disabledWebGpuRoots = new Set();

async function loadG2p() {
  if (g2pPromise) return g2pPromise;
  g2pPromise = (async () => {
    const wasmModule = await import("piper-plus/wasm/multilingual");
    let wasmPath = path.join(__dirname, "..", "node_modules", "piper-plus", "dist", "rust-wasm", "piper_plus_wasm_bg.wasm");
    wasmPath = wasmPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    const wasmBytes = await fs.readFile(wasmPath);
    // Electron blocks synchronous compilation of WASM modules larger than 8 MB on
    // the renderer main thread. piper-plus includes its Japanese dictionary in a
    // much larger module, so let wasm-bindgen compile and instantiate it
    // asynchronously instead.
    await wasmModule.default({
      module_or_path: new Uint8Array(
        wasmBytes.buffer,
        wasmBytes.byteOffset,
        wasmBytes.byteLength,
      ),
    });
    return new wasmModule.WasmPhonemizer(JSON.stringify(PIPER_CONFIG));
  })();
  return g2pPromise;
}

async function textToInputIds(text) {
  const g2p = await loadG2p();
  const result = g2p.phonemize(String(text || ""), "ja");
  try {
    const ids = [];
    for (const piperId of result.phonemeIds) {
      if (piperId === 0) continue;
      ids.push(...(KOKORO_IDS.get(piperId) || []));
    }
    if (ids[0] !== 0) ids.unshift(0);
    if (ids.at(-1) !== 0) ids.push(0);
    if (ids.length < 3) throw new Error("読み上げる日本語を音素へ変換できませんでした。");
    return ids.slice(0, 510);
  } finally {
    result.free();
  }
}

async function webGpuAvailable() {
  if (!navigator.gpu) return false;
  return Boolean(await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }));
}

async function loadEngine(modelDirectory, requestedDevice) {
  const resolved = validateKokoroModelDirectory(modelDirectory);
  if (!resolved.ready) throw new Error(`Kokoroモデルファイルが不足しています（${resolved.missingFiles.length}件）。`);
  const preference = ["auto", "webgpu", "wasm"].includes(requestedDevice) ? requestedDevice : "auto";
  if (cachedEngine?.root === resolved.root && cachedEngine.preference === preference) return cachedEngine;
  const ort = await import("onnxruntime-web/webgpu");
  ort.env.wasm.numThreads = 1;
  let ortDist = path.dirname(require.resolve("onnxruntime-web/webgpu"));
  ortDist = ortDist.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  ort.env.wasm.wasmPaths = pathToFileURL(ortDist + path.sep).href;

  const create = async (device) => {
    if (device === "webgpu" && !await webGpuAvailable()) throw new Error("このPCではWebGPUを利用できません。");
    const filename = device === "webgpu" ? "model.onnx" : "model_quantized.onnx";
    const model = await fs.readFile(path.join(resolved.root, "onnx", filename));
    const session = await ort.InferenceSession.create(new Uint8Array(model), {
      executionProviders: [device],
      graphOptimizationLevel: "all",
    });
    return { root: resolved.root, preference, device, ort, session };
  };

  if (disabledWebGpuRoots.has(resolved.root)) cachedEngine = await create("wasm");
  else if (preference === "webgpu") cachedEngine = await create("webgpu");
  else if (preference === "wasm") cachedEngine = await create("wasm");
  else {
    try { cachedEngine = await create("webgpu"); }
    catch (error) {
      console.warn("Kokoro WebGPU failed; falling back to CPU:", error);
      cachedEngine = await create("wasm");
    }
  }
  return cachedEngine;
}

async function synthesizeWithEngine(request, engine) {
  const inputIds = await textToInputIds(request.text);
  const voice = normalizeKokoroVoice(request.voice);
  const voiceBytes = await fs.readFile(path.join(engine.root, "voices", `${voice}.bin`));
  const voiceBuffer = voiceBytes.buffer.slice(
    voiceBytes.byteOffset,
    voiceBytes.byteOffset + voiceBytes.byteLength,
  );
  const styles = new Float32Array(voiceBuffer);
  const offset = 256 * Math.min(Math.max(inputIds.length - 2, 0), 509);
  const style = styles.slice(offset, offset + 256);
  if (style.length !== 256) throw new Error("Kokoro音声スタイルを読み込めませんでした。");
  const speed = Math.min(2, Math.max(.5, Number(request.speed) || 1));
  const feeds = {
    input_ids: new engine.ort.Tensor("int64", BigInt64Array.from(inputIds.map((value) => BigInt(value))), [1, inputIds.length]),
    style: new engine.ort.Tensor("float32", style, [1, 256]),
    speed: new engine.ort.Tensor("float32", Float32Array.of(speed), [1]),
  };
  const output = await engine.session.run(feeds);
  const waveform = await output.waveform?.getData?.(true);
  if (!waveform?.length) throw new Error("Kokoroが音声を生成できませんでした。");
  const samples = Float32Array.from(waveform);
  let peak = 0;
  let invalidSamples = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) invalidSamples += 1;
    else peak = Math.max(peak, Math.abs(sample));
  }
  if (invalidSamples || peak < 1e-5) {
    const error = new Error("Kokoro WebGPUが無音データを生成しました。");
    error.code = "KOKORO_SILENT_WEBGPU";
    throw error;
  }
  return { audioDataUrl: wavDataUrl(samples, 24_000), device: engine.device };
}

async function synthesize(request) {
  const engine = await loadEngine(request.modelDirectory, request.device);
  try {
    return await synthesizeWithEngine(request, engine);
  } catch (error) {
    if (engine.device !== "webgpu" || error?.code !== "KOKORO_SILENT_WEBGPU") throw error;
    disabledWebGpuRoots.add(engine.root);
    cachedEngine = null;
    console.warn("Kokoro WebGPU returned silence; falling back to CPU for this session.");
    const fallback = await loadEngine(request.modelDirectory, "wasm");
    return { ...await synthesizeWithEngine(request, fallback), fallbackFrom: "webgpu" };
  }
}

ipcRenderer.on("kokoro:synthesize", async (_event, request = {}) => {
  const requestId = String(request.requestId || "");
  try {
    ipcRenderer.send("kokoro:result", { requestId, ...await synthesize(request) });
  } catch (error) {
    ipcRenderer.send("kokoro:result", { requestId, error: String(error?.message || error) });
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  ipcRenderer.send("kokoro:ready", { webgpuAvailable: await webGpuAvailable().catch(() => false) });
});
