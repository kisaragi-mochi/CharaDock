// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");

const PATH_FIELD = /^(?:path|file|filePath|filename)$/i;
const FILE_TOKEN = /(?:^|[\s(「『【])([\w.@+-]+(?:[\\/][\w.@+()\[\] -]+)*\.[A-Za-z0-9]{1,12}|[\w.@+-]+(?:[\\/][\w.@+()\[\] -]+)+[\\/]?)(?=$|[\s)、。！？」』】,:;])/gu;

function fileChangeCandidates(item) {
  const output = [];
  const visit = (value, key = "", depth = 0) => {
    if (depth > 6 || value == null) return;
    if (typeof value === "string") {
      if (PATH_FIELD.test(key)) output.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, key, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const [childKey, entry] of Object.entries(value)) visit(entry, childKey, depth + 1);
    }
  };
  visit(item);
  return output;
}

function textPathCandidates(value) {
  const text = String(value || "");
  const candidates = [];
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) candidates.push(match[1]);
  for (const match of text.matchAll(/`([^`\r\n]+)`/g)) candidates.push(match[1]);
  for (const match of text.matchAll(FILE_TOKEN)) candidates.push(match[1]);
  return candidates;
}

function cleanCandidate(value) {
  return String(value || "")
    .trim()
    .replace(/^file:\/\//i, "")
    .replace(/^<|>$/g, "")
    .replace(/["']+$/g, "")
    .replace(/:(\d+)(?::\d+)?$/, "");
}

function relativeArtifactPath(workDirectory, candidate, runtimeDirectory = "") {
  const root = path.resolve(String(workDirectory || ""));
  let value = cleanCandidate(candidate);
  if (!root || !value || /[\r\n\0]/u.test(value)) return "";

  let relative = value;
  const windowsRoot = /^[A-Za-z]:[\\/]/.test(root);
  const windowsValue = /^[A-Za-z]:[\\/]/.test(value);
  if (windowsRoot && windowsValue) relative = path.win32.relative(root, value);
  else if (path.isAbsolute(value)) {
    const runtimeRoot = String(runtimeDirectory || "");
    if (runtimeRoot && path.posix.isAbsolute(value) && path.posix.isAbsolute(runtimeRoot)) {
      relative = path.posix.relative(runtimeRoot, value);
    } else relative = path.relative(root, value);
  }
  relative = relative.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!relative || relative === "." || relative === ".." || relative.startsWith("../") || path.posix.isAbsolute(relative)) return "";
  const target = path.resolve(root, ...relative.split("/"));
  const rootPrefix = `${root}${path.sep}`;
  const comparableTarget = process.platform === "win32" ? target.toLowerCase() : target;
  const comparableRoot = process.platform === "win32" ? rootPrefix.toLowerCase() : rootPrefix;
  if (!comparableTarget.startsWith(comparableRoot) || !fs.existsSync(target)) return "";
  return relative;
}

function isArtifactInsideWorkspace(workDirectory, targetPath) {
  try {
    const realRoot = fs.realpathSync(path.resolve(workDirectory));
    const realTarget = fs.realpathSync(path.resolve(targetPath));
    const prefix = `${realRoot}${path.sep}`;
    const target = process.platform === "win32" ? realTarget.toLowerCase() : realTarget;
    const root = process.platform === "win32" ? prefix.toLowerCase() : prefix;
    return target.startsWith(root);
  } catch {
    return false;
  }
}

function discoverWorkArtifacts(workDirectory, { eventCandidates = [], resultText = "", runtimeDirectory = "", limit = 8 } = {}) {
  // Paths the assistant chose to mention are usually the most useful outputs;
  // fill remaining slots with files observed in file-change events.
  const candidates = [...textPathCandidates(resultText), ...eventCandidates];
  const seen = new Set();
  const artifacts = [];
  for (const candidate of candidates) {
    const relativePath = relativeArtifactPath(workDirectory, candidate, runtimeDirectory);
    if (!relativePath || seen.has(relativePath)) continue;
    const target = path.resolve(workDirectory, ...relativePath.split("/"));
    if (!isArtifactInsideWorkspace(workDirectory, target)) continue;
    let stat;
    try { stat = fs.statSync(target); } catch { continue; }
    if (!stat.isFile() && !stat.isDirectory()) continue;
    seen.add(relativePath);
    artifacts.push({
      path: relativePath,
      name: path.basename(target),
      kind: stat.isDirectory() ? "directory" : "file",
    });
    if (artifacts.length >= Math.max(1, Math.min(12, Number(limit) || 8))) break;
  }
  return artifacts;
}

module.exports = { discoverWorkArtifacts, fileChangeCandidates, isArtifactInsideWorkspace, relativeArtifactPath, textPathCandidates };
