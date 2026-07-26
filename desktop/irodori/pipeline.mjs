// SPDX-License-Identifier: MIT
// Derived from ngc-shj/irodori-tts-webgpu runtime/pipeline.mjs, commit aa3b639.
// Copyright (c) 2026 NOGUCHI Shoji
const HOP = 1920;
const SR = 48000;
const LATENT_DIM = 32;
const BOS = 1;

const SIMPLE = [
  ["\t", ""], ["[n]", ""], ["\\[n\\]", ""], ["　", ""], ["？", "?"], ["！", "!"],
  ["♥", "♡"], ["●", "○"], ["◯", "○"], ["〇", "○"],
];
function stripOuterBrackets(text) {
  const pairs = { "「": "」", "『": "』", "（": "）", "【": "】", "(": ")" };
  while (text.length >= 2) {
    const s = text[0], e = text[text.length - 1];
    if (pairs[s] === e) {
      let depth = 0, all = true;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === s) depth++; else if (text[i] === e) depth--;
        if (depth === 0 && i < text.length - 1) { all = false; break; }
      }
      if (all && depth === 0) { text = text.slice(1, -1); continue; }
    }
    break;
  }
  return text;
}
export function normalizeText(text) {
  let output = String(text || "");
  for (const [a, b] of SIMPLE) output = output.split(a).join(b);
  output = output.replace(/[;▼♀♂《》≪≫①②③④⑤⑥]/g, "");
  output = output.replace(/[˗‐-―⁃−⎯⏤─━⸺⸻]/g, "");
  output = output.replace(/[～〜]/g, "ー").replace(/…{3,}/g, "……");
  output = stripOuterBrackets(output).normalize("NFKC");
  return output.split("...").join("…").split("..").join("…");
}

function gaussianNoise(length, seed) {
  let a = seed >>> 0;
  const random = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const u1 = Math.max(random(), 1e-12), u2 = random();
    output[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return output;
}

const KW_48K = [
  { b: [1.5351828863637502, -2.691804030199196, 1.198426263333146], a: [1, -1.6906995865986896, 0.7325047060963897] },
  { b: [0.9950442970178917, -1.9900885940357833, 0.9950442970178917], a: [1, -1.990076284018423, 0.9901009040531438] },
];
function lfilter(input, b, a) {
  const output = new Float64Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < input.length; n++) {
    const x = input[n];
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    output[n] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return output;
}
function integratedLoudness(wav, rate) {
  let data = wav;
  for (const filter of KW_48K) data = lfilter(data, filter.b, filter.a);
  const kernel = Math.round(.4 * rate), stride = Math.round(.1 * rate);
  if (data.length < kernel) return null;
  const frames = Math.ceil((data.length - kernel) / stride) + 1;
  const z = new Float64Array(frames), loudness = new Float64Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0; const offset = frame * stride;
    for (let i = 0; i < kernel; i++) { const at = offset + i; if (at < data.length) sum += data[at] * data[at]; }
    z[frame] = sum / kernel;
    loudness[frame] = -.691 + 10 * Math.log10(z[frame]);
  }
  const absolute = [...z.keys()].filter((i) => loudness[i] > -70);
  if (!absolute.length) return null;
  const mean = absolute.reduce((sum, i) => sum + z[i], 0) / absolute.length;
  const relativeGate = -.691 + 10 * Math.log10(mean) - 10;
  const relative = absolute.filter((i) => loudness[i] > relativeGate);
  if (!relative.length) return null;
  return -.691 + 10 * Math.log10(relative.reduce((sum, i) => sum + z[i], 0) / relative.length);
}
function normalizeReference(wav, rate, target = -16) {
  const output = Float32Array.from(wav);
  const loudness = integratedLoudness(output, rate);
  if (loudness !== null && Number.isFinite(loudness)) {
    const gain = Math.pow(10, (target - loudness) / 20);
    for (let i = 0; i < output.length; i++) output[i] *= gain;
  }
  let peak = 0;
  for (const value of output) peak = Math.max(peak, Math.abs(value));
  if (peak > 1) for (let i = 0; i < output.length; i++) output[i] /= peak;
  return output;
}

export class IrodoriTTS {
  constructor({ ort, sessions, tokenizer }) {
    this.ort = ort;
    this.s = sessions;
    this.tok = tokenizer;
    this.speakerCache = new Map();
  }
  tensor(data, shape, type = "float32") { return new this.ort.Tensor(type, data, shape); }
  tokenize(text) {
    const ids = this.tok.encode(normalizeText(text), { add_special_tokens: false });
    return Int32Array.from([BOS, ...ids].map(Number));
  }
  async encodeText(text) {
    const ids = this.tokenize(text), length = ids.length;
    const output = await this.s.text.run({
      input_ids: this.tensor(BigInt64Array.from(ids, (x) => BigInt(x)), [1, length], "int64"),
      mask: this.tensor(new Uint8Array(length).fill(1), [1, length], "bool"),
    });
    return { state: output.text_state.data, length, dim: output.text_state.dims[2], mask: new Uint8Array(length).fill(1) };
  }
  async referenceLatent(wav, sampleRate, cacheKey = "") {
    if (sampleRate !== SR) throw new Error(`参照音声は${SR}Hzへ変換する必要があります。`);
    if (cacheKey && this.speakerCache.has(cacheKey)) {
      const cached = this.speakerCache.get(cacheKey);
      this.speakerCache.delete(cacheKey);
      this.speakerCache.set(cacheKey, cached);
      return cached;
    }
    const normalized = normalizeReference(wav, sampleRate);
    const paddedLength = Math.ceil(normalized.length / HOP) * HOP;
    const padded = new Float32Array(paddedLength); padded.set(normalized);
    const encoded = await this.s.enc.run({ wav: this.tensor(padded, [1, 1, paddedLength]) });
    const latent = encoded.latent.data, length = encoded.latent.dims[1], mask = new Uint8Array(length).fill(1);
    const speaker = await this.s.speaker.run({
      ref_latent: this.tensor(latent, [1, length, LATENT_DIM]),
      ref_mask: this.tensor(mask, [1, length], "bool"),
    });
    const result = { state: speaker.speaker_state.data, length: speaker.speaker_state.dims[1], dim: speaker.speaker_state.dims[2], mask: speaker.speaker_mask.data };
    if (cacheKey) {
      this.speakerCache.set(cacheKey, result);
      while (this.speakerCache.size > 8) this.speakerCache.delete(this.speakerCache.keys().next().value);
    }
    return result;
  }
  async duration(text, speaker, { durationScale = 1, minSeconds = .5, maxSeconds = 30 } = {}) {
    const output = await this.s.duration.run({
      text_state: this.tensor(text.state, [1, text.length, text.dim]),
      text_mask: this.tensor(text.mask, [1, text.length], "bool"),
      aux: this.tensor(new Float32Array(14), [1, 14]),
      speaker_state: this.tensor(speaker.state, [1, speaker.length, speaker.dim]),
      speaker_mask: this.tensor(speaker.mask, [1, speaker.length], "bool"),
      has_speaker: this.tensor(new Uint8Array([1]), [1], "bool"),
    });
    const predicted = Math.expm1(output.log_frames.data[0]) * durationScale;
    return Math.max(Math.ceil(minSeconds * SR / HOP), Math.min(Math.floor(maxSeconds * SR / HOP), Math.round(predicted)));
  }
  async flow(text, speaker, length, { numSteps = 8, tScheduleMode = "sway", swayCoeff = -1, cfgText = 3, cfgSpk = 5, cfgMinT = .5, cfgMaxT = 1, initScale = .999, seed = 0 } = {}) {
    const size = length * LATENT_DIM;
    let current = gaussianNoise(size, seed);
    const zerosText = new Float32Array(text.length * text.dim), zerosTextMask = new Uint8Array(text.length);
    const zerosSpeaker = new Float32Array(speaker.length * speaker.dim), zerosSpeakerMask = new Uint8Array(speaker.length);
    const cat3 = (a, b, c, n, Type) => { const out = new Type(3 * n); out.set(a); out.set(b, n); out.set(c, 2 * n); return out; };
    const text3 = this.tensor(cat3(text.state, zerosText, text.state, text.length * text.dim, Float32Array), [3, text.length, text.dim]);
    const textMask3 = this.tensor(cat3(text.mask, zerosTextMask, text.mask, text.length, Uint8Array), [3, text.length], "bool");
    const speaker3 = this.tensor(cat3(speaker.state, speaker.state, zerosSpeaker, speaker.length * speaker.dim, Float32Array), [3, speaker.length, speaker.dim]);
    const speakerMask3 = this.tensor(cat3(speaker.mask, speaker.mask, zerosSpeakerMask, speaker.length, Uint8Array), [3, speaker.length], "bool");
    const text1 = this.tensor(text.state, [1, text.length, text.dim]), textMask1 = this.tensor(text.mask, [1, text.length], "bool");
    const speaker1 = this.tensor(speaker.state, [1, speaker.length, speaker.dim]), speakerMask1 = this.tensor(speaker.mask, [1, speaker.length], "bool");
    const schedule = new Float32Array(numSteps + 1);
    for (let step = 0; step <= numSteps; step++) {
      let u = step / numSteps;
      if (tScheduleMode === "sway") u += swayCoeff * (Math.cos(.5 * Math.PI * u) + u - 1);
      schedule[step] = (1 - Math.max(0, Math.min(1, u))) * initScale;
    }
    const x3 = new Float32Array(3 * size);
    const t3 = new Float32Array(3);
    for (let step = 0; step < numSteps; step++) {
      const time = schedule[step];
      const delta = schedule[step + 1] - time;
      let velocity;
      if (time >= cfgMinT && time <= cfgMaxT) {
        x3.set(current); x3.set(current, size); x3.set(current, 2 * size);
        t3.fill(time);
        const output = await this.s.dit.run({
          x_t: this.tensor(x3, [3, length, LATENT_DIM]), t: this.tensor(t3, [3]),
          text_state: text3, text_mask: textMask3, speaker_state: speaker3, speaker_mask: speakerMask3,
        });
        velocity = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          const conditioned = output.v.data[i];
          velocity[i] = conditioned + cfgText * (conditioned - output.v.data[size + i]) + cfgSpk * (conditioned - output.v.data[2 * size + i]);
        }
      } else {
        const output = await this.s.dit.run({
          x_t: this.tensor(current, [1, length, LATENT_DIM]), t: this.tensor(new Float32Array([time]), [1]),
          text_state: text1, text_mask: textMask1, speaker_state: speaker1, speaker_mask: speakerMask1,
        });
        velocity = output.v.data;
      }
      for (let i = 0; i < size; i++) current[i] += velocity[i] * delta;
    }
    return current;
  }
  async decode(latent, length) {
    const transposed = new Float32Array(LATENT_DIM * length);
    for (let s = 0; s < length; s++) for (let d = 0; d < LATENT_DIM; d++) transposed[d * length + s] = latent[s * LATENT_DIM + d];
    return (await this.s.dac.run({ z: this.tensor(transposed, [1, LATENT_DIM, length]) })).audio.data;
  }
  async synthesize(textValue, referenceWav, sampleRate, options = {}) {
    const startedAt = performance.now();
    const text = await this.encodeText(textValue);
    const textEncodedAt = performance.now();
    const speakerCacheHit = Boolean(options.speakerCacheKey && this.speakerCache.has(options.speakerCacheKey));
    const speaker = await this.referenceLatent(referenceWav, sampleRate, options.speakerCacheKey);
    const speakerEncodedAt = performance.now();
    const length = await this.duration(text, speaker, options);
    const durationPredictedAt = performance.now();
    const latent = await this.flow(text, speaker, length, options);
    const flowedAt = performance.now();
    const audio = await this.decode(latent, length);
    const finishedAt = performance.now();
    return {
      audio,
      sampleRate: SR,
      seqLen: length,
      speakerCacheHit,
      timings: {
        textMs: textEncodedAt - startedAt,
        speakerMs: speakerEncodedAt - textEncodedAt,
        durationMs: durationPredictedAt - speakerEncodedAt,
        flowMs: flowedAt - durationPredictedAt,
        decodeMs: finishedAt - flowedAt,
        totalMs: finishedAt - startedAt,
      },
    };
  }
}
