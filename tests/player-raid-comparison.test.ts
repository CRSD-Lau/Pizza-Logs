import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRaidComparisonChart,
  buildRaidComparisonRuns,
  buildRaidComparisonSessions,
  raidComparisonSessionKey,
  raidComparisonDifficultyLabel,
  resolveRaidComparisonMetric,
  type RaidComparisonParticipantSource,
} from "../lib/player-raid-comparison";
import { WOTLK_BOSSES } from "../lib/constants/bosses";

const source = (uploadId: string, sessionIndex: number, startedAt: string) => ({ uploadId, sessionIndex, startedAt });
const participant = (id: string, overrides: Partial<RaidComparisonParticipantSource["encounter"]> = {}, rates: Partial<RaidComparisonParticipantSource> = {}): RaidComparisonParticipantSource => ({
  dps: 12500, hps: 0, spec: "Combat", ...rates,
  encounter: {
    id, uploadId: "upload", sessionIndex: 0, startedAt: "2026-09-06T18:00:00Z", outcome: "KILL", difficulty: "25H",
    durationMs: 60_000, durationSeconds: 60,
    boss: { slug: "marrowgar", name: "Lord Marrowgar", sortOrder: 1 }, ...overrides,
  },
});

test("healing and tank comparison rates preserve zero, missing evidence and exact duration", () => {
  const sessions = buildRaidComparisonSessions([source("upload", 0, "2026-09-06T18:00:00Z")]);
  const run = (rates: Partial<RaidComparisonParticipantSource>, durationMs = 60_000) => buildRaidComparisonRuns(sessions, [
    participant("fight", { durationMs, durationSeconds: 0 }, rates),
  ]);
  const healer = run({ role: "HEALER", spec: "Discipline Priest", hps: 100, aps: 500, damageTaken: 3000 });
  assert.equal(healer[0].fights[0].ha, 600);
  assert.equal(healer[0].fights[0].dtps, 50);
  assert.equal(resolveRaidComparisonMetric(null, healer), "HA");
  assert.equal(resolveRaidComparisonMetric("DPS", healer), "DPS", "An explicit choice always wins over role defaults");
  const tank = run({ role: "TANK", spec: "Blood", hps: 0, aps: 0, damageTaken: 0 });
  assert.equal(resolveRaidComparisonMetric(null, tank), "DTPS");
  assert.equal(tank[0].fights[0].ha, 0);
  assert.equal(tank[0].fights[0].dtps, 0);
  assert.equal(buildRaidComparisonChart(tank)[0].values["upload:0"]?.dtps, 0);
  assert.equal(resolveRaidComparisonMetric("bogus", run({ role: "DPS" })), "DPS");
  const invalid = run({ hps: 100, aps: 500, damageTaken: 3000 }, 0)[0].fights[0];
  assert.deepEqual([invalid.hps, invalid.aps, invalid.ha, invalid.dtps], [null, null, null, null]);
  assert.equal(run({ hps: 100, aps: null })[0].fights[0].ha, null, "Missing absorbs cannot be silently treated as zero");
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

test("every recorded session becomes a run in newest-first order", () => {
  const sessions = buildRaidComparisonSessions([
    source("old", 0, "2026-08-23T18:00:00Z"),
    source("middle", 0, "2026-08-30T18:00:00Z"),
    source("new", 0, "2026-09-06T18:00:00Z"),
  ]);
  const participants = sessions.map(session => participant(session.key, {
    uploadId: session.key.split(":")[0], startedAt: session.startedAt,
  }));
  const runs = buildRaidComparisonRuns(sessions, participants);
  assert.deepEqual(runs.map(run => run.key), ["new:0", "middle:0", "old:0"]);
  assert.ok(runs.every(run => run.fights.length === 1));
  assert.equal(buildRaidComparisonRuns(sessions.slice(0, 1), participants).length, 1);
  assert.deepEqual(buildRaidComparisonRuns([], participants), []);
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
    difficulty: "25H", dps: 1000, hps: 25, spec: "Combat", aps: null, ha: null, dtps: null, role: null,
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
  const sessions = buildRaidComparisonSessions([
    source("upload", 0, "2026-08-30T18:00:00Z"), source("upload", 1, "2026-09-06T18:00:00Z"),
  ]);
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

test("known raid charts retain every canonical boss slot while missing kills remain null", () => {
  const icc = WOTLK_BOSSES.filter(boss => boss.raidSlug === "icecrown-citadel");
  const sessions = buildRaidComparisonSessions([source("upload", 0, "2026-09-06T18:00:00Z")]);
  const runs = buildRaidComparisonRuns(sessions, [
    participant("deathwhisper-normal", {
      difficulty: "25N", boss: { slug: icc[1].slug, name: icc[1].name, sortOrder: icc[1].sortOrder },
    }, { dps: 0 }),
    participant("sindragosa-heroic", {
      difficulty: "25H", boss: { slug: icc[10].slug, name: icc[10].name, sortOrder: icc[10].sortOrder },
    }),
  ]);
  const chart = buildRaidComparisonChart(runs, "icecrown-citadel");
  assert.equal(chart.length, 12);
  assert.deepEqual(chart.map(row => row.bossSlug), icc.map(boss => boss.slug));
  assert.equal(chart[0].values["upload:0"], null);
  assert.equal(chart[1].values["upload:0"]?.dps, 0);
  assert.equal(chart[1].values["upload:0"]?.difficulty, "25N");
  assert.equal(chart[10].values["upload:0"]?.difficulty, "25H");
  assert.equal(chart[11].values["upload:0"], null);
  assert.equal(buildRaidComparisonChart([], "icecrown-citadel").length, 12);
  assert.equal(buildRaidComparisonChart(runs, "custom-raid").length, 2);
  assert.equal(buildRaidComparisonChart(runs).length, 2, "Without a known raid, observed boss data remains intact");
});

test("mixed-mode representatives keep the earliest kill's actual difficulty and stored rates", () => {
  const sessions = buildRaidComparisonSessions([source("upload", 0, "2026-09-06T18:00:00Z")]);
  const runs = buildRaidComparisonRuns(sessions, [
    participant("later-heroic", { startedAt: "2026-09-06T19:00:00Z", difficulty: "25H" }, { dps: 25000 }),
    participant("first-normal", { difficulty: "25N" }, { dps: 5000 }),
  ]);
  assert.equal(runs[0].fights.length, 1);
  assert.equal(runs[0].fights[0].encounterId, "first-normal");
  assert.equal(runs[0].fights[0].difficulty, "25N");
  assert.equal(runs[0].fights[0].dps, 5000);
  assert.equal(buildRaidComparisonChart(runs)[0].values["upload:0"]?.difficulty, "25N");
});

test("comparison scope labels distinguish combined sizes, exact modes, and unknown or custom evidence", () => {
  assert.equal(raidComparisonDifficultyLabel("25"), "25-player · Normal + heroic");
  assert.equal(raidComparisonDifficultyLabel("10"), "10-player · Normal + heroic");
  assert.equal(raidComparisonDifficultyLabel("25N"), "25-player normal (25N)");
  assert.equal(raidComparisonDifficultyLabel("25H"), "25-player heroic (25H)");
  assert.equal(raidComparisonDifficultyLabel("UNKNOWN"), "Unknown difficulty");
  assert.equal(raidComparisonDifficultyLabel("25H_LEGACY"), "25H_LEGACY");
});
