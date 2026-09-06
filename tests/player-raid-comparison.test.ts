import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRaidComparisonChart,
  buildRaidComparisonRuns,
  buildRaidComparisonSessions,
  raidComparisonSessionKey,
  selectRaidComparisonSessions,
  type RaidComparisonParticipantSource,
} from "../lib/player-raid-comparison";

const source = (uploadId: string, sessionIndex: number, startedAt: string) => ({ uploadId, sessionIndex, startedAt });
const participant = (id: string, overrides: Partial<RaidComparisonParticipantSource["encounter"]> = {}, rates: Partial<RaidComparisonParticipantSource> = {}): RaidComparisonParticipantSource => ({
  dps: 12500, hps: 0, spec: "Combat", ...rates,
  encounter: {
    id, uploadId: "upload", sessionIndex: 0, startedAt: "2026-09-06T18:00:00Z", outcome: "KILL",
    durationMs: 60_000, durationSeconds: 60,
    boss: { slug: "marrowgar", name: "Lord Marrowgar", sortOrder: 1 }, ...overrides,
  },
});

test("raid sessions retain upload and session identity with stable same-date labels", () => {
  const sources = [
    source("upload-b", 0, "2026-09-06T21:00:00Z"),
    source("upload-a", 1, "2026-09-06T21:00:00Z"),
    source("upload-a", 0, "2026-09-06T18:00:00Z"),
    source("upload-a", 0, "2026-09-06T19:00:00Z"),
    source("last-week", 0, "2026-08-30T18:00:00Z"),
    source("invalid", 0, "not a date"),
  ];
  const sessions = buildRaidComparisonSessions(sources);
  assert.deepEqual(sessions.map(session => session.key), ["upload-a:1", "upload-b:0", "upload-a:0", "last-week:0"]);
  assert.equal(sessions[2].startedAt, "2026-09-06T18:00:00.000Z");
  assert.deepEqual(sessions.slice(0, 3).map(session => session.label), [
    "Sep 6, 2026 UTC · raid 2", "Sep 6, 2026 UTC · raid 3", "Sep 6, 2026 UTC · raid 1",
  ]);
  assert.equal(sessions[3].label, "Aug 30, 2026 UTC");
  assert.deepEqual(buildRaidComparisonSessions([...sources].reverse()), sessions);
  assert.notEqual(raidComparisonSessionKey("upload-a", 1), raidComparisonSessionKey("upload-b", 1));
});

test("selection defaults to the latest two known sessions and rejects forged keys", () => {
  const sessions = buildRaidComparisonSessions([
    source("old", 0, "2026-08-23T18:00:00Z"),
    source("middle", 0, "2026-08-30T18:00:00Z"),
    source("new", 0, "2026-09-06T18:00:00Z"),
  ]);
  assert.deepEqual(selectRaidComparisonSessions(sessions).map(session => session.key), ["new:0", "middle:0"]);
  assert.deepEqual(selectRaidComparisonSessions(sessions, "forged:5", "wrong-player:1").map(session => session.key), ["new:0", "middle:0"]);
  assert.deepEqual(selectRaidComparisonSessions(sessions, "old:0", "new:0").map(session => session.key), ["old:0", "new:0"]);
  assert.deepEqual(selectRaidComparisonSessions(sessions, "middle:0", "middle:0").map(session => session.key), ["middle:0", "new:0"]);
  assert.equal(selectRaidComparisonSessions(sessions.slice(0, 1)).length, 1);
  assert.deepEqual(selectRaidComparisonSessions([]), []);
});

test("earliest successful boss kill wins, including short kills and stable timestamp ties", () => {
  const sessions = buildRaidComparisonSessions([source("upload", 0, "2026-09-06T18:00:00Z")]);
  const participants = [
    participant("later-best", { startedAt: "2026-09-06T19:00:00Z" }, { dps: 99999 }),
    participant("same-time-z", {}, { dps: 33333 }),
    participant("same-time-a", { durationMs: 500, durationSeconds: 0 }, { dps: 1000, hps: 25 }),
    participant("earlier-wipe", { startedAt: "2026-09-06T17:00:00Z", outcome: "WIPE" }),
    participant("earlier-unknown", { startedAt: "2026-09-06T16:00:00Z", outcome: "UNKNOWN" }),
    participant("other-session", { sessionIndex: 1, startedAt: "2026-09-06T15:00:00Z" }),
  ];
  const runs = buildRaidComparisonRuns(sessions, participants);
  assert.equal(runs[0].fights.length, 1);
  assert.deepEqual(runs[0].fights[0], {
    encounterId: "same-time-a", bossSlug: "marrowgar", bossName: "Lord Marrowgar", bossOrder: 1,
    dps: 1000, hps: 25, spec: "Combat",
  });
  assert.deepEqual(buildRaidComparisonRuns(sessions, [...participants].reverse()), runs);
});

test("invalid duration or rate remains unavailable while zero and legacy seconds remain measured", () => {
  const sessions = buildRaidComparisonSessions([source("upload", 0, "2026-09-06T18:00:00Z")]);
  const cases = [
    { durationMs: 0, durationSeconds: 0, dps: 100, hps: 25, expected: [null, null] },
    { durationMs: -1, durationSeconds: 60, dps: 100, hps: 25, expected: [null, null] },
    { durationMs: Number.NaN, durationSeconds: 60, dps: 100, hps: 25, expected: [null, null] },
    { durationMs: 0, durationSeconds: 60, dps: 0, hps: 0, expected: [0, 0] },
    { durationMs: null, durationSeconds: 60, dps: 100, hps: 25, expected: [100, 25] },
    { durationMs: 500, durationSeconds: 0, dps: 100, hps: 25, expected: [100, 25] },
    { durationMs: 1000, durationSeconds: 60, dps: Number.POSITIVE_INFINITY, hps: 25, expected: [null, 25] },
    { durationMs: 1000, durationSeconds: 60, dps: 100, hps: -1, expected: [100, null] },
    { durationMs: 1000, durationSeconds: 60, dps: null, hps: Number.NaN, expected: [null, null] },
  ];
  const participants = cases.map((entry, index) => participant(`case-${index}`, {
    durationMs: entry.durationMs, durationSeconds: entry.durationSeconds,
    boss: { slug: `boss-${index}`, name: `Boss ${index}`, sortOrder: index },
  }, { dps: entry.dps, hps: entry.hps }));
  const run = buildRaidComparisonRuns(sessions, participants)[0];
  assert.deepEqual(run.fights.map(fight => [fight.dps, fight.hps]), cases.map(entry => entry.expected));
  const laterValid = participant("later-valid", { startedAt: "2026-09-06T19:00:00Z", boss: participants[0].encounter.boss });
  assert.equal(buildRaidComparisonRuns(sessions, [...participants, laterValid])[0].fights[0].dps, null);
});

test("chart aligns raid-order bosses across runs without turning missing kills into zero", () => {
  const sessions = selectRaidComparisonSessions(buildRaidComparisonSessions([
    source("upload", 0, "2026-08-30T18:00:00Z"), source("upload", 1, "2026-09-06T18:00:00Z"),
  ]));
  const runs = buildRaidComparisonRuns(sessions, [
    participant("old-marrowgar", { startedAt: "2026-08-30T18:00:00Z" }, { dps: 0 }),
    participant("new-festergut", { sessionIndex: 1, boss: { slug: "festergut", name: "Festergut", sortOrder: 5 } }),
    participant("old-invalid", { boss: { slug: "saurfang", name: "Deathbringer Saurfang", sortOrder: 4 }, durationMs: -1 }),
  ]);
  const chart = buildRaidComparisonChart(runs);
  assert.deepEqual(chart.map(row => row.bossSlug), ["marrowgar", "saurfang", "festergut"]);
  assert.equal(chart[0].values["upload:0"]?.dps, 0);
  assert.equal(chart[0].values["upload:1"], null);
  assert.equal(chart[1].values["upload:0"]?.dps, null);
  assert.equal(chart[1].values["upload:0"]?.encounterId, "old-invalid");
  assert.equal(chart[2].values["upload:0"], null);
  assert.equal(chart[2].values["upload:1"]?.encounterId, "new-festergut");
  assert.deepEqual(buildRaidComparisonChart([]), []);
});
