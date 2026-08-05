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

function windowsPathToWsl(value) {
  const normalized = String(value || "");
  const match = normalized.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (!match) return normalized.replace(/\\/g, "/");
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, "/")}`;
}

function npmCodexBinaryCandidates(commandPath, arch = process.arch) {
  const directory = path.win32.dirname(String(commandPath || ""));
  const platformPackage = arch === "arm64" ? "codex-win32-arm64" : "codex-win32-x64";
  const target = arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
  const packageRoots = [
    path.win32.join(directory, "node_modules", "@openai", "codex", "node_modules", "@openai", platformPackage),
    path.win32.join(directory, "node_modules", "@openai", platformPackage),
  ];
  const relativeBinaries = [
    path.win32.join("vendor", target, "bin", "codex.exe"),
    path.win32.join("vendor", target, "codex", "codex.exe"),
  ];
  return packageRoots.flatMap((root) => relativeBinaries.map((relative) => path.win32.join(root, relative)));
}

function resolveNpmCodexBinary(commandPath, { arch = process.arch, exists = fs.existsSync } = {}) {
  return npmCodexBinaryCandidates(commandPath, arch).find((candidate) => exists(candidate)) || "";
}

function isWindowsExecutable(candidate) {
  return path.win32.extname(String(candidate || "")).toLowerCase() === ".exe";
}

function macCodexCandidates(env = process.env) {
  const home = String(env.HOME || "");
  return [
    "/Applications/Codex.app/Contents/Resources/codex",
    home && path.posix.join(home, "Applications", "Codex.app", "Contents", "Resources", "codex"),
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
    home && path.posix.join(home, ".local", "bin", "codex"),
    home && path.posix.join(home, ".npm-global", "bin", "codex"),
    home && path.posix.join(home, "Library", "pnpm", "codex"),
  ].filter(Boolean);
}

function resolveWslCodexCommand({
  platform = process.platform,
  env = process.env,
  exists = fs.existsSync,
  readDirectory = fs.readdirSync,
  stat = fs.statSync,
} = {}) {
  if (platform !== "win32") return "";
  if (env.CODEX_WSL_CLI_PATH && exists(env.CODEX_WSL_CLI_PATH)) return windowsPathToWsl(env.CODEX_WSL_CLI_PATH);
  const profile = env.USERPROFILE || "";
  if (!profile) return "";
  const root = path.win32.join(profile, ".codex", "bin", "wsl");
  let entries;
  try { entries = readDirectory(root, { withFileTypes: true }); } catch { return ""; }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.win32.join(root, entry.name, "codex"))
    .filter((candidate) => exists(candidate))
    .sort((left, right) => {
      try { return stat(right).mtimeMs - stat(left).mtimeMs; } catch { return 0; }
    })
    .map(windowsPathToWsl)[0] || "";
}

async function resolveCodexCommand({
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  runCommand = run,
  exists = fs.existsSync,
  cacheDirectory = "",
  cacheBinary = cacheAppxBinary,
} = {}) {
  if (env.CODEX_CLI_PATH) {
    if (platform !== "win32" && exists(env.CODEX_CLI_PATH)) return env.CODEX_CLI_PATH;
    if (isWindowsExecutable(env.CODEX_CLI_PATH) && exists(env.CODEX_CLI_PATH)) return env.CODEX_CLI_PATH;
    const explicitNpmBinary = resolveNpmCodexBinary(env.CODEX_CLI_PATH, { arch, exists });
    if (explicitNpmBinary) return explicitNpmBinary;
  }
  if (platform === "darwin") {
    const pathCandidate = String(await runCommand("/usr/bin/which", ["codex"]) || "").split(/\r?\n/)[0].trim();
    if (pathCandidate && exists(pathCandidate)) return pathCandidate;
    return macCodexCandidates(env).find((candidate) => exists(candidate)) || "";
  }
  if (platform !== "win32") return "codex";

  const whereResult = await runCommand("where.exe", ["codex"]);
  const whereCandidates = whereResult.split(/\r?\n/).map((candidate) => candidate.trim()).filter(Boolean);
  for (const candidate of whereCandidates) {
    if (!exists(candidate)) continue;
    if (isWindowsExecutable(candidate)) return candidate;
    const npmBinary = resolveNpmCodexBinary(candidate, { arch, exists });
    if (npmBinary) return npmBinary;
  }

  const npmShims = env.APPDATA
    ? ["codex.cmd", "codex.ps1", "codex"].map((name) => path.win32.join(env.APPDATA, "npm", name))
    : [];
  for (const candidate of npmShims) {
    if (!exists(candidate)) continue;
    const npmBinary = resolveNpmCodexBinary(candidate, { arch, exists });
    if (npmBinary) return npmBinary;
  }

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
    if (!cacheDirectory) return appxCandidate;
    try {
      return cacheBinary(appxCandidate, cacheDirectory);
    } catch {
      return "";
    }
  }
  // Do not return the bare command on Windows. npm installs both a POSIX `codex`
  // shim and `codex.cmd`; spawning the former from Electron fails with ENOENT.
  // An empty result also lets the UI distinguish "not installed" from a launch
  // failure and show an actionable installation message.
  return "";
}

module.exports = {
  cacheAppxBinary,
  macCodexCandidates,
  npmCodexBinaryCandidates,
  resolveCodexCommand,
  resolveNpmCodexBinary,
  resolveWslCodexCommand,
  windowsPathToWsl,
};
