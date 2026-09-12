import assert from "node:assert/strict";
import { test } from "node:test";
import { countAttempts, isShortPull, parseIncludeShortPulls, type AttemptEvidence } from "../lib/attempt-policy";

const wipe: AttemptEvidence = {
  outcome: "WIPE", durationMs: 7500, durationSeconds: 7, participants: [{ deaths: 0 }],
};

test("short-pull counting excludes casualties but preserves kills, unknown outcomes and the exact duration boundary", () => {
  assert.equal(isShortPull(wipe), true);
  for (const outcome of ["KILL", "UNKNOWN"]) assert.equal(isShortPull({ ...wipe, outcome }), false);
  assert.equal(isShortPull({ ...wipe, durationMs: 59999, durationSeconds: 60 }), true);
  assert.equal(isShortPull({ ...wipe, durationMs: 60000, durationSeconds: 59 }), false);
  assert.equal(isShortPull({ ...wipe, durationMs: 60001 }), false);
  assert.equal(isShortPull({ ...wipe, participants: [{ deaths: 0 }, { deaths: 3 }] }), true);
});

test("legacy duration fallback works while missing or invalid duration stays counted", () => {
  for (const durationMs of [0, null, undefined]) {
    assert.equal(isShortPull({ ...wipe, durationMs, durationSeconds: 59.999 }), true);
    assert.equal(isShortPull({ ...wipe, durationMs, durationSeconds: 60 }), false);
  }
  for (const durationMs of [-1, NaN, Infinity]) assert.equal(isShortPull({ ...wipe, durationMs }), false);
  for (const durationSeconds of [0, -1, NaN, Infinity, null, undefined]) {
    assert.equal(isShortPull({ ...wipe, durationMs: 0, durationSeconds }), false);
  }
  for (const participants of [undefined, null, [], [{}], [{ deaths: null }], [{ deaths: -1 }], [{ deaths: NaN }]]) {
    assert.equal(isShortPull({ ...wipe, participants }), true);
  }
  assert.equal(isShortPull({ ...wipe, participants: Array(1) }), true, "Death evidence is irrelevant to short-pull classification");
});

test("include-all restores counts without mutating outcomes, records or metrics", () => {
  const records = [
    { ...wipe, totalDamage: 1000 },
    { ...wipe, durationMs: 3200, totalDamage: 2000 },
    { ...wipe, durationMs: 2700, totalDamage: 3000 },
    { ...wipe, durationMs: 24500, participants: [{ deaths: 3 }], totalDamage: 4000 },
    { ...wipe, outcome: "KILL", totalDamage: 100000 },
    { ...wipe, outcome: "UNKNOWN", totalDamage: 50000 },
  ];
  const before = structuredClone(records);
  assert.deepEqual(countAttempts(records), { kills: 1, wipes: 0, unknown: 1, totalPulls: 2, shortPulls: 4 });
  assert.deepEqual(countAttempts(records, { includeShortPulls: true }), { kills: 1, wipes: 4, unknown: 1, totalPulls: 6, shortPulls: 4 });
  assert.deepEqual(records, before);
  assert.deepEqual(countAttempts([]), { kills: 0, wipes: 0, unknown: 0, totalPulls: 0, shortPulls: 0 });
});

test("only the explicit includeShortPulls=1 query value enables all counts", () => {
  assert.equal(parseIncludeShortPulls("1"), true);
  for (const value of [undefined, null, "", "0", "true", 1, true, ["1"]]) assert.equal(parseIncludeShortPulls(value), false);
});
