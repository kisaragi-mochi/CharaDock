// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_MEMORIES_PER_CHARACTER,
  clearCharacterMemories,
  normalizeCharacterMemories,
  removeCharacterMemory,
  saveCharacterMemory,
  updateCharacterMemory,
} = require("../lib/character-memory.cjs");

test("character memories stay isolated and deduplicate durable facts", () => {
  const first = saveCharacterMemory({}, "amber-avatar", { category: "preference", content: "短い回答が好き" }, new Date("2026-07-29T00:00:00Z"));
  const duplicate = saveCharacterMemory(first.memoriesByCharacter, "amber-avatar", { category: "preference", content: "短い回答が好き" }, new Date("2026-07-29T01:00:00Z"));
  const other = saveCharacterMemory(duplicate.memoriesByCharacter, "towa-avatar", { category: "identity", content: "呼び名はイカイ" }, new Date("2026-07-29T02:00:00Z"));
  assert.equal(other.memoriesByCharacter["amber-avatar"].length, 1);
  assert.equal(other.memoriesByCharacter["towa-avatar"].length, 1);
  assert.equal(other.memoriesByCharacter["amber-avatar"][0].updatedAt, "2026-07-29T01:00:00.000Z");
});

test("character memory can replace an outdated fact without changing its id", () => {
  const first = saveCharacterMemory({}, "amber-avatar", { category: "preference", content: "コーヒーが好き" }, new Date("2026-07-29T00:00:00Z"));
  const updated = updateCharacterMemory(first.memoriesByCharacter, "amber-avatar", first.record.id, {
    category: "preference",
    content: "紅茶が好き",
  }, new Date("2026-07-29T01:00:00Z"));
  assert.equal(updated.record.id, first.record.id);
  assert.equal(updated.record.content, "紅茶が好き");
  assert.equal(updated.memoriesByCharacter["amber-avatar"].length, 1);
  assert.throws(() => updateCharacterMemory(updated.memoriesByCharacter, "towa-avatar", first.record.id, { content: "別の内容" }), /見つかりません/);
});

test("character memory storage is bounded and supports user deletion", () => {
  let value = {};
  for (let index = 0; index < MAX_MEMORIES_PER_CHARACTER + 3; index += 1) {
    value = saveCharacterMemory(value, "amber-avatar", { content: `好み-${index}`, category: "preference" }).memoriesByCharacter;
  }
  assert.equal(value["amber-avatar"].length, MAX_MEMORIES_PER_CHARACTER);
  assert.equal(value["amber-avatar"][0].content, "好み-3");
  const target = value["amber-avatar"][0].id;
  value = removeCharacterMemory(value, "amber-avatar", target);
  assert.equal(value["amber-avatar"].some((entry) => entry.id === target), false);
  assert.deepEqual(clearCharacterMemories(value, "amber-avatar"), {});
});

test("character memory rejects secrets, sensitive traits, and malformed records", () => {
  assert.throws(() => saveCharacterMemory({}, "amber-avatar", { content: "API key is sk-abcdefghijklmnop", category: "other" }), /保存できません/);
  assert.throws(() => saveCharacterMemory({}, "amber-avatar", { content: "住所は東京都です", category: "background" }), /保存できません/);
  assert.deepEqual(normalizeCharacterMemories({ "amber-avatar": [{ role: "user", text: "wrong shape" }] }), {});
});
