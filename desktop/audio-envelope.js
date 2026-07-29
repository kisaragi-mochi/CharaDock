// SPDX-License-Identifier: Apache-2.0
(function exposeAudioEnvelope(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CharaDockAudioEnvelope = api;
})(typeof globalThis === "object" ? globalThis : null, () => {
  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function createAdaptiveSpeechEnvelope() {
    let envelope = 0;
    let dynamicPeak = 0.022;
    let noiseFloor = 0.0015;
    let lastAt = 0;

    return {
      sample(rawRms, now = 0) {
        const rms = clamp(Number(rawRms) || 0, 0, 1);
        const elapsedMs = lastAt ? clamp(Number(now) - lastAt, 8, 100) : 16;
        lastAt = Number(now) || lastAt + elapsedMs;
        const frameScale = elapsedMs / 16.667;
        const peakDecay = Math.pow(0.988, frameScale);
        dynamicPeak = Math.max(rms, dynamicPeak * peakDecay, 0.018);
        if (rms < Math.max(0.008, noiseFloor * 2.2)) {
          const floorFollow = 1 - Math.pow(0.985, frameScale);
          noiseFloor += (rms - noiseFloor) * floorFollow;
        }
        noiseFloor = clamp(noiseFloor, 0.0004, 0.006);
        const gate = Math.max(0.0024, noiseFloor * 1.75);
        const ceiling = Math.max(gate + 0.012, dynamicPeak * 0.76);
        const normalized = clamp((rms - gate) / (ceiling - gate), 0, 1);
        const target = Math.pow(normalized, 0.72) * 0.5;
        const baseFollow = target > envelope ? 0.58 : 0.24;
        const follow = 1 - Math.pow(1 - baseFollow, frameScale);
        envelope += (target - envelope) * follow;
        if (normalized === 0 && envelope < 0.018) envelope = 0;
        return clamp(envelope, 0, 0.5);
      },
      reset() {
        envelope = 0;
        dynamicPeak = 0.022;
        noiseFloor = 0.0015;
        lastAt = 0;
      },
      state() {
        return { envelope, dynamicPeak, noiseFloor };
      },
    };
  }

  return { createAdaptiveSpeechEnvelope };
});
