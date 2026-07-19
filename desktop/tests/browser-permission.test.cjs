// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  browserConversationAction,
  extractBrowserTarget,
  isAllowedBrowserUrl,
  normalizeBrowserUrl,
} = require("../lib/browser-permission.cjs");

test("browser use is requested and approved in natural conversation", () => {
  assert.equal(browserConversationAction("ブラウザで https://example.com を確認して"), "request");
  assert.equal(browserConversationAction("サイトを開いて内容を見て"), "request");
  assert.equal(browserConversationAction("ブラウザの意味を教えて"), "");
  assert.equal(browserConversationAction("いいよ、開いて", true), "approve");
  assert.equal(browserConversationAction("今は使わない", true), "deny");
});

test("browser URL parsing rejects active and credential-bearing schemes", () => {
  assert.equal(normalizeBrowserUrl("javascript:alert(1)"), null);
  assert.equal(normalizeBrowserUrl("https://user:pass@example.com"), null);
  assert.equal(normalizeBrowserUrl("example.com/docs").href, "https://example.com/docs");
  assert.equal(normalizeBrowserUrl("localhost:3000/settings").href, "http://localhost:3000/settings");
});

test("browser permission is scoped to one normalized host", () => {
  assert.equal(extractBrowserTarget("https://www.example.com/docs を見て").hostname, "www.example.com");
  assert.equal(isAllowedBrowserUrl("https://example.com/next", "www.example.com"), true);
  assert.equal(isAllowedBrowserUrl("https://other.example.com/", "example.com"), false);
});
