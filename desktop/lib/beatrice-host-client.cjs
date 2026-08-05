// SPDX-License-Identifier: Apache-2.0
const { spawn } = require("node:child_process");
const { BEATRICE_BLOCK_SAMPLES, BEATRICE_SAMPLE_RATE } = require("./beatrice-v2.cjs");

function beatriceHostArguments(options = {}) {
  return [
    "--plugin", options.vstPath,
    "--model", options.modelPath,
    "--voice", String(options.voiceId ?? 0),
    "--pitch-shift", String(options.pitchShift ?? 0),
    "--formant-shift", String(options.formantShift ?? 0),
    "--input-gain", String(options.inputGain ?? 0),
    "--output-gain", String(options.outputGain ?? 0),
    "--intonation", String(options.intonation ?? 1),
    "--pitch-correction", String(options.pitchCorrection ?? 0),
    "--pitch-correction-type", String(options.pitchCorrectionType ?? 0),
    "--sample-rate", String(BEATRICE_SAMPLE_RATE),
    "--block-samples", String(BEATRICE_BLOCK_SAMPLES),
  ];
}

class BeatriceHostClient {
  constructor({
    executablePath, vstPath, modelPath, voiceId = 0,
    pitchShift = 0, formantShift = 0, inputGain = 0, outputGain = 0,
    intonation = 1, pitchCorrection = 0, pitchCorrectionType = 0,
    onAudio, onError,
  } = {}) {
    this.options = {
      executablePath, vstPath, modelPath, voiceId,
      pitchShift, formantShift, inputGain, outputGain,
      intonation, pitchCorrection, pitchCorrectionType,
      onAudio, onError,
    };
    this.child = null;
    this.stdout = Buffer.alloc(0);
    this.ready = false;
  }

  async start() {
    if (this.child) return;
    const { executablePath } = this.options;
    const child = spawn(executablePath, beatriceHostArguments(this.options), { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child = child;
    child.stdout.on("data", (chunk) => this.consumeStdout(chunk));
    child.on("error", (error) => this.options.onError?.(error));
    child.on("exit", (code) => {
      const wasReady = this.ready;
      this.child = null;
      this.ready = false;
      if (wasReady && code !== 0 && code !== null) this.options.onError?.(new Error(`Beatriceホストが終了しました (${code})`));
    });
    try {
      await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Beatrice 2の起動が時間切れになりました。")), 15_000);
      let stderr = "";
      const cleanup = () => clearTimeout(timer);
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
        if (/^READY\b/m.test(stderr)) {
          cleanup();
          this.ready = true;
          resolve();
        }
        if (stderr.length > 16_000) stderr = stderr.slice(-8_000);
      });
      child.once("exit", (code) => {
        if (!this.ready) {
          cleanup();
          reject(new Error(stderr.trim() || `Beatrice 2を起動できませんでした (${code})`));
        }
      });
      });
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  consumeStdout(chunk) {
    this.stdout = Buffer.concat([this.stdout, chunk]);
    while (this.stdout.length >= 4) {
      const count = this.stdout.readUInt32LE(0);
      if (count !== BEATRICE_BLOCK_SAMPLES) {
        const error = new Error("Beatriceホストから不正な音声長を受信しました。");
        this.options.onError?.(error);
        this.stop();
        return;
      }
      const bytes = count * 4;
      if (this.stdout.length < 4 + bytes) return;
      const data = this.stdout.subarray(4, 4 + bytes);
      const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      this.stdout = this.stdout.subarray(4 + bytes);
      this.options.onAudio?.(copy);
    }
  }

  push(arrayBuffer) {
    if (!this.ready || !this.child?.stdin?.writable) return false;
    const input = Buffer.from(arrayBuffer);
    if (input.byteLength !== BEATRICE_BLOCK_SAMPLES * 4) return false;
    const header = Buffer.allocUnsafe(4);
    header.writeUInt32LE(BEATRICE_BLOCK_SAMPLES);
    this.child.stdin.write(Buffer.concat([header, input]));
    return true;
  }

  stop() {
    const child = this.child;
    this.child = null;
    this.ready = false;
    if (!child) return;
    try { child.stdin.end(); } catch {}
    setTimeout(() => { if (!child.killed) child.kill(); }, 500).unref();
  }
}

module.exports = { BeatriceHostClient, beatriceHostArguments };
