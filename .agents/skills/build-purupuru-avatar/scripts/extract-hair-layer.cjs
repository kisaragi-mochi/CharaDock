#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const { isChromaGreen } = require("./validate-output.cjs");

function argumentsByName(values) {
  const result = {};
  for (let index = 2; index < values.length; index += 2) {
    const key = String(values[index] || "").replace(/^--/, "");
    if (key) result[key] = values[index + 1];
  }
  return result;
}

function readNormalized(filePath) {
  const png = PNG.sync.read(fs.readFileSync(path.resolve(filePath)));
  for (let index = 0; index < png.data.length; index += 4) {
    const red = png.data[index];
    const green = png.data[index + 1];
    const blue = png.data[index + 2];
    if (png.data[index + 3] <= 8 || isChromaGreen(red, green, blue)) {
      png.data[index] = 0;
      png.data[index + 1] = 0;
      png.data[index + 2] = 0;
      png.data[index + 3] = 0;
    }
  }
  return png;
}

function point(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) throw new Error(`${label} must contain two coordinates`);
  return { x: Number(value[0]), y: Number(value[1]) };
}

function colorDifference(left, right, index) {
  return Math.abs(left.data[index] - right.data[index])
    + Math.abs(left.data[index + 1] - right.data[index + 1])
    + Math.abs(left.data[index + 2] - right.data[index + 2])
    + Math.abs(left.data[index + 3] - right.data[index + 3]);
}

function main() {
  const args = argumentsByName(process.argv);
  for (const key of ["full", "base", "metadata", "output"]) if (!args[key]) throw new Error(`missing --${key}`);
  const full = readNormalized(args.full);
  const base = readNormalized(args.base);
  if (full.width !== base.width || full.height !== base.height) throw new Error("full and hairless base images must have exactly the same canvas size");
  const metadata = JSON.parse(fs.readFileSync(path.resolve(args.metadata), "utf8"));
  const face = point(metadata.rig?.faceCenter, "rig.faceCenter");
  const neck = point(metadata.rig?.neckPivot, "rig.neckPivot");
  const eyes = (metadata.rig?.eyeCenters || []).map((value, index) => point(value, `rig.eyeCenters[${index}]`));
  if (eyes.length !== 2) throw new Error("rig.eyeCenters must contain exactly two points");
  const eyeDistance = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < full.width * .04) throw new Error("rig eye distance is implausible");
  const averageEyeY = (eyes[0].y + eyes[1].y) / 2;
  const left = Math.max(0, Math.floor(face.x - eyeDistance * 3.1));
  const right = Math.min(full.width - 1, Math.ceil(face.x + eyeDistance * 3.1));
  const top = Math.max(0, Math.floor(face.y - eyeDistance * 2.8));
  const bottom = Math.min(full.height - 1, Math.ceil(neck.y + eyeDistance * .65));
  const initial = new Uint8Array(full.width * full.height);
  let changed = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      // Bangs may cross the eyes, while the central lower face must never become
      // part of the movable hair layer. Long side locks remain permitted.
      if (y > averageEyeY + eyeDistance * .42 && Math.abs(x - face.x) < eyeDistance * .78) continue;
      const pixel = y * full.width + x;
      const index = pixel * 4;
      if (full.data[index + 3] <= 16 || colorDifference(full, base, index) < 72) continue;
      initial[pixel] = 1;
      changed += 1;
    }
  }
  const total = full.width * full.height;
  if (changed / total < .0035) throw new Error("too little hair changed between canonical-full and canonical-base; remove a conservative but visible movable hair section");
  if (changed / total > .32) throw new Error("canonical-base changed too much of canonical-full; edit only the selected movable hair");

  // Include two pixels around the changed region to preserve antialiased edges,
  // but copy only pixels from the intact canonical reference.
  const expanded = new Uint8Array(initial);
  for (let y = Math.max(0, top - 2); y <= Math.min(full.height - 1, bottom + 2); y += 1) {
    for (let x = Math.max(0, left - 2); x <= Math.min(full.width - 1, right + 2); x += 1) {
      const pixel = y * full.width + x;
      if (initial[pixel]) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < full.width && ny >= 0 && ny < full.height && initial[ny * full.width + nx]) { near = true; break; }
        }
      }
      if (near && full.data[pixel * 4 + 3] > 16) expanded[pixel] = 1;
    }
  }

  const output = new PNG({ width: full.width, height: full.height });
  let visible = 0;
  for (let pixel = 0; pixel < expanded.length; pixel += 1) {
    if (!expanded[pixel]) continue;
    const index = pixel * 4;
    full.data.copy(output.data, index, index, index + 4);
    visible += 1;
  }
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(path.resolve(args.output), PNG.sync.write(output));
  process.stdout.write(`${JSON.stringify({ ok: true, output: path.resolve(args.output), coverage: visible / total })}\n`);
}

try { main(); } catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
