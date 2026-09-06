import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { getPlayerRaidComparison } from "../lib/player-raid-comparison.server";
import { buildRaidComparisonChart } from "../lib/player-raid-comparison";
import { WOTLK_BOSSES } from "../lib/constants/bosses";

const connection = process.env.TEST_DATABASE_URL;

test("player raid comparison loads every complete run in the isolated player's exact scope", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async context => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `raid_compare_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
  const detailQueries: Prisma.ParticipantFindManyArgs[] = [];
  const detailQueryMilliseconds: number[] = [];
  const observedDatabase = {
    encounter: database.encounter,
    boss: database.boss,
    participant: new Proxy(database.participant, {
      get(target, property, receiver) {
        if (property === "findMany") return async (args: Prisma.ParticipantFindManyArgs) => {
          detailQueries.push(args);
          const started = performance.now();
          const result = await database.participant.findMany(args);
          detailQueryMilliseconds.push(performance.now() - started);
          return result;
        };
        return Reflect.get(target, property, receiver);
      },
    }),
  };
  try {
    await database.realm.createMany({ data: [
      { id: "realm-a", name: "Test Realm A", host: "test-a" },
      { id: "realm-b", name: "Test Realm B", host: "test-b" },
    ] });
    await database.player.createMany({ data: [
      { id: "subject", name: "Twin", realmId: "realm-a", class: "Rogue" },
      { id: "namesake", name: "Twin", realmId: "realm-b", class: "Rogue" },
      { id: "no-kills", name: "NoKills", realmId: "realm-a", class: "Mage" },
    ] });
    await database.boss.createMany({ data: [
      { id: "marrowgar", slug: "marrowgar", name: "Lord Marrowgar", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel", sortOrder: 1 },
      { id: "gunship", slug: "gunship", name: "Gunship Battle", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel", sortOrder: 3 },
      { id: "saurfang", slug: "saurfang", name: "Deathbringer Saurfang", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel", sortOrder: 4 },
      { id: "halion", slug: "halion", name: "Halion", raid: "The Ruby Sanctum", raidSlug: "ruby-sanctum", sortOrder: 1 },
    ] });
    await database.upload.createMany({ data: ["history", "recent-a", "recent-b", "namesake-only"].map(id => ({
      id, filename: `${id}.synthetic.txt`, fileHash: `${schema}-${id}`, fileSize: 100, status: "DONE" as const,
    })) });

    const encounters: Prisma.EncounterCreateManyInput[] = [];
    const participants: Prisma.ParticipantCreateManyInput[] = [];
    const addFight = (
      id: string,
      encounter: Partial<Prisma.EncounterCreateManyInput> = {},
      rate: { dps?: number; hps?: number; playerId?: string } = {},
    ) => {
      const startedAt = encounter.startedAt ?? new Date("2026-09-06T21:00:00Z");
      encounters.push({
        id, fingerprint: id, bossId: "marrowgar", uploadId: "recent-a", sessionIndex: 1,
        difficulty: "25H", outcome: "KILL", durationMs: 60_000, durationSeconds: 60,
        startedAt, endedAt: new Date(new Date(startedAt).getTime() + 60_000), ...encounter,
      });
      participants.push({
        id: `participant-${id}`, encounterId: id, playerId: rate.playerId ?? "subject",
        dps: rate.dps ?? 12500, hps: rate.hps ?? 25, spec: "Combat",
        totalDamage: 999999, totalHealing: 99999, totalAbsorbs: 9999999, aps: 999999,
        spellBreakdown: { synthetic: { damage: 123 } },
      });
    };

    // Together with the three recent runs, these create 250 sessions. The oldest
    // complete run must reach the chart without any recent-encounter or run cap.
    for (let index = 0; index < 247; index++) {
      addFight(`history-${index}-marrowgar`, {
        uploadId: "history", sessionIndex: index, startedAt: new Date(Date.UTC(2026, 0, index + 1, 18)),
      }, { dps: 1000 + index, hps: 10 });
      addFight(`history-${index}-gunship`, {
        uploadId: "history", sessionIndex: index, bossId: "gunship", startedAt: new Date(Date.UTC(2026, 0, index + 1, 19)),
      }, { dps: 2000 + index, hps: 20 });
    }
    addFight("earlier-same-day", { sessionIndex: 0, startedAt: new Date("2026-09-06T18:00:00Z") });
    addFight("a-first", {}, { dps: 13900, hps: 125 });
    addFight("z-same-time", {}, { dps: 999999, hps: 99999 });
    addFight("a-later-best", { startedAt: new Date("2026-09-06T21:10:00Z") }, { dps: 999999, hps: 99999 });
    addFight("a-short", { bossId: "gunship", durationMs: 500, durationSeconds: 0 }, { dps: 7920, hps: 0 });
    addFight("a-invalid", { bossId: "saurfang", durationMs: -1 }, { dps: 999999, hps: 99999 });
    addFight("b-zero", { uploadId: "recent-b", sessionIndex: 0 }, { dps: 0, hps: 0 });
    addFight("b-legacy", { uploadId: "recent-b", sessionIndex: 0, bossId: "saurfang", durationMs: 0 }, { dps: 14100, hps: 50 });
    addFight("earlier-wipe", { startedAt: new Date("2026-09-06T20:00:00Z"), outcome: "WIPE" }, { dps: 900000 });
    addFight("earlier-unknown", { startedAt: new Date("2026-09-06T19:00:00Z"), outcome: "UNKNOWN" }, { dps: 900000 });
    for (const difficulty of ["10N", "25N", "UNKNOWN", "25H_LEGACY"]) {
      addFight(`other-mode-${difficulty}`, { difficulty, startedAt: new Date("2026-09-05T20:00:00Z") }, { dps: 888888 });
    }
    addFight("other-raid", { bossId: "halion", startedAt: new Date("2026-09-05T20:00:00Z") }, { dps: 777777 });
    addFight("wipe-only-scope", { bossId: "halion", difficulty: "10H", outcome: "WIPE", startedAt: new Date("2026-09-07T20:00:00Z") });
    addFight("namesake-later", { uploadId: "namesake-only", sessionIndex: 0, startedAt: new Date("2026-09-08T20:00:00Z") }, { playerId: "namesake", dps: 666666 });
    addFight("no-kills", { outcome: "WIPE" }, { playerId: "no-kills" });
    participants.push({
      id: "namesake-shared-encounter", encounterId: "a-first", playerId: "namesake", dps: 555555, hps: 555555,
    });
    await database.encounter.createMany({ data: encounters });
    await database.participant.createMany({ data: participants });

    const started = performance.now();
    const result = await getPlayerRaidComparison(observedDatabase, "subject", { difficulty: "25H" });
    const loadAndBuildMilliseconds = performance.now() - started;
    assert.equal(result.raidSlug, "icecrown-citadel");
    assert.equal(result.difficulty, "25H");
    assert.equal(result.sessions.length, 250, "Every stored matching session is included beyond 50 encounters");
    assert.equal(new Set(result.sessions.map(session => session.key)).size, 250);
    assert.equal(new Set(result.sessions.filter(session => session.startedAt.startsWith("2026-09-06")).map(session => session.label)).size, 3);
    assert.deepEqual(result.runs.map(run => run.key), result.sessions.map(session => session.key), "Every session has complete run data in newest-first order");
    assert.deepEqual(result.runs.slice(0, 3).map(run => run.key), ["recent-a:1", "recent-b:0", "recent-a:0"], "Tied starts retain deterministic order");
    assert.equal(result.runs.at(-1)?.key, "history:0");
    assert.deepEqual(result.runs.at(-1)?.fights.map(fight => fight.dps), [1000, 2000], "The oldest run keeps all of its bosses");
    assert.equal(result.runs.reduce((total, run) => total + run.fights.length, 0), 500);
    assert.deepEqual(result.runs[0].fights.map(fight => [fight.encounterId, fight.dps, fight.hps]), [
      ["a-first", 13900, 125], ["a-short", 7920, 0], ["a-invalid", null, null],
    ], "Earliest successful kill wins, short kills remain, invalid duration is unavailable, and HPS excludes absorbs");
    assert.deepEqual(result.runs[1].fights.map(fight => [fight.encounterId, fight.dps, fight.hps]), [
      ["b-zero", 0, 0], ["b-legacy", 14100, 50],
    ]);
    const chart = buildRaidComparisonChart(result.runs);
    assert.ok(chart.every(row => Object.keys(row.values).length === 250), "Chart alignment includes all 250 dated lines");
    assert.equal(chart.find(row => row.bossSlug === "marrowgar")?.values["history:0"]?.dps, 1000);
    assert.equal(chart.find(row => row.bossSlug === "gunship")?.values["recent-b:0"], null);
    assert.equal(chart.find(row => row.bossSlug === "marrowgar")?.values["recent-b:0"]?.dps, 0);
    assert.deepEqual(result.scopes.map(scope => `${scope.raidSlug}:${scope.difficulty}`).sort(), [
      "icecrown-citadel:10", "icecrown-citadel:10N", "icecrown-citadel:25", "icecrown-citadel:25H", "icecrown-citadel:25H_LEGACY",
      "icecrown-citadel:25N", "icecrown-citadel:UNKNOWN", "ruby-sanctum:25", "ruby-sanctum:25H",
    ]);
    assert.equal(detailQueries.length, 1);
    assert.deepEqual(detailQueries[0].where, {
      playerId: "subject",
      encounter: {
        outcome: "KILL", difficulty: "25H", boss: { raidSlug: "icecrown-citadel" },
      },
    }, "One lean detail query loads all runs for the player, raid, difficulty and successful outcome");
    assert.equal(detailQueries[0].take, undefined, "Recorded history is never truncated by an encounter cap");
    assert.deepEqual(Object.keys(detailQueries[0].select!).sort(), ["dps", "encounter", "hps", "spec"]);
    assert.doesNotMatch(JSON.stringify(detailQueries[0]), /spellBreakdown|targetBreakdown|absorbBreakdown|sessionAnalytics/);

    const normal = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "icecrown-citadel", difficulty: "25N" });
    assert.equal(normal.runs.length, 1);
    assert.deepEqual(normal.runs[0].fights.map(fight => fight.encounterId), ["other-mode-25N"]);
    const unknown = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "icecrown-citadel", difficulty: "UNKNOWN" });
    assert.deepEqual(unknown.runs[0].fights.map(fight => fight.encounterId), ["other-mode-UNKNOWN"]);
    const legacy = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "icecrown-citadel", difficulty: "25H_LEGACY" });
    assert.deepEqual(legacy.runs[0].fights.map(fight => fight.encounterId), ["other-mode-25H_LEGACY"], "Unsupported stored modes remain distinct");
    const ruby = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "ruby-sanctum", difficulty: "25H" });
    assert.deepEqual(ruby.runs[0].fights.map(fight => fight.encounterId), ["other-raid"]);
    const defaults = await getPlayerRaidComparison(observedDatabase, "subject");
    assert.equal(defaults.difficulty, "25");
    assert.equal(defaults.runs.length, 250);
    assert.ok(defaults.runs.every(run => run.fights.every(fight => ["25N", "25H"].includes(fight.difficulty))));
    const tampered = await getPlayerRaidComparison(observedDatabase, "subject", {
      raid: "forged-raid", difficulty: "forged-mode",
    });
    assert.deepEqual(tampered.runs, defaults.runs, "An invalid scope falls back to all runs in a known combined size");
    const namesake = await getPlayerRaidComparison(observedDatabase, "namesake");
    assert.deepEqual(namesake.runs.map(run => run.key), ["namesake-only:0", "recent-a:1"]);
    assert.equal(namesake.runs[1].fights[0].dps, 555555, "Same-name characters in separate realms remain separate identities");
    const beforeEmpty = detailQueries.length;
    assert.deepEqual(await getPlayerRaidComparison(observedDatabase, "no-kills"), {
      scopes: [], raidSlug: "", difficulty: "", sessions: [], runs: [],
    });
    assert.deepEqual(await getPlayerRaidComparison(observedDatabase, "missing-player"), {
      scopes: [], raidSlug: "", difficulty: "", sessions: [], runs: [],
    });
    assert.equal(detailQueries.length, beforeEmpty, "Players without kills never load participant details");
    for (const query of detailQueries) {
      const where = query.where?.encounter as Prisma.EncounterWhereInput;
      assert.equal(where.OR, undefined, "No session OR list limits or inflates the scoped history query");
      assert.equal(query.take, undefined);
      assert.equal(query.skip, undefined);
    }
    if (process.env.PIZZA_RAID_COMPARISON_BENCHMARK === "1") {
      context.diagnostic(JSON.stringify({
        runs: result.runs.length,
        storedBossValues: result.runs.reduce((total, run) => total + run.fights.length, 0),
        detailQueryMilliseconds: Math.round(detailQueryMilliseconds[0] * 100) / 100,
        loadAndBuildMilliseconds: Math.round(loadAndBuildMilliseconds * 100) / 100,
        serializedBytes: Buffer.byteLength(JSON.stringify(result), "utf8"),
      }));
    }
  } finally {
    await database.$disconnect();
  }
});

test("combined size scope restores all twelve ICC bosses across three mixed normal and heroic runs", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `raid_mixed_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
  try {
    const icc = WOTLK_BOSSES.filter(boss => boss.raidSlug === "icecrown-citadel");
    await database.boss.createMany({ data: icc.map(boss => ({
      id: boss.slug, slug: boss.slug, name: boss.name, raid: boss.raid, raidSlug: boss.raidSlug, sortOrder: boss.sortOrder,
    })) });
    await database.realm.createMany({ data: [
      { id: "realm-a", name: "Test Realm A", host: "test-a" },
      { id: "realm-b", name: "Test Realm B", host: "test-b" },
    ] });
    await database.player.createMany({ data: [
      { id: "mixed", name: "Twin", realmId: "realm-a", class: "Rogue" },
      { id: "namesake", name: "Twin", realmId: "realm-b", class: "Rogue" },
      { id: "unknown-only", name: "UnknownOnly", realmId: "realm-a", class: "Rogue" },
    ] });
    await database.upload.create({ data: {
      id: "mixed-upload", filename: "mixed.synthetic.txt", fileHash: schema, fileSize: 100, status: "DONE",
    } });
    const encounters: Prisma.EncounterCreateManyInput[] = [];
    const participants: Prisma.ParticipantCreateManyInput[] = [];
    const addFight = (
      id: string, bossIndex: number, difficulty: string, sessionIndex: number, startedAt: Date,
      options: { playerId?: string; dps?: number; outcome?: "KILL" | "WIPE" } = {},
    ) => {
      encounters.push({
        id, fingerprint: id, uploadId: "mixed-upload", bossId: icc[bossIndex].slug,
        difficulty, sessionIndex, groupSize: difficulty.startsWith("10") ? 10 : 25,
        outcome: options.outcome ?? "KILL", durationMs: 60_000, durationSeconds: 60,
        startedAt, endedAt: new Date(startedAt.getTime() + 60_000),
      });
      participants.push({
        id: `participant-${id}`, encounterId: id, playerId: options.playerId ?? "mixed",
        dps: options.dps ?? 10000 + sessionIndex * 100 + bossIndex, hps: 25, aps: 999999, spec: "Combat",
      });
    };
    const normalBosses = new Set([1, 6, 8, 10, 11]);
    for (let run = 0; run < 3; run++) {
      for (let boss = 0; boss < icc.length; boss++) {
        addFight(`mixed-${run}-${boss}`, boss, normalBosses.has(boss) ? "25N" : "25H", run,
          new Date(Date.UTC(2026, 7, 23 + run * 7, 18, boss * 5)),
          run === 0 && boss === 0 ? { dps: 0 } : {});
      }
    }
    addFight("later-duplicate", 0, "25H", 2, new Date("2026-09-06T23:00:00Z"), { dps: 999999 });
    addFight("ten-normal", 0, "10N", 3, new Date("2026-09-05T18:00:00Z"));
    addFight("ten-heroic", 1, "10H", 3, new Date("2026-09-05T18:10:00Z"));
    addFight("unknown", 0, "UNKNOWN", 4, new Date("2026-09-07T18:00:00Z"));
    addFight("custom", 0, "25H_LEGACY", 5, new Date("2026-09-08T18:00:00Z"));
    addFight("wipe", 0, "25H", 6, new Date("2026-09-09T18:00:00Z"), { outcome: "WIPE" });
    addFight("other-realm", 0, "25H", 7, new Date("2026-09-10T18:00:00Z"), { playerId: "namesake", dps: 999999 });
    addFight("only-unknown", 0, "UNKNOWN", 8, new Date("2026-09-11T18:00:00Z"), { playerId: "unknown-only" });
    participants.push({ id: "namesake-shared-fight", playerId: "namesake", encounterId: "mixed-2-0", dps: 999999, hps: 999999 });
    await database.encounter.createMany({ data: encounters });
    await database.participant.createMany({ data: participants });

    const combined = await getPlayerRaidComparison(database, "mixed");
    assert.equal(combined.difficulty, "25", "A later unknown or custom record does not replace the newest known-size default");
    assert.deepEqual(combined.runs.map(run => run.key), ["mixed-upload:2", "mixed-upload:1", "mixed-upload:0"]);
    assert.ok(combined.runs.every(run => run.fights.length === 12));
    assert.equal(combined.runs[0].fights[0].encounterId, "mixed-2-0");
    assert.equal(combined.runs[0].fights[0].dps, 10200, "A later duplicate or same-name participant cannot replace the original kill");
    const combinedChart = buildRaidComparisonChart(combined.runs, combined.raidSlug);
    assert.deepEqual(combinedChart.map(row => row.bossSlug), icc.map(boss => boss.slug));
    for (const run of combined.runs) {
      assert.equal(combinedChart.filter(row => row.values[run.key]?.dps != null).length, 12);
      assert.equal(run.fights.filter(fight => fight.difficulty === "25N").length, 5);
      assert.equal(run.fights.filter(fight => fight.difficulty === "25H").length, 7);
    }
    assert.equal(combinedChart[0].values["mixed-upload:0"]?.dps, 0);
    assert.equal(combinedChart[0].values["mixed-upload:0"]?.difficulty, "25H");
    assert.equal(combinedChart[1].values["mixed-upload:0"]?.difficulty, "25N");
    const raidDefault = await getPlayerRaidComparison(database, "mixed", { raid: "icecrown-citadel" });
    assert.deepEqual(raidDefault.runs, combined.runs);

    for (const [difficulty, count] of [["25N", 5], ["25H", 7]] as const) {
      const exact = await getPlayerRaidComparison(database, "mixed", { raid: "icecrown-citadel", difficulty });
      assert.equal(exact.difficulty, difficulty);
      assert.equal(exact.runs.length, 3);
      assert.ok(exact.runs.every(run => run.fights.length === count && run.fights.every(fight => fight.difficulty === difficulty)));
      const exactChart = buildRaidComparisonChart(exact.runs, exact.raidSlug);
      assert.equal(exactChart.length, 12, "An exact-mode view retains all canonical positions");
      assert.equal(exactChart.filter(row => row.values[exact.runs[0].key] !== null).length, count);
    }
    const ten = await getPlayerRaidComparison(database, "mixed", { raid: "icecrown-citadel", difficulty: "10" });
    assert.equal(ten.runs.length, 1);
    assert.deepEqual(ten.runs[0].fights.map(fight => fight.difficulty), ["10N", "10H"]);
    const tenNormal = await getPlayerRaidComparison(database, "mixed", { raid: "icecrown-citadel", difficulty: "10N" });
    const tenHeroic = await getPlayerRaidComparison(database, "mixed", { raid: "icecrown-citadel", difficulty: "10H" });
    assert.deepEqual(tenNormal.runs[0].fights.map(fight => fight.encounterId), ["ten-normal"]);
    assert.deepEqual(tenHeroic.runs[0].fights.map(fight => fight.encounterId), ["ten-heroic"]);
    for (const difficulty of ["UNKNOWN", "25H_LEGACY"]) {
      const exact = await getPlayerRaidComparison(database, "mixed", { raid: "icecrown-citadel", difficulty });
      assert.equal(exact.runs.length, 1);
      assert.equal(exact.runs[0].fights.length, 1);
      assert.equal(exact.runs[0].fights[0].difficulty, difficulty);
    }
    const unknownOnly = await getPlayerRaidComparison(database, "unknown-only");
    assert.equal(unknownOnly.difficulty, "UNKNOWN");
    assert.equal(unknownOnly.runs[0].fights[0].encounterId, "only-unknown");
    for (const difficulty of ["25N", "10H", "10", "UNKNOWN"]) {
      const empty = await getPlayerRaidComparison(database, "namesake", { raid: "icecrown-citadel", difficulty });
      assert.equal(empty.difficulty, difficulty, "Explicit absent modes must not silently show another difficulty");
      assert.deepEqual(empty.sessions, []);
      assert.deepEqual(empty.runs, []);
      assert.equal(empty.scopes.filter(scope => scope.raidSlug === "icecrown-citadel" && scope.difficulty === difficulty).length, 1);
      assert.equal(empty.scopes.length, 3, "Only the requested empty mode joins the two available choices");
    }
    const withoutRaid = await getPlayerRaidComparison(database, "namesake", { difficulty: "25N" });
    assert.equal(withoutRaid.raidSlug, "icecrown-citadel");
    assert.equal(withoutRaid.difficulty, "25N");
    assert.deepEqual(withoutRaid.runs, []);
    const invalid = await getPlayerRaidComparison(database, "namesake", { raid: "icecrown-citadel", difficulty: "UNSUPPORTED-ABSENT" });
    assert.equal(invalid.difficulty, "25");
    assert.equal(invalid.runs.length, 2, "Unrecognized absent parameters still use the known-size default");
  } finally {
    await database.$disconnect();
  }
});
