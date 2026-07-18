// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveCodexCommand } = require("../lib/codex-command.cjs");

test("Codex command honors an explicit path", async () => {
  const command = await resolveCodexCommand({ platform: "win32", env: { CODEX_CLI_PATH: "D:\\codex.exe" } });
  assert.equal(command, "D:\\codex.exe");
});

test("Codex command discovers the Windows Store Codex app binary", async () => {
  const appxPath = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_1\\app\\resources\\codex.exe";
  const calls = [];
  const command = await resolveCodexCommand({
    platform: "win32",
    env: {},
    exists: (candidate) => candidate === appxPath,
    runCommand: async (name) => {
      calls.push(name);
      return name === "powershell.exe" ? appxPath : "";
    },
  });
  assert.equal(command, appxPath);
  assert.deepEqual(calls, ["where.exe", "powershell.exe"]);
});

test("Codex command caches the protected Windows Store binary", async () => {
  const appxPath = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_1\\app\\resources\\codex.exe";
  let copied = null;
  const command = await resolveCodexCommand({
    platform: "win32",
    env: {},
    exists: (candidate) => candidate === appxPath,
    runCommand: async (name) => name === "powershell.exe" ? appxPath : "",
    cacheDirectory: "C:\\Users\\test\\PuruPuru\\bin",
    cacheBinary: (source, directory) => {
      copied = { source, directory };
      return `${directory}\\codex.exe`;
    },
  });
  assert.equal(command, "C:\\Users\\test\\PuruPuru\\bin\\codex.exe");
  assert.deepEqual(copied, { source: appxPath, directory: "C:\\Users\\test\\PuruPuru\\bin" });
});
