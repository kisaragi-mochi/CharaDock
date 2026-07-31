// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");

const MAX_LOG_BYTES = 512 * 1024;
const SENSITIVE_KEY = /(?:api.?key|authorization|password|secret|token|conversation|memory|message|prompt|request|result|personality|dictionary)/i;

function redactDiagnosticText(value, { homeDirectories = [] } = {}) {
  let text = String(value ?? "");
  for (const directory of homeDirectories.filter(Boolean).sort((a, b) => b.length - a.length)) {
    text = text.split(String(directory)).join("<USER_HOME>");
    text = text.split(String(directory).replace(/\\/g, "/")).join("<USER_HOME>");
    text = text.split(String(directory).replace(/\//g, "\\")).join("<USER_HOME>");
  }
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "<REDACTED_API_KEY>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer <REDACTED>")
    .replace(/([?&](?:api_?key|access_?token|token|password)=)[^&#\s]+/gi, "$1<REDACTED>")
    .replace(/("?(?:api.?key|authorization|password|secret|token)"?\s*[:=]\s*)["']?[^\s,"'}]+/gi, "$1<REDACTED>");
}

function sanitizeDiagnosticValue(value, options = {}, depth = 0) {
  if (depth > 8) return "<MAX_DEPTH>";
  if (value === null || ["boolean", "number"].includes(typeof value)) return value;
  if (typeof value === "string") return redactDiagnosticText(value, options).slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => sanitizeDiagnosticValue(item, options, depth + 1));
  if (!value || typeof value !== "object") return String(value ?? "");
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (SENSITIVE_KEY.test(key)) return [];
    return [[key, sanitizeDiagnosticValue(item, options, depth + 1)]];
  }));
}

class DiagnosticLog {
  constructor(directory, options = {}) {
    this.directory = path.resolve(directory);
    this.filePath = path.join(this.directory, "charadock.log");
    this.options = options;
    fs.mkdirSync(this.directory, { recursive: true });
    this.#trim();
  }

  #trim() {
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size <= MAX_LOG_BYTES) return;
      const data = fs.readFileSync(this.filePath);
      fs.writeFileSync(this.filePath, data.subarray(Math.max(0, data.length - Math.floor(MAX_LOG_BYTES * .7))));
    } catch {}
  }

  write(level, event, details = "") {
    const safeEvent = redactDiagnosticText(event, this.options).replace(/[\r\n]+/g, " ").slice(0, 160);
    const safeDetails = redactDiagnosticText(
      typeof details === "string" ? details : JSON.stringify(sanitizeDiagnosticValue(details, this.options)),
      this.options,
    ).replace(/[\r\n]+/g, " ").slice(0, 4000);
    const line = `${new Date().toISOString()} ${String(level || "info").toUpperCase()} ${safeEvent}${safeDetails ? ` · ${safeDetails}` : ""}\n`;
    try {
      fs.appendFileSync(this.filePath, line, { encoding: "utf8", mode: 0o600 });
      this.#trim();
    } catch {}
  }

  recent() {
    try {
      const data = fs.readFileSync(this.filePath);
      return redactDiagnosticText(data.subarray(Math.max(0, data.length - MAX_LOG_BYTES)).toString("utf8"), this.options);
    } catch {
      return "";
    }
  }
}

let crcTable;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[index] = value >>> 0;
    }
  }
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const timestamp = dosDateTime();
  for (const entry of entries) {
    const name = Buffer.from(String(entry.name || "file.txt").replace(/\\/g, "/"), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ""), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(timestamp.time, 10);
    local.writeUInt16LE(timestamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(timestamp.time, 12);
    central.writeUInt16LE(timestamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function diagnosticsAsText(report) {
  return JSON.stringify(report, null, 2);
}

function createSupportBundle(report, recentLog = "") {
  const readme = [
    "CharaDock support bundle",
    "",
    "This bundle intentionally excludes API keys, conversations, character memories, work content, attachments, and user dictionaries.",
    "Review diagnostics.json and charadock.log before sharing the archive.",
    "",
  ].join("\n");
  return createStoredZip([
    { name: "README.txt", data: readme },
    { name: "diagnostics.json", data: `${diagnosticsAsText(report)}\n` },
    { name: "charadock.log", data: recentLog || "No application log entries were recorded.\n" },
  ]);
}

module.exports = {
  DiagnosticLog,
  createStoredZip,
  createSupportBundle,
  diagnosticsAsText,
  redactDiagnosticText,
  sanitizeDiagnosticValue,
};
