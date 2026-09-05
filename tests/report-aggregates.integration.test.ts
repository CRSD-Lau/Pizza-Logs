import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { bossAggregateQuery, weeklyAggregateQuery, type BossAggregate, type WeeklyAggregate } from "../lib/report-aggregates";
import { buildWeeklyBossKills } from "../lib/weekly-stats";
import { sortByICCOrder } from "../lib/constants/bosses";

const connection = process.env.TEST_DATABASE_URL;

test("PostgreSQL report aggregates preserve filtering, totals, all-outcome maxima and deterministic ties", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `aggregate_test_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection! }, { schema }) });
  const start = new Date("2026-09-02T09:00:00Z");
  const end = new Date("2026-09-09T09:00:00Z");
  const bosses = [
    { id: "boss-a", name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel" },
    { id: "boss-b", name: "Rotface", slug: "rotface", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel" },
    { id: "boss-c", name: "Halion", slug: "halion", raid: "The Ruby Sanctum", raidSlug: "ruby-sanctum" },
  ];
  try {
    await db.realm.createMany({ data: [
      { id: "realm-a", name: "Synthetic A", host: "test" },
      { id: "realm-b", name: "Synthetic B", host: "test" },
    ] });
    await db.boss.createMany({ data: bosses });
    await db.upload.createMany({ data: ["a", "b"].map(realm => ({
      id: `upload-${realm}`, filename: "synthetic.txt", fileHash: `hash-${realm}`, fileSize: 100,
      realmId: `realm-${realm}`, status: "DONE", createdAt: start,
    })) });
    await db.player.createMany({ data: [0, 1, 2].map(index => ({ id: `player-${index}`, name: `Synthetic${index}`, class: "MAGE" })) });
    const encounterData: Prisma.EncounterCreateManyInput[] = Array.from({ length: 1000 }, (_, index) => ({
      id: `encounter-${String(index).padStart(4, "0")}`, fingerprint: `synthetic-${index}`,
      uploadId: index < 500 ? "upload-a" : "upload-b", bossId: bosses[index % bosses.length].id,
      outcome: (["KILL", "WIPE", "UNKNOWN"] as const)[Math.floor(index / 3) % 3],
      difficulty: index % 2 ? "25H" : "10N", groupSize: index % 2 ? 25 : 10,
      durationSeconds: 20 + index % 80,
      startedAt: index === 999 ? end : new Date(start.getTime() + index * 1000),
      endedAt: new Date(start.getTime() + index * 1000 + 100_000),
    }));
    await db.encounter.createMany({ data: encounterData });
    await db.participant.createMany({ data: encounterData.flatMap((encounter, index) => [0, 1, 2].map(player => ({
      id: `participant-${String(index).padStart(4, "0")}-${player}`, encounterId: encounter.id!, playerId: `player-${player}`,
      dps: index * 3 + player, hps: index + player,
      deaths: 1,
      spellBreakdown: { synthetic: { damage: 100, healing: 0, hits: 1, crits: 0, school: 1 } },
      deathEvents: [{ offsetSeconds: 2, recentDamage: [{ spell: "Synthetic", amount: 100 }] }],
    }))) });

    await db.$transaction(async tx => {
      // Generated identifier only. Raw queries intentionally use the same local
      // search path as Prisma's schema-qualified fixture operations.
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      const legacyBosses = (filters: { realmId?: string; difficulty?: string; raidSlug?: string }) => tx.boss.findMany({
        where: filters.raidSlug ? { raidSlug: filters.raidSlug } : undefined,
        orderBy: { id: "asc" },
        include: { encounters: {
          where: { ...(filters.realmId ? { upload: { realmId: filters.realmId } } : {}),
            ...(filters.difficulty ? { difficulty: filters.difficulty } : {}) },
          orderBy: { id: "asc" },
          select: { id: true, outcome: true, durationSeconds: true, participants: {
            orderBy: [{ dps: "desc" }, { id: "asc" }], take: 1,
            select: { dps: true, player: { select: { name: true } } },
          } },
        } },
      });
      for (const filters of [{}, { realmId: "realm-a" }, { difficulty: "25H" }, { raidSlug: "ruby-sanctum", realmId: "realm-b" }]) {
        const [old, aggregates] = await Promise.all([
          legacyBosses(filters), tx.$queryRaw<BossAggregate[]>(bossAggregateQuery(filters)),
        ]);
        for (const boss of old) {
          const row = aggregates.find(value => value.bossId === boss.id);
          const kills = boss.encounters.filter(value => value.outcome === "KILL");
          const best = boss.encounters.flatMap(value => value.participants).sort((a, b) => b.dps - a.dps)[0];
          assert.equal(row?.totalPulls ?? 0, boss.encounters.length);
          assert.equal(row?.killCount ?? 0, kills.length);
          assert.equal(row?.wipeCount ?? 0, boss.encounters.filter(value => value.outcome === "WIPE").length);
          assert.equal(row?.fastestKill ?? null, kills.length ? Math.min(...kills.map(value => value.durationSeconds)) : null);
          assert.equal(row?.dps ?? null, best?.dps ?? null);
          assert.equal(row?.playerName ?? null, best?.player.name ?? null);
        }
      }
      assert.deepEqual(await tx.$queryRaw(bossAggregateQuery({ realmId: "' OR 1=1 --" })), []);
      const oldWeekly = () => tx.encounter.findMany({
        where: { startedAt: { gte: start, lt: end } },
        include: { boss: { select: { name: true, slug: true, raid: true } }, participants: {
          orderBy: { dps: "desc" }, take: 1, include: { player: { select: { name: true, class: true } } },
        } }, orderBy: { startedAt: "desc" },
      });
      const [oldWeek, newWeek] = await Promise.all([
        oldWeekly(), tx.$queryRaw<WeeklyAggregate[]>(weeklyAggregateQuery(start, end)),
      ]);
      const aggregateKills = sortByICCOrder(newWeek.filter(row => row.outcome === "KILL")
        .map(row => ({ name: row.name, slug: row.slug, raid: row.raid, kills: row.count })), row => row.name);
      assert.deepEqual(aggregateKills, buildWeeklyBossKills(oldWeek.filter(row => row.outcome === "KILL")));
      assert.equal(newWeek.reduce((total, row) => total + row.count, 0), 999, "Upper week bound stays exclusive");
      const realmWeek = await tx.$queryRaw<WeeklyAggregate[]>(weeklyAggregateQuery(start, end, "realm-a"));
      assert.equal(realmWeek.reduce((total, row) => total + row.count, 0), 500);

      // Best damage keeps all outcomes; a wipe can win, including deterministic ties.
      await tx.encounter.update({ where: { id: "encounter-0000" }, data: { outcome: "WIPE" } });
      await tx.participant.updateMany({ where: { encounterId: "encounter-0000" }, data: { dps: 100_000 } });
      const tie = (await tx.$queryRaw<BossAggregate[]>(bossAggregateQuery({}))).find(row => row.bossId === "boss-a")!;
      assert.ok(tie);
      assert.equal(tie.dps, 100_000);
      assert.equal(tie.playerName, "Synthetic0");

      const measurements = [];
      for (const [name, query] of [
        ["bosses-before", () => legacyBosses({})],
        ["bosses-after", () => tx.$queryRaw<BossAggregate[]>(bossAggregateQuery({}))],
        ["weekly-before", oldWeekly],
        ["weekly-after", () => tx.$queryRaw<WeeklyAggregate[]>(weeklyAggregateQuery(start, end))],
      ] as const) {
        const timings: number[] = [];
        let rows: unknown = [];
        for (let index = 0; index < 20; index++) {
          const began = performance.now();
          rows = await query();
          if (index >= 5) timings.push(performance.now() - began);
        }
        timings.sort((a, b) => a - b);
        measurements.push({ name, measuredSamples: timings.length, p50Ms: timings[7], p95Ms: timings[14],
          serializedBytes: Buffer.byteLength(JSON.stringify(rows)) });
      }
      const report = { author: "Neil Mitchell", modifier: "Neil Mitchell", recordedAt: new Date().toISOString(),
        syntheticEncounters: 1000, syntheticParticipants: 3000, measurements };
      if (process.env.AGGREGATE_BENCHMARK_OUTPUT) writeFileSync(process.env.AGGREGATE_BENCHMARK_OUTPUT, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report));
    }, { timeout: 60_000 });
  } finally {
    await db.$disconnect();
  }
});
