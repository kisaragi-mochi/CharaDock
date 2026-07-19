#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const { cleanAvatarAlpha, despillAvatarEdges } = require("../desktop/lib/png-alpha.cjs");

const directories = process.argv.slice(2);
if (!directories.length) {
  console.error("Usage: node scripts/clean_avatar_alpha.cjs <avatar-directory> [...]");
  process.exit(2);
}

let fileCount = 0;
let cleared = 0;
let remapped = 0;
let despilled = 0;
for (const directory of directories) {
  const resolved = path.resolve(directory);
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".png") continue;
    const filePath = path.join(resolved, entry.name);
    const png = PNG.sync.read(fs.readFileSync(filePath));
    const result = cleanAvatarAlpha(png);
    const despill = despillAvatarEdges(png);
    fs.writeFileSync(filePath, PNG.sync.write(png));
    fileCount += 1;
    cleared += result.cleared;
    remapped += result.remapped;
    despilled += despill.corrected;
  }
}

console.log(`Cleaned ${fileCount} PNG files (${cleared} matte pixels removed, ${remapped} edge pixels remapped, ${despilled} edge pixels despilled).`);
