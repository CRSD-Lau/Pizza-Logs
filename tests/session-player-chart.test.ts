import assert from "node:assert/strict";
import { buildSessionPlayerMetricChart, resolveSessionPlayerMetric, type SessionPlayerChartEncounter, type SessionPlayerMetric } from "../lib/session-player-chart";

const chart = buildSessionPlayerMetricChart({
  encounters: [
    {
      boss: { name: "Lord Marrowgar" },
      outcome: "WIPE",
      durationSeconds: 100,
      participants: [
        { player: { name: "Lausudo" }, dps: 3200, hps: 0 },
        { player: { name: "Harrisj" }, dps: 500, hps: 0 },
      ],
    },
    {
      boss: { name: "Lord Marrowgar" },
      outcome: "KILL",
      durationSeconds: 100,
      participants: [
        { player: { name: "Lausudo" }, dps: 8400, hps: 0 },
        { player: { name: "Harrisj" }, dps: 400, hps: 0 },
      ],
    },
    {
      boss: { name: "Valithria Dreamwalker" },
      outcome: "WIPE",
      durationSeconds: 100,
      participants: [
        { player: { name: "Lausudo" }, dps: 3800, hps: 0 },
        { player: { name: "Harrisj" }, dps: 300, hps: 0 },
      ],
    },
    {
      boss: { name: "Deathbringer Saurfang" },
      outcome: "KILL",
      durationSeconds: 100,
      participants: [
        { player: { name: "Lausudo" }, dps: 10400, hps: 0 },
      ],
    },
  ],
  playerNames: ["Lausudo", "Harrisj"],
  metric: "DPS",
});

assert.deepEqual(
  chart.map((point) => point.bossName),
  ["Lord Marrowgar", "Deathbringer Saurfang"],
);
assert.equal(chart[0].Lausudo, 8400);
assert.equal(chart[0].Harrisj, 400);
assert.equal(chart[1].Lausudo, 10400);
assert.equal(chart[1].Harrisj, null);

assert.equal(resolveSessionPlayerMetric(undefined, "damage"), "DPS");
assert.equal(resolveSessionPlayerMetric(undefined, "healing"), "Healing + absorbs /s");
assert.equal(resolveSessionPlayerMetric(undefined, "tank"), "DTPS");
assert.equal(resolveSessionPlayerMetric(undefined, "all"), "DPS");
assert.equal(resolveSessionPlayerMetric("HPS", "damage"), "HPS", "A chosen metric overrides role defaults");
assert.equal(resolveSessionPlayerMetric(["APS", "DPS"], "healing"), "APS");
assert.equal(resolveSessionPlayerMetric("invalid", "tank"), "DTPS");

const metricEncounters: SessionPlayerChartEncounter[] = [
  { boss: { name: "Zero" }, outcome: "KILL", durationMs: 1500, durationSeconds: 1, participants: [{ player: { name: "Tank" }, dps: 0, hps: 0, aps: 0, damageTaken: 0 }] },
  { boss: { name: "Precise" }, outcome: "KILL", durationMs: 1500, durationSeconds: 1, participants: [{ player: { name: "Tank" }, dps: 123, hps: 20, aps: 80, damageTaken: 300 }] },
  { boss: { name: "Missing" }, outcome: "KILL", durationSeconds: 0, participants: [{ player: { name: "Tank" }, dps: null, hps: null, damageTaken: 300 }] },
];
for (const metric of ["DPS", "HPS", "APS", "Healing + absorbs /s", "DTPS"] satisfies SessionPlayerMetric[]) {
  const values = buildSessionPlayerMetricChart({ encounters: metricEncounters, playerNames: ["Tank", "Absent"], metric });
  assert.equal(values[0].Tank, 0, `${metric} keeps a recorded zero`);
  assert.equal(values[0].Absent, null, `${metric} does not invent an absent participant value`);
  assert.equal(values[2].Tank, null, `${metric} keeps an unavailable measurement missing`);
}
assert.equal(buildSessionPlayerMetricChart({ encounters: metricEncounters, playerNames: ["Tank"], metric: "DTPS" })[1].Tank, 200);
assert.equal(buildSessionPlayerMetricChart({ encounters: metricEncounters, playerNames: ["Tank"], metric: "Healing + absorbs /s" })[1].Tank, 100);

for (const metric of ["DPS", "HPS", "APS", "Healing + absorbs /s", "DTPS"] satisfies SessionPlayerMetric[]) {
  const recorded = { player: { name: "Player" }, dps: 100, hps: 50, aps: 25, damageTaken: 200 };
  const invalidDurations: SessionPlayerChartEncounter[] = [
    { boss: { name: "Missing duration" }, outcome: "KILL", participants: [recorded] },
    { boss: { name: "Zero duration" }, outcome: "KILL", durationMs: 0, durationSeconds: 0, participants: [recorded] },
    { boss: { name: "Invalid duration" }, outcome: "KILL", durationMs: -1, durationSeconds: 100, participants: [recorded] },
  ];
  const invalidValues = buildSessionPlayerMetricChart({ encounters: invalidDurations, playerNames: ["Player"], metric });
  assert.ok(invalidValues.every(point => point.Player === null), `${metric} does not present a rate without valid duration evidence`);
  for (const invalid of [-1, NaN, Infinity]) {
    const invalidMeasurement = buildSessionPlayerMetricChart({
      encounters: [{ boss: { name: "Invalid measurement" }, outcome: "KILL", durationSeconds: 100, participants: [{ player: { name: "Player" }, dps: invalid, hps: invalid, aps: invalid, damageTaken: invalid }] }],
      playerNames: ["Player"], metric,
    });
    assert.equal(invalidMeasurement[0].Player, null, `${metric} rejects invalid numeric measurements`);
  }
}

console.log("session-player-chart tests passed");
