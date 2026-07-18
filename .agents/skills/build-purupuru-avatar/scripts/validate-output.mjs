#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(process.argv[2] || "output");
const pngNames = [
  "eyes-open-mouth-closed.png",
  "eyes-open-mouth-half.png",
  "eyes-open-mouth-open.png",
  "eyes-closed-mouth-closed.png",
  "eyes-closed-mouth-half.png",
  "eyes-closed-mouth-open.png",
  "front-hair.png",
];

function pngSize(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${path.basename(filePath)} is not a PNG`);
  }
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const errors = [];
let expectedSize = null;
for (const name of pngNames) {
  const filePath = path.join(directory, name);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${name}`);
    continue;
  }
  try {
    const size = pngSize(filePath);
    if (size[0] < 512 || size[1] < 512 || size[0] > 4096 || size[1] > 4096) errors.push(`${name} has unsupported size ${size.join("x")}`);
    if (expectedSize && (size[0] !== expectedSize[0] || size[1] !== expectedSize[1])) errors.push(`${name} size differs from other images`);
    expectedSize ||= size;
  } catch (error) {
    errors.push(error.message);
  }
}

try {
  const character = JSON.parse(fs.readFileSync(path.join(directory, "character.json"), "utf8"));
  if (character.schemaVersion !== 1) errors.push("character.json schemaVersion must be 1");
  if (!String(character.name || "").trim()) errors.push("character name is empty");
  if (!String(character.personality || "").trim()) errors.push("character personality is empty");
  if (!Array.isArray(character.petPhrases) || character.petPhrases.length < 3) errors.push("petPhrases must contain at least 3 entries");
  for (const key of ["faceCenter", "eyeCenters", "mouthCenter", "chin", "neckPivot"]) {
    if (!Array.isArray(character.rig?.[key])) errors.push(`rig.${key} is missing`);
  }
} catch (error) {
  errors.push(`invalid character.json: ${error.message}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, directory, size: expectedSize, files: pngNames.length + 1 }));
