import assert from "node:assert/strict";
import { WOW_CLASSES } from "../lib/constants/classes";
import { getPlayerClassMeta, normalizePlayerClass } from "../lib/player-class";

for (const className of WOW_CLASSES) {
  const meta = getPlayerClassMeta(className);
  assert.equal(meta.className, className);
  assert.equal(normalizePlayerClass(` ${className.toUpperCase()} `), className);
  assert.ok(meta.iconUrl?.startsWith("https://cdn.warmane.com/wotlk/icons/large/classicon_"));
}
assert.equal(normalizePlayerClass("DEATH_KNIGHT"), "Death Knight");
assert.equal(normalizePlayerClass("death-knight"), "Death Knight");
assert.equal(normalizePlayerClass("dk"), "Death Knight");
assert.equal(normalizePlayerClass(6), "Death Knight");
assert.equal(normalizePlayerClass("11"), "Druid");
assert.equal(getPlayerClassMeta("Paladin").color, "#f58cba");
assert.equal(getPlayerClassMeta("Warrior").color, "#c79c6e");
for (const value of [null, undefined, {}, -1, "-1", "+1", 1.5, NaN, 10, 12, "Monk", "Lausudo", "Unknown", "", "  "]) {
  assert.deepEqual(getPlayerClassMeta(value), {
    className: null, label: "Unknown class", color: "#a3a3a3", textColor: "#a3a3a3", iconUrl: null,
  });
}
console.log("player class normalization tests passed");
