import assert from "node:assert/strict";
import test from "node:test";
import {
  nextSessionPlayerSort,
  sortSessionPlayers,
  type SessionPlayerRow,
  type SessionPlayerSortKey,
} from "../lib/session-player-sort";

const numericKeys: SessionPlayerSortKey[] = ["totalDamage", "dps", "heal", "healPerSecond", "damageTaken", "dtps"];
function row(name: string, value: number, overrides: Partial<SessionPlayerRow> = {}): SessionPlayerRow {
  return {
    name, href: null, color: "#fff", totalDamage: value, dps: value, heal: value,
    healPerSecond: value, damageTaken: value, dtps: value, ...overrides,
  };
}
const names = (rows: SessionPlayerRow[]) => rows.map(entry => entry.name);

test("all six metrics sort numerically in both directions before display formatting", () => {
  const rows = [row("Two", 2), row("Ten", 10), row("Fraction", 2.01)];
  for (const key of numericKeys) {
    assert.deepEqual(names(sortSessionPlayers(rows, { key, direction: "desc" })), ["Ten", "Fraction", "Two"], key);
    assert.deepEqual(names(sortSessionPlayers(rows, { key, direction: "asc" })), ["Two", "Fraction", "Ten"], key);
  }
});

test("metric ties remain alphabetical in either direction", () => {
  const rows = [row("Zulu", 3), row("beta", 3), row("Alpha", 3)];
  for (const key of numericKeys) {
    for (const direction of ["asc", "desc"] as const) {
      assert.deepEqual(names(sortSessionPlayers(rows, { key, direction })), ["Alpha", "beta", "Zulu"]);
    }
  }
});

test("missing rates stay last in either direction, with deterministic ties", () => {
  for (const key of ["dps", "healPerSecond", "dtps"] as const) {
    const rows = [row("Zulu", 0, { [key]: null }), row("Zero", 0), row("Ten", 10), row("Alpha", 0, { [key]: null })];
    assert.deepEqual(names(sortSessionPlayers(rows, { key, direction: "asc" })), ["Zero", "Ten", "Alpha", "Zulu"]);
    assert.deepEqual(names(sortSessionPlayers(rows, { key, direction: "desc" })), ["Ten", "Zero", "Alpha", "Zulu"]);
  }
});

test("player sorting supports alphabetical and reverse alphabetical order", () => {
  const rows = [row("Zulu", 1), row("beta", 2), row("Alpha", 3)];
  assert.deepEqual(names(sortSessionPlayers(rows, { key: "name", direction: "asc" })), ["Alpha", "beta", "Zulu"]);
  assert.deepEqual(names(sortSessionPlayers(rows, { key: "name", direction: "desc" })), ["Zulu", "beta", "Alpha"]);
  assert.deepEqual(names(sortSessionPlayers([row("same", 0), row("Same", 0)], { key: "totalDamage", direction: "asc" })), ["Same", "same"]);
});

test("sorting preserves the source order, row values and link associations", () => {
  const rows = Object.freeze([
    Object.freeze(row("Two", 2, { href: "/two", color: "#123" })),
    Object.freeze(row("Ten", 10, { href: "/ten", color: "#456" })),
  ]);
  const before = structuredClone(rows);
  const sorted = sortSessionPlayers(rows, { key: "totalDamage", direction: "desc" });
  assert.deepEqual(rows, before);
  assert.notEqual(sorted, rows);
  assert.equal(sorted[0], rows[1]);
  assert.equal(sorted[1], rows[0]);
});

test("new numeric columns start descending, player starts ascending, repeated selections reverse", () => {
  for (const key of numericKeys) {
    const first = nextSessionPlayerSort({ key: "name", direction: "desc" }, key);
    assert.deepEqual(first, { key, direction: "desc" });
    const second = nextSessionPlayerSort(first, key);
    assert.deepEqual(second, { key, direction: "asc" });
    assert.deepEqual(nextSessionPlayerSort(second, key), first);
  }
  assert.deepEqual(nextSessionPlayerSort({ key: "dtps", direction: "desc" }, "name"), { key: "name", direction: "asc" });
});
