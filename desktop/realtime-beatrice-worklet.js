// SPDX-License-Identifier: Apache-2.0
class CharaDockBeatriceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capture = new Float32Array(480);
    this.captureOffset = 0;
    this.playback = [];
    this.playbackOffset = 0;
    this.buffered = 0;
    this.started = false;
    this.port.onmessage = (event) => {
      const samples = new Float32Array(event.data);
      if (!samples.length) return;
      this.playback.push(samples);
      this.buffered += samples.length;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    if (input) {
      let position = 0;
      while (position < input.length) {
        const count = Math.min(480 - this.captureOffset, input.length - position);
        this.capture.set(input.subarray(position, position + count), this.captureOffset);
        this.captureOffset += count;
        position += count;
        if (this.captureOffset === 480) {
          const frame = this.capture;
          this.capture = new Float32Array(480);
          this.captureOffset = 0;
          this.port.postMessage(frame.buffer, [frame.buffer]);
        }
      }
    }

    output.fill(0);
    if (!this.started && this.buffered >= 1920) this.started = true;
    if (!this.started) return true;
    let written = 0;
    while (written < output.length && this.playback.length) {
      const frame = this.playback[0];
      const count = Math.min(output.length - written, frame.length - this.playbackOffset);
      output.set(frame.subarray(this.playbackOffset, this.playbackOffset + count), written);
      written += count;
      this.playbackOffset += count;
      this.buffered -= count;
      if (this.playbackOffset === frame.length) {
        this.playback.shift();
        this.playbackOffset = 0;
      }
    }
    if (!this.playback.length && written < output.length) this.started = false;
    return true;
  }
}

registerProcessor("charadock-beatrice", CharaDockBeatriceProcessor);
