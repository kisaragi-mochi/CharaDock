// SPDX-License-Identifier: Apache-2.0

function cleanAssistantText(value, { streaming = false } = {}) {
  let text = String(value || "")
    .replace(/cite[^]*(?:|$)/gu, "")
    .replace(/cite(?:[^]*)?$/gu, "")
    .replace(/[ \t]+([、。！？!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
  if (!streaming) text = text.trim();
  return text;
}

function latestWorkDisplayText(value, maxLength = 180) {
  const text = cleanAssistantText(value).replace(/\r/g, "");
  if (!text) return "作業を続けています…";
  const blocks = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  let latest = blocks.at(-1) || text;
  const sentences = latest.match(/[^。！？!?]*[。！？!?]+|[^。！？!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [];
  if (sentences.length > 1) latest = sentences.at(-1);
  const limit = Math.max(60, Number(maxLength) || 180);
  return latest.length > limit ? `…${latest.slice(-limit)}` : latest;
}

module.exports = { cleanAssistantText, latestWorkDisplayText };
