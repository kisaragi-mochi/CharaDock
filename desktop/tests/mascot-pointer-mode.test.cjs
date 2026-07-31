// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  mascotRecoveryRect,
  normalizeMascotPointerMode,
  shouldAutoHideMascot,
} = require("../lib/mascot-pointer-mode.cjs");

test("pointer modes normalize to the three supported states", () => {
  assert.equal(normalizeMascotPointerMode("interactive"), "interactive");
  assert.equal(normalizeMascotPointerMode("auto-hide"), "auto-hide");
  assert.equal(normalizeMascotPointerMode("click-through"), "click-through");
  assert.equal(normalizeMascotPointerMode("unknown"), "interactive");
});

test("auto-hide keeps the bottom-right chat recovery area interactive", () => {
  const bounds = { x: 100, y: 100, width: 600, height: 800 };
  assert.equal(shouldAutoHideMascot({ cursor: { x: 310, y: 400 }, bounds }), true);
  const recovery = mascotRecoveryRect(bounds);
  assert.equal(shouldAutoHideMascot({
    cursor: { x: recovery.x + 10, y: recovery.y + 10 },
    bounds,
    currentlyHidden: true,
  }), false);
  assert.equal(shouldAutoHideMascot({ cursor: { x: 20, y: 20 }, bounds, currentlyHidden: true }), false);
});

test("auto-hide uses a wider exit boundary to prevent edge flicker", () => {
  const bounds = { x: 100, y: 100, width: 600, height: 800 };
  const cursor = { x: 70, y: 300 };
  assert.equal(shouldAutoHideMascot({ cursor, bounds, currentlyHidden: false }), false);
  assert.equal(shouldAutoHideMascot({ cursor, bounds, currentlyHidden: true }), true);
});

test("auto-hide can target the visible character instead of blank window space", () => {
  const bounds = { x: 100, y: 100, width: 600, height: 800 };
  const proximityBounds = { x: 100, y: 160, width: 360, height: 620 };
  assert.equal(shouldAutoHideMascot({ cursor: { x: 520, y: 300 }, bounds, proximityBounds }), false);
  assert.equal(shouldAutoHideMascot({ cursor: { x: 300, y: 300 }, bounds, proximityBounds }), true);
});
