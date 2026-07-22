// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { OpenAIClient, responseOutputText } = require("../backend/openai-client.cjs");

test("responseOutputText supports SDK helper and raw Responses API output", () => {
  assert.equal(responseOutputText({ output_text: " hello " }), "hello");
  assert.equal(responseOutputText({
    output: [{ type: "message", content: [{ type: "output_text", text: "こん" }, { type: "output_text", text: "にちは" }] }],
  }), "こん\nにちは");
});

test("OpenAIClient sends API key only in the main-process request and continues response state", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () => ({ id: `resp_${calls.length}`, output_text: `reply ${calls.length}` }),
    };
  };
  try {
    const client = new OpenAIClient();
    assert.equal((await client.sendMessage({ apiKey: "sk-secret", model: "test-model", message: "hello" })).text, "reply 1");
    assert.equal((await client.sendMessage({ apiKey: "sk-secret", model: "test-model", message: "again" })).text, "reply 2");
    assert.equal(calls[0].options.headers.Authorization, "Bearer sk-secret");
    assert.equal(calls[0].body.model, "test-model");
    assert.equal(calls[0].body.previous_response_id, undefined);
    assert.equal(calls[1].body.previous_response_id, "resp_1");
  } finally {
    global.fetch = originalFetch;
  }
});

test("OpenAIClient streams Responses API text deltas", async () => {
  const originalFetch = global.fetch;
  const encoder = new TextEncoder();
  global.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).stream, true);
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"こん"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"にちは"}\n\ndata: {"type":"response.completed","response":{"id":"resp_stream"}}\n\n'));
          controller.close();
        },
      }),
    };
  };
  try {
    const deltas = [];
    const client = new OpenAIClient();
    const result = await client.sendMessage({
      apiKey: "sk-secret",
      model: "test-model",
      message: "hello",
      instructions: "やさしく答える",
      onDelta: (delta, text) => deltas.push([delta, text]),
    });
    assert.equal(result.text, "こんにちは");
    assert.equal(result.responseId, "resp_stream");
    assert.deepEqual(deltas, [["こん", "こん"], ["にちは", "こんにちは"]]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("OpenAIClient can interrupt an active response", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  });
  try {
    const client = new OpenAIClient();
    const pending = client.sendMessage({ apiKey: "sk-secret", model: "test-model", message: "hello" });
    await Promise.resolve();
    assert.equal(await client.interruptActiveTurn(), true);
    await assert.rejects(pending, /中断/);
    assert.equal(await client.interruptActiveTurn(), false);
  } finally {
    global.fetch = originalFetch;
  }
});
