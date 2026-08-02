// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function cacheKey(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function diskCacheStorage(rootDirectory) {
  const root = path.resolve(rootDirectory);
  return {
    async open(name) {
      const directory = path.join(root, cacheKey(name));
      await fs.promises.mkdir(directory, { recursive: true });
      const fileFor = (request) => path.join(directory, `${cacheKey(typeof request === "string" ? request : request?.url)}.bin`);
      return {
        async match(request) {
          try {
            const bytes = await fs.promises.readFile(fileFor(request));
            return new Response(bytes);
          } catch (error) {
            if (error?.code === "ENOENT") return undefined;
            throw error;
          }
        },
        async put(request, response) {
          const destination = fileFor(request);
          const temporary = `${destination}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
          const bytes = Buffer.from(await response.arrayBuffer());
          await fs.promises.writeFile(temporary, bytes, { mode: 0o600 });
          await fs.promises.rename(temporary, destination);
        },
        async delete(request) {
          try { await fs.promises.unlink(fileFor(request)); return true; } catch (error) {
            if (error?.code === "ENOENT") return false;
            throw error;
          }
        },
      };
    },
  };
}

const cacheDirectory = String(process.env.CHARADOCK_SBV2_CACHE_DIR || "");
if (!cacheDirectory) throw new Error("JP-Extra共通モデルのキャッシュ先がありません。");
globalThis.caches = diskCacheStorage(cacheDirectory);

let apiPromise;
let dictionaryPromise;
let debertaAssetsPromise;
let adapter = null;
let loadedKey = "";
let loadedDevice = "";

const loadApi = () => apiPromise ||= Promise.all([
  import("@hdae/sbv2-web/node"),
  import("@jsr/hdae__yomi/loader"),
]).then(([sbv2, yomi]) => ({ ...sbv2, getDictionary: yomi.getDictionary }));

function send(payload) {
  if (process.send) process.send(payload);
}

function progress(id, phase, detail = {}) {
  send({ event: "progress", id, phase, ...detail });
}

const lastProgress = new Map();
function downloadProgress(id, phase, detail = {}) {
  const key = `${phase}:${detail.path || ""}`;
  const now = Date.now();
  const previous = lastProgress.get(key) || { at: 0, loaded: 0 };
  const finished = Number(detail.total) > 0 && Number(detail.loaded) >= Number(detail.total);
  if (!finished && now - previous.at < 150 && Number(detail.loaded) - previous.loaded < 1024 * 1024) return;
  lastProgress.set(key, { at: now, loaded: Number(detail.loaded) || 0 });
  progress(id, phase, detail);
}

async function inspectModel(modelPath) {
  const { readAivmxManifest } = await loadApi();
  const bytes = new Uint8Array(await fs.promises.readFile(modelPath));
  return readAivmxManifest(bytes, { stripAssets: true });
}

async function commonAssets(id) {
  const api = await loadApi();
  dictionaryPromise ||= api.getDictionary({
    onProgress: ({ loaded, total }) => downloadProgress(id, "dictionary", { loaded, total: total || 0 }),
  });
  debertaAssetsPromise ||= api.getDeberta({
    onProgress: ({ path: assetPath, loaded, total }) => downloadProgress(id, "deberta", { path: assetPath, loaded, total: total || 0 }),
  });
  const [dict, deberta] = await Promise.all([dictionaryPromise, debertaAssetsPromise]);
  return { api, dict, deberta };
}

async function releaseAdapter() {
  const current = adapter;
  adapter = null;
  loadedKey = "";
  loadedDevice = "";
  await current?.release?.();
}

async function loadAdapter(id, modelPath, requestedDevice) {
  const stat = await fs.promises.stat(modelPath);
  if (!stat.isFile()) throw new Error("選択したJP-Extraモデルが見つかりません。");
  const device = ["auto", "webgpu", "cpu"].includes(requestedDevice) ? requestedDevice : "auto";
  const key = `${modelPath}:${stat.size}:${stat.mtimeMs}:${device}`;
  if (adapter && loadedKey === key) return adapter;
  await releaseAdapter();
  const { api, deberta } = await commonAssets(id);
  const aivmxBytes = new Uint8Array(await fs.promises.readFile(modelPath));
  const attempts = device === "auto" ? ["webgpu", "cpu"] : [device];
  let lastError;
  for (const candidate of attempts) {
    try {
      progress(id, "loading", { device: candidate });
      adapter = await api.Sbv2NodeModelAdapter.createFromAivmx({
        aivmxBytes,
        bertOnnxBytes: deberta.bertOnnxBytes,
        tokenizer: deberta.tokenizer,
        device: candidate,
      });
      loadedKey = key;
      loadedDevice = candidate;
      progress(id, "ready", { device: candidate });
      return adapter;
    } catch (error) {
      lastError = error;
      adapter = null;
      progress(id, "device-failed", { device: candidate, message: String(error?.message || error).slice(0, 500) });
    }
  }
  throw lastError || new Error("JP-Extraモデルを起動できませんでした。");
}

async function synthesize(id, payload) {
  const { api, dict, deberta } = await commonAssets(id);
  const engine = await loadAdapter(id, payload.modelPath, payload.device);
  const text = String(payload.text || "").trim();
  if (!text) return { audioDataUrl: "", device: loadedDevice };
  const startedAt = Date.now();
  const wave = await api.synthesizeText(text, dict, deberta.tokenizer, engine, {
    styleId: Math.max(0, Math.round(Number(payload.styleId) || 0)),
    styleWeight: Number.isFinite(Number(payload.styleWeight)) ? Math.max(0, Math.min(2, Number(payload.styleWeight))) : 1,
    speakerId: Math.max(0, Math.round(Number(payload.speakerId) || 0)),
    scalars: { lengthScale: 1 / Math.max(.5, Math.min(2, Number(payload.speed) || 1)) },
    postSilenceSec: .12,
  });
  const wav = api.encodeWav(wave, engine.sampleRate);
  return {
    audioDataUrl: `data:audio/wav;base64,${Buffer.from(wav).toString("base64")}`,
    device: loadedDevice,
    elapsedMs: Date.now() - startedAt,
  };
}

async function handle(message) {
  const id = String(message?.id || "");
  try {
    let result;
    if (message?.type === "inspect") result = await inspectModel(String(message.payload?.modelPath || ""));
    else if (message?.type === "prewarm") {
      await loadAdapter(id, String(message.payload?.modelPath || ""), String(message.payload?.device || "auto"));
      result = { device: loadedDevice };
    } else if (message?.type === "synthesize") result = await synthesize(id, message.payload || {});
    else if (message?.type === "release") { await releaseAdapter(); result = { released: true }; }
    else throw new Error("JP-Extraワーカーへ不明な処理が要求されました。");
    send({ event: "result", id, ok: true, result });
  } catch (error) {
    send({ event: "result", id, ok: false, error: String(error?.message || error), stack: String(error?.stack || "").slice(0, 4000) });
  }
}

let requestQueue = Promise.resolve();
process.on("message", (message) => {
  // ONNX sessions and adapter replacement are intentionally single-flight.
  // Renderer prefetch can otherwise overlap two segments and race release/load.
  requestQueue = requestQueue.then(() => handle(message));
});
process.on("disconnect", () => { releaseAdapter().finally(() => process.exit(0)); });
send({ event: "ready" });

module.exports = { diskCacheStorage };
