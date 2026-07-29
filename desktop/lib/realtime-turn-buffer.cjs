// SPDX-License-Identifier: Apache-2.0

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 12_000);
}

class RealtimeTurnBuffer {
  constructor() {
    this.pendingUsers = [];
    this.pendingAssistants = [];
    this.pendingTyped = [];
    this.consumedTyped = [];
  }

  addTyped(text) {
    const normalized = normalizedText(text);
    if (!normalized) return;
    // appendSpeech can emit its user transcript before its request promise
    // resolves. In that ordering addUser already queued the same turn.
    if (this.pendingUsers.includes(normalized)) return;
    this.pendingTyped.push(normalized);
  }

  addUser(text) {
    const normalized = normalizedText(text);
    if (!normalized) return null;
    const cutoff = Date.now() - 15_000;
    this.consumedTyped = this.consumedTyped.filter((entry) => entry.createdAt >= cutoff);
    const consumedIndex = this.consumedTyped.findIndex((entry) => entry.text === normalized);
    if (consumedIndex >= 0) {
      this.consumedTyped.splice(consumedIndex, 1);
      return null;
    }
    const typedIndex = this.pendingTyped.indexOf(normalized);
    if (typedIndex >= 0) this.pendingTyped.splice(typedIndex, 1);
    if (this.pendingAssistants.length) return { user: normalized, assistant: this.pendingAssistants.shift() };
    this.pendingUsers.push(normalized);
    return null;
  }

  addAssistant(text) {
    const normalized = normalizedText(text);
    if (!normalized) return null;
    let user = this.pendingUsers.shift();
    if (!user && this.pendingTyped.length) {
      user = this.pendingTyped.shift();
      this.consumedTyped.push({ text: user, createdAt: Date.now() });
      this.consumedTyped = this.consumedTyped.slice(-8);
    }
    if (user) return { user, assistant: normalized };
    this.pendingAssistants.push(normalized);
    return null;
  }

  clear() {
    this.pendingUsers.length = 0;
    this.pendingAssistants.length = 0;
    this.pendingTyped.length = 0;
    this.consumedTyped.length = 0;
  }
}

module.exports = { RealtimeTurnBuffer, normalizedText };
