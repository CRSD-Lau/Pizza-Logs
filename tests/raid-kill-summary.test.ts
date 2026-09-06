import assert from "node:assert/strict";
import { test } from "node:test";
import { countAttempts } from "../lib/attempt-policy";
import { buildRaidKillSummary, buildRaidSummary, raidMetricRate, type RaidSummaryEncounter } from "../lib/raid-kill-summary";

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

test("all attempts includes short wipes and unknown outcomes independently of the count toggle", () => {
  const input = [fight("KILL", 10_500, 1000), fight("WIPE", 60_000, 9000, "WipeOnly"),
    fight("WIPE", 3500, 2000), fight("UNKNOWN", 50_000, 8000)].map(encounter => ({
    ...encounter,
    participants: encounter.participants.map(participant => ({ ...participant, deaths: 0 })),
  }));
  const before = structuredClone(input);
  const summary = buildRaidSummary(input, "all");
  assert.deepEqual(summary.encounters, input);
  assert.notEqual(summary.encounters, input, "the selected encounter list is a new array");
  assert.equal(summary.totalDamage, 20_000);
  assert.equal(summary.totalHealing, 800);
  assert.equal(summary.totalAbsorbs, 200);
  assert.equal(summary.heal, 1000);
  assert.equal(summary.totalDamageTaken, 1200);
  assert.equal(summary.durationMs, 124_000);
  assert.deepEqual(summary.players.map(player => [player.name, player.totalDamage]), [["Alice", 11_000], ["WipeOnly", 9000]]);
  assert.equal(raidMetricRate(summary.players[1].totalDamage, summary.durationMs), 9000 / 124);
  assert.equal(countAttempts(input).totalPulls, 3);
  assert.equal(countAttempts(input, { includeShortPulls: true }).totalPulls, 4);
  assert.deepEqual(buildRaidSummary(input, "all"), summary, "counting preferences cannot change stored combat totals");
  assert.deepEqual(buildRaidSummary(input, "kills"), buildRaidKillSummary(input));
  assert.equal(buildRaidSummary(input, "kills").totalDamage, 1000);
  assert.deepEqual(input, before);
});

test("stored owner totals include controlled-pet output only once", () => {
  const input = [fight("KILL", 10_000, 1500, "Owner"), fight("WIPE", 20_000, 2500, "Owner")].map(encounter => ({
    ...encounter,
    participants: encounter.participants.map(participant => ({
      ...participant,
      // Owned abomination damage is already folded into the participant primitives.
      spellBreakdown: {
        "Death Strike": { damage: participant.totalDamage - 500, healing: 0, hits: 1, crits: 0, school: 1 },
        "Mutated Slash": { damage: 500, healing: 0, hits: 1, crits: 0, school: 1 },
      },
    })),
  }));
  const before = structuredClone(input);
  const summary = buildRaidSummary(input, "all");
  assert.equal(summary.totalDamage, 4000);
  assert.deepEqual(summary.players, [{ name: "Owner", playerClass: "Priest", totalDamage: 4000,
    totalHealing: 400, totalAbsorbs: 100, heal: 500, damageTaken: 600 }]);
  assert.deepEqual(input, before);
});

test("all-attempt durations retain valid legacy seconds and make invalid evidence unavailable", () => {
  for (const durationMs of [0, null, undefined]) {
    const legacy = { ...fight("WIPE", 1, 500), durationMs, durationSeconds: 1.25 };
    assert.equal(buildRaidSummary([fight("KILL", 10_000, 1000), legacy], "all").durationMs, 11_250);
  }
  for (const durationMs of [-1, Number.NaN, Infinity]) {
    const invalid = { ...fight("UNKNOWN", 1, 500), durationMs, durationSeconds: 20 };
    const summary = buildRaidSummary([fight("KILL", 10_000, 1000), invalid], "all");
    assert.equal(summary.durationMs, null, "invalid precise duration must not fall back to seconds");
    assert.equal(summary.totalDamage, 1500);
    assert.equal(raidMetricRate(summary.totalDamage, summary.durationMs), null);
    assert.equal(buildRaidSummary([fight("KILL", 10_000, 1000), invalid], "kills").durationMs, 10_000);
  }
  for (const durationSeconds of [undefined, null, 0, -1, Number.NaN, Infinity]) {
    const unavailable = { ...fight("WIPE", 0, 500), durationSeconds };
    assert.equal(buildRaidSummary([unavailable], "all").durationMs, null);
  }
});

test("empty all-attempt summaries do not invent totals or rates", () => {
  const summary = buildRaidSummary([], "all");
  assert.deepEqual(summary, { encounters: [], durationMs: 0, totalDamage: 0, totalHealing: 0,
    totalAbsorbs: 0, heal: 0, totalDamageTaken: 0, players: [] });
  assert.equal(raidMetricRate(summary.totalDamage, summary.durationMs), null);
});
