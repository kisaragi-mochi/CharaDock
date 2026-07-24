// SPDX-License-Identifier: Apache-2.0

const REALTIME_UNAVAILABLE_MESSAGE = "ChatGPT側でGPT-Live / Codex Voiceがこのアカウントにまだ提供されていません。";

function isRealtimeUnavailableError(value) {
  const message = String(value?.message || value || "");
  return /(?:\b404\b|not found|codex\/realtime\/calls|realtime[^\n]{0,80}not available)/i.test(message);
}

function userFacingRealtimeError(value) {
  if (isRealtimeUnavailableError(value)) return REALTIME_UNAVAILABLE_MESSAGE;
  const message = String(value?.message || value || "").trim();
  return message || "GPT-Live / Codex Voiceを開始できませんでした。";
}

module.exports = {
  REALTIME_UNAVAILABLE_MESSAGE,
  isRealtimeUnavailableError,
  userFacingRealtimeError,
};
