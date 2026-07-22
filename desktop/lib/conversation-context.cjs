// SPDX-License-Identifier: Apache-2.0

function boundedConversationHistory(history, userText, assistantText) {
  return [
    ...(Array.isArray(history) ? history : []),
    { role: "user", text: String(userText || "").trim() },
    { role: "assistant", text: String(assistantText || "").trim() },
  ].filter((entry) => entry.text).slice(-12);
}

function recentConversationContext(history) {
  if (!Array.isArray(history) || !history.length) return "";
  const lines = history.slice(-8).map((entry) => {
    const label = entry.role === "assistant" ? "キャラクター" : "ユーザー";
    return `${label}: ${String(entry.text || "").replace(/\s+/g, " ").slice(0, 600)}`;
  });
  return [
    "直近の会話は次のとおりです。『明日は？』『それは？』などの省略は、この流れを引き継いで解釈してください。",
    "<recent_conversation>",
    ...lines,
    "</recent_conversation>",
  ].join("\n");
}

module.exports = { boundedConversationHistory, recentConversationContext };
