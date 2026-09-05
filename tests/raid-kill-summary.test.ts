import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRaidKillSummary, raidMetricRate, type RaidSummaryEncounter } from "../lib/raid-kill-summary";

function fight(outcome: string, durationMs: number, damage: number, name = "Alice"): RaidSummaryEncounter {
  return {
    outcome, durationMs, durationSeconds: 99,
    totalDamage: damage, totalHealing: 200, totalAbsorbs: 50, totalDamageTaken: 300,
    participants: [{
      player: { name, class: "Priest" },
      totalDamage: damage, totalHealing: 200, totalAbsorbs: 50, damageTaken: 300,
    }],
  };
}

test("kill summary uses only successful fights and sums primitives, including encounter adds", () => {
  const input = [fight("WIPE", 60_000, 900_000, "WipeOnly"), fight("KILL", 10_500, 1000),
    fight("UNKNOWN", 50_000, 800_000), fight("KILL", 30_000, 2000)];
  const before = structuredClone(input);
  const summary = buildRaidKillSummary(input);
  assert.equal(summary.encounters.length, 2);
  assert.equal(summary.totalDamage, 3000);
  assert.equal(summary.totalHealing, 400);
  assert.equal(summary.totalAbsorbs, 100);
  assert.equal(summary.heal, 500);
  assert.equal(summary.totalDamageTaken, 600);
  assert.equal(summary.durationMs, 40_500);
  assert.deepEqual(summary.players.map(player => player.name), ["Alice"]);
  assert.equal(summary.players[0].totalDamage, 3000);
  assert.equal(summary.players[0].heal, 500);
  assert.equal(raidMetricRate(summary.players[0].totalDamage, summary.durationMs), 3000 / 40.5);
  assert.deepEqual(input, before, "stored encounters are not mutated");
});

test("roster substitutions and zero-output kill participants use the same raid duration", () => {
  const first = fight("KILL", 10_000, 1000);
  const second = fight("KILL", 30_000, 0, "Bob");
  const summary = buildRaidKillSummary([first, second]);
  assert.deepEqual(summary.players.map(player => player.name), ["Alice", "Bob"]);
  assert.deepEqual(summary.players.map(player => raidMetricRate(player.totalDamage, summary.durationMs)), [25, 0]);
});

test("legacy seconds are supported, missing duration never invents aggregate rates", () => {
  const legacy = { ...fight("KILL", 0, 1000), durationSeconds: 20 };
  assert.equal(buildRaidKillSummary([legacy]).durationMs, 20_000);
  for (const durationMs of [null, 0, -1, Number.NaN]) {
    const unknown = { ...fight("KILL", 10_000, 2000), durationMs, durationSeconds: 0 };
    const summary = buildRaidKillSummary([legacy, unknown]);
    assert.equal(summary.totalDamage, 3000);
    assert.equal(summary.durationMs, null);
    assert.equal(raidMetricRate(summary.totalDamage, summary.durationMs), null);
  }
});

test("no kills stays empty without substituting wipe or unknown totals", () => {
  const summary = buildRaidKillSummary([fight("WIPE", 60_000, 9000), fight("UNKNOWN", 60_000, 8000)]);
  assert.equal(summary.totalDamage, 0);
  assert.equal(summary.heal, 0);
  assert.equal(summary.totalDamageTaken, 0);
  assert.equal(summary.durationMs, 0);
  assert.deepEqual(summary.players, []);
  assert.deepEqual(summary.encounters, []);
  assert.equal(raidMetricRate(0, 0), null);
});
