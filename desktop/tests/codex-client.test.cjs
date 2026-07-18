// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { CodexAppServerClient } = require("../backend/codex-client.cjs");

test("Codex client reads account state through app-server", async () => {
  const client = new CodexAppServerClient();
  const calls = [];
  client.ensureStarted = async () => {};
  client.request = async (method, params) => {
    calls.push({ method, params });
    return { requiresOpenaiAuth: true, account: { type: "chatgpt", planType: "plus" } };
  };
  const result = await client.getAccount();
  assert.equal(result.account.type, "chatgpt");
  assert.deepEqual(calls, [{ method: "account/read", params: { refreshToken: false } }]);
});

test("Codex client starts the managed ChatGPT OAuth flow", async () => {
  const client = new CodexAppServerClient();
  let request;
  client.ensureStarted = async () => {};
  client.request = async (method, params) => {
    request = { method, params };
    return { type: "chatgpt", authUrl: "https://auth.openai.com/example", loginId: "login-1" };
  };
  const result = await client.startChatGPTLogin();
  assert.equal(result.loginId, "login-1");
  assert.equal(request.method, "account/login/start");
  assert.equal(request.params.type, "chatgpt");
  assert.equal(request.params.appBrand, "codex");
  assert.equal(request.params.useHostedLoginSuccessPage, true);
});

test("Codex client logs out through app-server and resets its conversation", async () => {
  const client = new CodexAppServerClient();
  client.threadId = "thread-1";
  client.ensureStarted = async () => {};
  let request;
  client.request = async (method, params) => {
    request = { method, params };
    return {};
  };
  assert.equal(await client.logout(), true);
  assert.deepEqual(request, { method: "account/logout", params: null });
  assert.equal(client.threadId, null);
});

test("Codex client checks image-generation capability", async () => {
  const client = new CodexAppServerClient();
  let request;
  client.ensureStarted = async () => {};
  client.request = async (method, params) => {
    request = { method, params };
    return { imageGeneration: true, namespaceTools: true, webSearch: true };
  };
  const result = await client.getModelProviderCapabilities();
  assert.equal(result.imageGeneration, true);
  assert.deepEqual(request, { method: "modelProvider/capabilities/read", params: {} });
});

test("Codex client starts WebRTC realtime and forwards transcript events", async () => {
  const client = new CodexAppServerClient();
  const calls = [];
  const events = [];
  client.ensureStarted = async () => {};
  client.ensureThread = async () => {
    client.threadId = "thread-voice";
    return client.threadId;
  };
  client.request = async (method, params) => {
    calls.push({ method, params });
    return {};
  };
  const result = await client.startRealtime({ sdp: "v=0\r\n...", prompt: "日本語", onEvent: (event) => events.push(event) });
  assert.equal(result.threadId, "thread-voice");
  assert.equal(calls[0].method, "thread/realtime/start");
  assert.equal(calls[0].params.outputModality, "audio");
  assert.equal(calls[0].params.version, "v1");
  assert.deepEqual(calls[0].params.transport, { type: "webrtc", sdp: "v=0\r\n..." });
  client.handleLine(JSON.stringify({ method: "thread/realtime/transcript/delta", params: { threadId: "thread-voice", role: "user", delta: "こんにちは" } }));
  assert.equal(events[0].params.delta, "こんにちは");
});

test("Codex client surfaces realtime startup notification errors immediately", async () => {
  const client = new CodexAppServerClient();
  client.ensureStarted = async () => {};
  client.ensureThread = async () => {
    client.threadId = "thread-voice";
    return client.threadId;
  };
  client.request = async () => new Promise(() => {});
  const starting = client.startRealtime({ sdp: "v=0\r\n..." });
  await new Promise((resolve) => setImmediate(resolve));
  client.handleLine(JSON.stringify({
    method: "thread/realtime/error",
    params: { threadId: "thread-voice", message: "not available" },
  }));
  await assert.rejects(starting, /not available/);
});

test("Codex client stops the active realtime session", async () => {
  const client = new CodexAppServerClient();
  client.threadId = "thread-voice";
  client.realtimeHandlers.set("thread-voice", () => {});
  let call;
  client.request = async (method, params) => { call = { method, params }; return {}; };
  assert.equal(await client.stopRealtime(), true);
  assert.deepEqual(call, { method: "thread/realtime/stop", params: { threadId: "thread-voice" } });
});

test("missing Codex CLI reports a friendly error instead of crashing", async () => {
  const client = new CodexAppServerClient({ command: "purupuru-command-that-does-not-exist" });
  await assert.rejects(client.ensureStarted(), /Codex CLIを起動できません.*PATH/);
});
