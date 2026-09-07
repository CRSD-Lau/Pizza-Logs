import assert from "node:assert/strict";
import { test } from "node:test";
import { getSessionPlayerSummaryMetrics, type SessionPlayerSummaryEntry } from "../lib/session-player-metrics";

const zero: SessionPlayerSummaryEntry = { outcome: "KILL", duration: 10, dps: 0, hps: 0, aps: 0, totalDamage: 0, totalHealing: 0, totalAbsorbs: 0, damageTaken: 0, deaths: 0 };

test("relevant session summaries preserve measured zeros and separate healing primitives", () => {
  const damage = getSessionPlayerSummaryMetrics([zero], "damage");
  assert.deepEqual(damage.map(entry => entry.label), ["Damage", "Best DPS", "Avg DPS", "Deaths"]);
  assert.ok(damage.every(entry => entry.value === 0));
  const healing = getSessionPlayerSummaryMetrics([{ ...zero, hps: 20, aps: 80, totalHealing: 200, totalAbsorbs: 800 }], "healing");
  const metric = (label: string) => healing.find(entry => entry.label === label)?.value;
  assert.equal(metric("Best HPS"), 20);
  assert.equal(metric("Best APS"), 80);
  assert.equal(metric("Best Healing + absorbs /s"), 100);
  assert.equal(metric("Effective healing"), 200);
  assert.equal(metric("Absorbs"), 800);
  assert.equal(metric("Healing + absorbs"), 1000);
  assert.equal(metric("Best DPS"), undefined);
});

test("tank session DTPS weights recorded durations and does not rank damage taken", () => {
  const metrics = getSessionPlayerSummaryMetrics([
    { ...zero, duration: 10, damageTaken: 100, dps: 8 },
    { ...zero, outcome: "WIPE", duration: 30, damageTaken: 900, dps: 12 },
    { ...zero, duration: null, damageTaken: 500, dps: 2 },
  ], "tank");
  assert.equal(metrics.find(entry => entry.label === "Damage taken")?.value, 1500);
  assert.equal(metrics.find(entry => entry.label === "DTPS")?.value, 25);
  assert.equal(metrics.find(entry => entry.label === "Best DPS")?.value, 12);
  assert.equal(metrics.find(entry => entry.label === "Avg DPS")?.value, 5);
  assert.ok(!metrics.some(entry => /best.*dtps|best.*damage taken/i.test(entry.label)));
});

test("missing kill averages and durations remain unavailable instead of zero", () => {
  const metrics = getSessionPlayerSummaryMetrics([{ ...zero, outcome: "WIPE", duration: null }], "all");
  assert.equal(metrics.find(entry => entry.label === "DTPS")?.value, null);
  assert.equal(metrics.find(entry => entry.label === "Avg DPS")?.value, null);
  assert.equal(metrics.find(entry => entry.label === "Avg HPS")?.value, null);
  assert.equal(metrics.find(entry => entry.label === "Best DPS")?.value, 0);
  assert.ok(getSessionPlayerSummaryMetrics([], "all").every(entry => entry.value === null));
  const missing = getSessionPlayerSummaryMetrics([{ ...zero, hps: null, totalHealing: null }], "healing");
  assert.equal(missing.find(entry => entry.label === "Best Healing + absorbs /s")?.value, null);
  assert.equal(missing.find(entry => entry.label === "Healing + absorbs")?.value, null);
});
