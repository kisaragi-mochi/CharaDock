// SPDX-License-Identifier: Apache-2.0

const POINTER_MODES = Object.freeze(["interactive", "auto-hide", "click-through"]);

function normalizeMascotPointerMode(value, fallback = "interactive") {
  return POINTER_MODES.includes(value) ? value : POINTER_MODES.includes(fallback) ? fallback : "interactive";
}

function pointInRect(point, rect) {
  return Boolean(point && rect
    && point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height);
}

function expandedRect(bounds, margin) {
  const amount = Math.max(0, Number(margin) || 0);
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

function mascotRecoveryRect(bounds) {
  return {
    x: bounds.x + bounds.width * .52,
    y: bounds.y + bounds.height * .76,
    width: bounds.width * .48,
    height: bounds.height * .24,
  };
}

function shouldAutoHideMascot({ cursor, bounds, proximityBounds = bounds, currentlyHidden = false }) {
  if (!bounds || !cursor) return false;
  if (pointInRect(cursor, mascotRecoveryRect(bounds))) return false;
  // A wider exit boundary prevents rapid hide/show oscillation at the edge.
  return pointInRect(cursor, expandedRect(proximityBounds, currentlyHidden ? 54 : 18));
}

module.exports = {
  POINTER_MODES,
  expandedRect,
  mascotRecoveryRect,
  normalizeMascotPointerMode,
  pointInRect,
  shouldAutoHideMascot,
};
