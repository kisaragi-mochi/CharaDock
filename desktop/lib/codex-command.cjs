// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

function run(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true, timeout: 8_000 }, (error, stdout) => {
      resolve(error ? "" : String(stdout || "").trim());
    });
  });
}

function cacheAppxBinary(source, cacheDirectory) {
  fs.mkdirSync(cacheDirectory, { recursive: true });
  const destination = path.join(cacheDirectory, "codex.exe");
  const sourceStat = fs.statSync(source);
  let current = null;
  try { current = fs.statSync(destination); } catch {}
  if (!current || current.size !== sourceStat.size || current.mtimeMs < sourceStat.mtimeMs) {
    fs.copyFileSync(source, destination);
  }
  return destination;
}

async function resolveCodexCommand({
  platform = process.platform,
  env = process.env,
  runCommand = run,
  exists = fs.existsSync,
  cacheDirectory = "",
  cacheBinary = cacheAppxBinary,
} = {}) {
  if (env.CODEX_CLI_PATH) return env.CODEX_CLI_PATH;
  if (platform !== "win32") return "codex";

  const whereResult = await runCommand("where.exe", ["codex"]);
  const whereCandidate = whereResult.split(/\r?\n/).find((candidate) => candidate && exists(candidate));
  if (whereCandidate) return whereCandidate;

  const localCandidates = [
    env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, "Programs", "Codex", "resources", "codex.exe"),
    env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, "Codex", "resources", "codex.exe"),
  ].filter(Boolean);
  for (const candidate of localCandidates) {
    if (exists(candidate)) return candidate;
  }

  const script = [
    "$package = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1;",
    "if ($package) {",
    "$candidate = Join-Path $package.InstallLocation 'app\\resources\\codex.exe';",
    "if (Test-Path -LiteralPath $candidate) { [Console]::Out.Write($candidate) }",
    "}",
  ].join(" ");
  const appxCandidate = await runCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  if (appxCandidate && exists(appxCandidate)) {
    return cacheDirectory ? cacheBinary(appxCandidate, cacheDirectory) : appxCandidate;
  }
  return "codex";
}

module.exports = { cacheAppxBinary, resolveCodexCommand };
