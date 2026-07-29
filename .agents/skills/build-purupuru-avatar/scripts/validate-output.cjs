#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const EXPRESSION_NAMES = Object.freeze([
  "eyes-open-mouth-closed.png",
  "eyes-open-mouth-half.png",
  "eyes-open-mouth-open.png",
  "eyes-closed-mouth-closed.png",
  "eyes-closed-mouth-half.png",
  "eyes-closed-mouth-open.png",
]);
const HAIR_NAME = "front-hair.png";
const ALL_IMAGE_NAMES = Object.freeze([...EXPRESSION_NAMES, HAIR_NAME]);

function isChromaGreen(red, green, blue) {
  return green >= 150 && green > red * 1.38 && green > blue * 1.38 && green - Math.max(red, blue) >= 55;
}

function effectivePixel(png, index) {
  const red = png.data[index];
  const green = png.data[index + 1];
  const blue = png.data[index + 2];
  const alpha = png.data[index + 3];
  if (alpha <= 8 || isChromaGreen(red, green, blue)) return [0, 0, 0, 0];
  return [red, green, blue, alpha];
}

function readPng(filePath) {
  const bytes = fs.readFileSync(filePath);
  const png = PNG.sync.read(bytes);
  return { bytes, png, hash: crypto.createHash("sha256").update(bytes).digest("hex") };
}

function point(value, label, width, height, errors) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger)) {
    errors.push(`${label} must be two integer pixel coordinates`);
    return null;
  }
  if (value[0] < 0 || value[0] >= width || value[1] < 0 || value[1] >= height) {
    errors.push(`${label} is outside the ${width}x${height} canvas`);
    return null;
  }
  return { x: value[0], y: value[1] };
}

function visibilityStats(png) {
  const total = png.width * png.height;
  const cornerWidth = Math.max(8, Math.floor(png.width * .08));
  const cornerHeight = Math.max(8, Math.floor(png.height * .08));
  let visible = 0;
  let cornerVisible = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      if (effectivePixel(png, index)[3] <= 16) continue;
      visible += 1;
      if ((x < cornerWidth || x >= png.width - cornerWidth)
        && (y < cornerHeight || y >= png.height - cornerHeight)) cornerVisible += 1;
    }
  }
  return {
    coverage: visible / total,
    cornerCoverage: cornerVisible / (cornerWidth * cornerHeight * 4),
  };
}

function ellipseContains(x, y, region) {
  return (((x - region.x) / region.rx) ** 2) + (((y - region.y) / region.ry) ** 2) <= 1;
}

function differenceMetrics(left, right, regions = []) {
  let changed = 0;
  let totalEnergy = 0;
  let regionEnergy = 0;
  for (let y = 0; y < left.height; y += 1) {
    for (let x = 0; x < left.width; x += 1) {
      const index = (y * left.width + x) * 4;
      const a = effectivePixel(left, index);
      const b = effectivePixel(right, index);
      const energy = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs(a[3] - b[3]);
      if (energy > 48) changed += 1;
      totalEnergy += energy;
      if (regions.some((region) => ellipseContains(x, y, region))) regionEnergy += energy;
    }
  }
  return {
    changedFraction: changed / (left.width * left.height),
    localizedEnergy: totalEnergy > 0 ? regionEnergy / totalEnergy : 0,
  };
}

function compositePixel(bottom, top, index) {
  const lower = effectivePixel(bottom, index);
  const upper = effectivePixel(top, index);
  const topAlpha = upper[3] / 255;
  const bottomAlpha = lower[3] / 255;
  const outputAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
  if (outputAlpha <= 0) return [0, 0, 0, 0];
  return [
    Math.round(((upper[0] * topAlpha) + (lower[0] * bottomAlpha * (1 - topAlpha))) / outputAlpha),
    Math.round(((upper[1] * topAlpha) + (lower[1] * bottomAlpha * (1 - topAlpha))) / outputAlpha),
    Math.round(((upper[2] * topAlpha) + (lower[2] * bottomAlpha * (1 - topAlpha))) / outputAlpha),
    Math.round(outputAlpha * 255),
  ];
}

function writeQaPreview(directory, images) {
  if (!EXPRESSION_NAMES.every((name) => images.has(name)) || !images.has(HAIR_NAME)) return "";
  const sourceWidth = images.get(EXPRESSION_NAMES[0]).png.width;
  const sourceHeight = images.get(EXPRESSION_NAMES[0]).png.height;
  const tileWidth = Math.min(320, sourceWidth);
  const tileHeight = Math.max(1, Math.round(sourceHeight * (tileWidth / sourceWidth)));
  const preview = new PNG({ width: tileWidth * 3, height: tileHeight * 2 });
  const hair = images.get(HAIR_NAME).png;
  for (let tile = 0; tile < EXPRESSION_NAMES.length; tile += 1) {
    const base = images.get(EXPRESSION_NAMES[tile]).png;
    const offsetX = (tile % 3) * tileWidth;
    const offsetY = Math.floor(tile / 3) * tileHeight;
    for (let y = 0; y < tileHeight; y += 1) {
      const sourceY = Math.min(sourceHeight - 1, Math.floor(y * sourceHeight / tileHeight));
      for (let x = 0; x < tileWidth; x += 1) {
        const sourceX = Math.min(sourceWidth - 1, Math.floor(x * sourceWidth / tileWidth));
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
        const targetIndex = ((offsetY + y) * preview.width + offsetX + x) * 4;
        const checker = ((Math.floor(x / 12) + Math.floor(y / 12)) % 2) ? 226 : 246;
        const composited = compositePixel(base, hair, sourceIndex);
        const alpha = composited[3] / 255;
        preview.data[targetIndex] = Math.round(composited[0] * alpha + checker * (1 - alpha));
        preview.data[targetIndex + 1] = Math.round(composited[1] * alpha + checker * (1 - alpha));
        preview.data[targetIndex + 2] = Math.round(composited[2] * alpha + checker * (1 - alpha));
        preview.data[targetIndex + 3] = 255;
      }
    }
  }
  const previewPath = path.join(directory, "qa-preview.png");
  fs.writeFileSync(previewPath, PNG.sync.write(preview));
  return previewPath;
}

function validateAvatarOutput(directory, { writePreview = false } = {}) {
  const root = path.resolve(directory || "output");
  const errors = [];
  const images = new Map();
  let expectedSize = null;
  for (const name of ALL_IMAGE_NAMES) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) {
      errors.push(`missing ${name}`);
      continue;
    }
    try {
      const image = readPng(filePath);
      const { width, height } = image.png;
      if (width < 512 || height < 512 || width > 4096 || height > 4096) errors.push(`${name} has unsupported size ${width}x${height}`);
      if (expectedSize && (width !== expectedSize.width || height !== expectedSize.height)) errors.push(`${name} size differs from other images`);
      expectedSize ||= { width, height };
      image.visibility = visibilityStats(image.png);
      images.set(name, image);
    } catch (error) {
      errors.push(`${name} is not a readable PNG: ${error.message}`);
    }
  }

  let character = null;
  try {
    character = JSON.parse(fs.readFileSync(path.join(root, "character.json"), "utf8"));
    if (character.schemaVersion !== 1) errors.push("character.json schemaVersion must be 1");
    if (!String(character.name || "").trim()) errors.push("character name is empty");
    if (!String(character.personality || "").trim()) errors.push("character personality is empty");
    if (!Array.isArray(character.petPhrases) || character.petPhrases.length < 3) errors.push("petPhrases must contain at least 3 entries");
    else if (new Set(character.petPhrases.map((value) => String(value || "").trim()).filter(Boolean)).size < 3) errors.push("petPhrases must contain 3 distinct non-empty entries");
  } catch (error) {
    errors.push(`invalid character.json: ${error.message}`);
  }

  let rig = null;
  if (character && expectedSize) {
    const { width, height } = expectedSize;
    const faceCenter = point(character.rig?.faceCenter, "rig.faceCenter", width, height, errors);
    const mouthCenter = point(character.rig?.mouthCenter, "rig.mouthCenter", width, height, errors);
    const chin = point(character.rig?.chin, "rig.chin", width, height, errors);
    const neckPivot = point(character.rig?.neckPivot, "rig.neckPivot", width, height, errors);
    const eyeValues = character.rig?.eyeCenters;
    if (!Array.isArray(eyeValues) || eyeValues.length !== 2) errors.push("rig.eyeCenters must contain exactly 2 points");
    const eyes = Array.isArray(eyeValues) ? eyeValues.slice(0, 2).map((value, index) => point(value, `rig.eyeCenters[${index}]`, width, height, errors)) : [];
    if (faceCenter && mouthCenter && chin && neckPivot && eyes.length === 2 && eyes.every(Boolean)) {
      const eyeDistance = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);
      const averageEyeY = (eyes[0].y + eyes[1].y) / 2;
      if (eyeDistance < width * .04 || eyeDistance > width * .55) errors.push("rig eye distance is implausible");
      if (!(averageEyeY < mouthCenter.y && mouthCenter.y < chin.y && chin.y <= neckPivot.y + height * .08)) errors.push("rig vertical order must be eyes, mouth, chin, then neck");
      rig = { faceCenter, mouthCenter, chin, neckPivot, eyes, eyeDistance };
    }
  }

  if (images.size === ALL_IMAGE_NAMES.length) {
    for (const name of EXPRESSION_NAMES) {
      const { coverage, cornerCoverage } = images.get(name).visibility;
      if (coverage < .08) errors.push(`${name} contains too little visible character artwork`);
      if (coverage > .9 || cornerCoverage > .8) errors.push(`${name} has an opaque/baked background; real alpha or flat #00FF00 is required`);
    }
    const hairVisibility = images.get(HAIR_NAME).visibility;
    if (hairVisibility.coverage < .005) errors.push(`${HAIR_NAME} is empty; generate the movable hair layer or explicitly repair it`);
    if (hairVisibility.coverage > .58 || hairVisibility.cornerCoverage > .5) errors.push(`${HAIR_NAME} contains a background or too much non-hair artwork`);

    const expressionHashes = EXPRESSION_NAMES.map((name) => images.get(name).hash);
    if (new Set(expressionHashes).size !== expressionHashes.length) errors.push("the 6 expression PNGs must be distinct; copying one image into every filename is forbidden");

    if (rig) {
      const eyeRegions = rig.eyes.map((eye) => ({ x: eye.x, y: eye.y, rx: rig.eyeDistance * .52, ry: rig.eyeDistance * .38 }));
      const mouthRegions = [{ x: rig.mouthCenter.x, y: rig.mouthCenter.y, rx: rig.eyeDistance * .62, ry: rig.eyeDistance * .42 }];
      const compare = (leftName, rightName, regions, label, minimumChanged) => {
        const metrics = differenceMetrics(images.get(leftName).png, images.get(rightName).png, regions);
        if (metrics.changedFraction < minimumChanged) errors.push(`${label} is visually unchanged (${leftName} vs ${rightName})`);
        if (metrics.changedFraction > .12) errors.push(`${label} changes too much of the character; keep edits localized and pixel-registered`);
        if (metrics.localizedEnergy < .35) errors.push(`${label} changes are not concentrated around the declared rig location`);
      };
      compare(EXPRESSION_NAMES[0], EXPRESSION_NAMES[1], mouthRegions, "half-mouth difference", .00012);
      compare(EXPRESSION_NAMES[0], EXPRESSION_NAMES[2], mouthRegions, "open-mouth difference", .0002);
      compare(EXPRESSION_NAMES[0], EXPRESSION_NAMES[3], eyeRegions, "closed-eye difference", .00035);
      compare(EXPRESSION_NAMES[3], EXPRESSION_NAMES[4], mouthRegions, "closed-eye half-mouth difference", .00012);
      compare(EXPRESSION_NAMES[3], EXPRESSION_NAMES[5], mouthRegions, "closed-eye open-mouth difference", .0002);
    }
  }

  let previewPath = "";
  if (writePreview) {
    try { previewPath = writeQaPreview(root, images); } catch (error) { errors.push(`could not create QA preview: ${error.message}`); }
  }
  const report = {
    ok: errors.length === 0,
    directory: root,
    size: expectedSize ? [expectedSize.width, expectedSize.height] : null,
    files: images.size + (character ? 1 : 0),
    previewPath,
    errors,
  };
  if (errors.length) {
    const error = new Error(`Avatar quality validation failed:\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    error.report = report;
    throw error;
  }
  return report;
}

module.exports = { ALL_IMAGE_NAMES, EXPRESSION_NAMES, isChromaGreen, validateAvatarOutput, writeQaPreview };

if (require.main === module) {
  try {
    const report = validateAvatarOutput(process.argv[2] || "output", { writePreview: true });
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
