// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveCodexCommand, resolveWslCodexCommand, windowsPathToWsl } = require("../lib/codex-command.cjs");

test("Windows work folders and the bundled WSL Codex binary map to Linux paths", () => {
  assert.equal(windowsPathToWsl("C:\\Users\\test\\Downloads\\project"), "/mnt/c/Users/test/Downloads/project");
  const root = "C:\\Users\\test\\.codex\\bin\\wsl";
  const command = resolveWslCodexCommand({
    platform: "win32",
    env: { USERPROFILE: "C:\\Users\\test" },
    readDirectory: (directory) => {
      assert.equal(directory, root);
      return [{ name: "build-1", isDirectory: () => true }];
    },
    exists: (candidate) => candidate === `${root}\\build-1\\codex`,
    stat: () => ({ mtimeMs: 1 }),
  });
  assert.equal(command, "/mnt/c/Users/test/.codex/bin/wsl/build-1/codex");
});

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
