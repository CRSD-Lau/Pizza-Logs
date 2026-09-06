import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { getPlayerRaidComparison } from "../lib/player-raid-comparison.server";
import { buildRaidComparisonChart } from "../lib/player-raid-comparison";

const connection = process.env.TEST_DATABASE_URL;

test("player raid comparison groups full isolated history and loads only two complete scoped runs", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `raid_compare_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
  const detailQueries: Prisma.ParticipantFindManyArgs[] = [];
  const observedDatabase = {
    encounter: database.encounter,
    boss: database.boss,
    participant: new Proxy(database.participant, {
      get(target, property, receiver) {
        if (property === "findMany") return (args: Prisma.ParticipantFindManyArgs) => {
          detailQueries.push(args);
          return database.participant.findMany(args);
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

    // Sixty old sessions and 120 encounters precede the current runs. A latest-50
    // participant window cannot discover the oldest selectable session.
    for (let index = 0; index < 60; index++) {
      addFight(`history-${index}-marrowgar`, {
        uploadId: "history", sessionIndex: index, startedAt: new Date(Date.UTC(2026, 6, index + 1, 18)),
      }, { dps: 1000 + index, hps: 10 });
      addFight(`history-${index}-gunship`, {
        uploadId: "history", sessionIndex: index, bossId: "gunship", startedAt: new Date(Date.UTC(2026, 6, index + 1, 19)),
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

    const result = await getPlayerRaidComparison(observedDatabase, "subject");
    assert.equal(result.raidSlug, "icecrown-citadel");
    assert.equal(result.difficulty, "25H");
    assert.equal(result.sessions.length, 63, "All stored matching sessions remain selectable beyond 50 encounters");
    assert.equal(new Set(result.sessions.map(session => session.key)).size, 63);
    assert.equal(new Set(result.sessions.filter(session => session.startedAt.startsWith("2026-09-06")).map(session => session.label)).size, 3);
    assert.deepEqual(result.runs.map(run => run.key), ["recent-a:1", "recent-b:0"], "Stable defaults retain selector positions for tied session starts");
    assert.deepEqual(result.runs[0].fights.map(fight => [fight.encounterId, fight.dps, fight.hps]), [
      ["a-first", 13900, 125], ["a-short", 7920, 0], ["a-invalid", null, null],
    ], "Earliest successful kill wins, short kills remain, invalid duration is unavailable, and HPS excludes absorbs");
    assert.deepEqual(result.runs[1].fights.map(fight => [fight.encounterId, fight.dps, fight.hps]), [
      ["b-zero", 0, 0], ["b-legacy", 14100, 50],
    ]);
    const chart = buildRaidComparisonChart(result.runs);
    assert.equal(chart.find(row => row.bossSlug === "gunship")?.values["recent-b:0"], null);
    assert.equal(chart.find(row => row.bossSlug === "marrowgar")?.values["recent-b:0"]?.dps, 0);
    assert.deepEqual(result.scopes.map(scope => `${scope.raidSlug}:${scope.difficulty}`).sort(), [
      "icecrown-citadel:10N", "icecrown-citadel:25H", "icecrown-citadel:25H_LEGACY",
      "icecrown-citadel:25N", "icecrown-citadel:UNKNOWN", "ruby-sanctum:25H",
    ]);
    assert.equal(detailQueries.length, 1);
    assert.deepEqual(detailQueries[0].where, {
      playerId: "subject",
      encounter: {
        outcome: "KILL", difficulty: "25H", boss: { raidSlug: "icecrown-citadel" },
        OR: [
          { uploadId: "recent-a", sessionIndex: 1 }, { uploadId: "recent-b", sessionIndex: 0 },
        ],
      },
    }, "The detail query is limited to the selected two stored session identities");
    assert.equal(detailQueries[0].take, undefined, "A selected raid is never truncated by an encounter cap");
    assert.deepEqual(Object.keys(detailQueries[0].select!).sort(), ["dps", "encounter", "hps", "spec"]);

    const older = await getPlayerRaidComparison(observedDatabase, "subject", { first: "history:0", second: "recent-a:1" });
    assert.deepEqual(older.runs.map(run => run.key), ["history:0", "recent-a:1"]);
    assert.deepEqual(older.runs[0].fights.map(fight => fight.dps), [1000, 2000], "The oldest selected session returns its complete kill set");
    const normal = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "icecrown-citadel", difficulty: "25N" });
    assert.equal(normal.runs.length, 1);
    assert.deepEqual(normal.runs[0].fights.map(fight => fight.encounterId), ["other-mode-25N"]);
    const unknown = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "icecrown-citadel", difficulty: "UNKNOWN" });
    assert.deepEqual(unknown.runs[0].fights.map(fight => fight.encounterId), ["other-mode-UNKNOWN"]);
    const legacy = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "icecrown-citadel", difficulty: "25H_LEGACY" });
    assert.deepEqual(legacy.runs[0].fights.map(fight => fight.encounterId), ["other-mode-25H_LEGACY"], "Unsupported stored modes remain distinct");
    const ruby = await getPlayerRaidComparison(observedDatabase, "subject", { raid: "ruby-sanctum", difficulty: "25H" });
    assert.deepEqual(ruby.runs[0].fights.map(fight => fight.encounterId), ["other-raid"]);
    const tampered = await getPlayerRaidComparison(observedDatabase, "subject", {
      raid: "forged-raid", difficulty: "forged-mode", first: "namesake-only:0", second: "__proto__",
    });
    assert.deepEqual(tampered.runs, result.runs, "Invalid scope and another player's session keys fall back to stored choices");
    const duplicate = await getPlayerRaidComparison(observedDatabase, "subject", { first: "recent-a:1", second: "recent-a:1" });
    assert.deepEqual(duplicate.runs.map(run => run.key), ["recent-a:1", "recent-b:0"]);
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
      assert.ok(Array.isArray(where.OR) && where.OR.length <= 2);
    }
  } finally {
    await database.$disconnect();
  }
});
