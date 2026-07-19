// SPDX-License-Identifier: Apache-2.0

/**
 * PuruPuru character layers are opaque illustrations on transparency. Image
 * generators occasionally return a faint, non-zero matte over the whole
 * canvas; Electron then composites that matte as a dark rectangle. Remove the
 * low-alpha matte and preserve a short antialiasing ramp at the character edge.
 */
function cleanAvatarAlpha(png, transparentCutoff = 127) {
  const cutoff = Math.max(0, Math.min(254, Math.round(Number(transparentCutoff) || 0)));
  let cleared = 0;
  let remapped = 0;

  for (let index = 0; index < png.data.length; index += 4) {
    const alpha = png.data[index + 3];
    if (alpha <= cutoff) {
      if (alpha !== 0) cleared += 1;
      png.data[index] = 0;
      png.data[index + 1] = 0;
      png.data[index + 2] = 0;
      png.data[index + 3] = 0;
      continue;
    }
    if (alpha < 255) {
      png.data[index + 3] = Math.round(((alpha - cutoff) / (255 - cutoff)) * 255);
      remapped += 1;
    }
  }

  return { cleared, remapped, transparentCutoff: cutoff };
}

function despillAvatarEdges(png, radius = 3) {
  const width = png.width;
  const height = png.height;
  const sourceAlpha = Buffer.alloc(width * height);
  for (let pixel = 0; pixel < sourceAlpha.length; pixel += 1) sourceAlpha[pixel] = png.data[pixel * 4 + 3];
  let corrected = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!sourceAlpha[pixel]) continue;
      const index = pixel * 4;
      const red = png.data[index];
      const green = png.data[index + 1];
      const blue = png.data[index + 2];
      const anchor = Math.max(red, blue);
      if (green - anchor < 16 || green < anchor * 1.35) continue;

      let bordersTransparency = false;
      for (let dy = -radius; dy <= radius && !bordersTransparency; dy += 1) {
        const nearY = y + dy;
        if (nearY < 0 || nearY >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nearX = x + dx;
          if (nearX < 0 || nearX >= width) continue;
          if (sourceAlpha[nearY * width + nearX] === 0) {
            bordersTransparency = true;
            break;
          }
        }
      }
      if (!bordersTransparency) continue;

      png.data[index + 1] = Math.min(green, anchor + 4);
      corrected += 1;
    }
  }
  return { corrected, radius };
}

module.exports = { cleanAvatarAlpha, despillAvatarEdges };
