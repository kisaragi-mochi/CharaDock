// SPDX-License-Identifier: Apache-2.0

const REALTIME_VOICES = Object.freeze([
  "juniper", "maple", "spruce", "ember", "vale", "breeze", "arbor", "sol", "cove",
]);
const REALTIME_VOICE_SET = new Set(REALTIME_VOICES);
const DEFAULT_REALTIME_VOICE = "cove";

function normalizeRealtimeVoice(value, fallback = DEFAULT_REALTIME_VOICE) {
  const normalized = String(value || "").trim().toLowerCase();
  if (REALTIME_VOICE_SET.has(normalized)) return normalized;
  return REALTIME_VOICE_SET.has(fallback) ? fallback : DEFAULT_REALTIME_VOICE;
}

function normalizeRealtimeVoiceList(response = {}) {
  const source = response?.voices && typeof response.voices === "object" ? response.voices : response;
  const unique = (values) => [...new Set((Array.isArray(values) ? values : [])
    .map((voice) => String(voice || "").trim().toLowerCase())
    .filter((voice) => REALTIME_VOICE_SET.has(voice)))];
  // Codex Realtime V3 currently uses the voice set returned as `v1` by
  // listVoices. Passing a `v2` voice makes thread/realtime/start reject it.
  const voices = unique(source?.v1);
  const defaultVoice = normalizeRealtimeVoice(source?.defaultV1);
  return {
    voices: voices.length ? voices : [DEFAULT_REALTIME_VOICE],
    defaultVoice,
  };
}

module.exports = {
  DEFAULT_REALTIME_VOICE,
  REALTIME_VOICES,
  normalizeRealtimeVoice,
  normalizeRealtimeVoiceList,
};
