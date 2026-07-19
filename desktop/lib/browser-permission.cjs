// SPDX-License-Identifier: Apache-2.0

const APPROVE_PATTERN = /(?:はい|うん|いいよ|どうぞ|お願い|許可(?:する)?|開いて(?:いいよ)?|見て(?:いいよ)?|みて(?:いいよ)?|ok|okay)/i;
const DENY_PATTERN = /(?:やめて|だめ|ダメ|キャンセル|開かない|使わない|許可しない|今はいい)/i;

function normalizeBrowserUrl(raw) {
  let value = String(raw || "").trim().replace(/[、。）」』】>,]+$/g, "");
  if (!value) return null;
  if (/^(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(value)) value = `http://${value}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
  url.hash = "";
  return url;
}

function extractBrowserTarget(message) {
  const text = String(message || "");
  const explicit = text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (explicit) return normalizeBrowserUrl(explicit);
  const domain = text.match(/(?:localhost(?::\d+)?|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[a-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?/i)?.[0];
  return domain ? normalizeBrowserUrl(domain) : null;
}

function comparableHost(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "");
}

function isAllowedBrowserUrl(rawUrl, allowedHost) {
  const url = rawUrl instanceof URL ? rawUrl : normalizeBrowserUrl(rawUrl);
  return Boolean(url && comparableHost(url.hostname) === comparableHost(allowedHost));
}

function browserConversationAction(message, hasPendingRequest = false) {
  const text = String(message || "").trim().slice(0, 800);
  if (!text) return "";
  if (hasPendingRequest) {
    if (DENY_PATTERN.test(text)) return "deny";
    if (text.length <= 48 && APPROVE_PATTERN.test(text)) return "approve";
    return "replace";
  }
  const browserMentioned = /(?:ブラウザ|browser|ウェブページ|webページ|サイト|ホームページ)/i.test(text);
  const browserAction = /(?:開いて|見て|みて|確認して|読んで|調べて|アクセスして|移動して|操作して)/i.test(text);
  return browserMentioned && browserAction ? "request" : "";
}

module.exports = {
  browserConversationAction,
  comparableHost,
  extractBrowserTarget,
  isAllowedBrowserUrl,
  normalizeBrowserUrl,
};
