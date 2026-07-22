// SPDX-License-Identifier: Apache-2.0

const VAD_PROFILES = Object.freeze({
  low: Object.freeze({ startMin: .035, startFactor: 4.8, onsetMs: 240, stopMin: .009, stopFactor: 1.5, silenceMs: 1200 }),
  normal: Object.freeze({ startMin: .024, startFactor: 3.8, onsetMs: 160, stopMin: .0075, stopFactor: 1.35, silenceMs: 1050 }),
  high: Object.freeze({ startMin: .014, startFactor: 2.8, onsetMs: 80, stopMin: .006, stopFactor: 1.25, silenceMs: 850 }),
});

function vadProfile(sensitivity = "normal") {
  return VAD_PROFILES[sensitivity] || VAD_PROFILES.normal;
}

module.exports = { VAD_PROFILES, vadProfile };
