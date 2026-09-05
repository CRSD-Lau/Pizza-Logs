import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { countAttempts, isShortPull } from "../lib/attempt-policy";
import { countedAttemptWhere, shortPullWhere } from "../lib/attempt-policy.server";
import { bossAggregateQuery, weeklyAggregateQuery, type BossAggregate, type WeeklyAggregate } from "../lib/report-aggregates";
import { getWeekBounds } from "../lib/utils";

const connection = process.env.TEST_DATABASE_URL;

test("short-pull policy agrees across SQL, Prisma and count APIs while preserving the recorded inventory", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `attempt_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  // Raw aggregate queries use the same isolated schema as Prisma's qualified queries.
  url.searchParams.set("options", `-c search_path=${schema}`);
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
  const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
  const previous = globalDatabase.prisma;
  globalDatabase.prisma = database;
  const { start, end } = getWeekBounds();
  const cases = [
    { id: "brief", outcome: "WIPE", durationMs: 7500, durationSeconds: 7, deaths: [0, 0], short: true },
    { id: "legacy", outcome: "WIPE", durationMs: 0, durationSeconds: 3, deaths: [0, 0], short: true },
    { id: "below-boundary", outcome: "WIPE", durationMs: 59999, durationSeconds: 60, deaths: [0, 0], short: true },
    { id: "boundary", outcome: "WIPE", durationMs: 60000, durationSeconds: 59, deaths: [0, 0], short: false },
    { id: "casualties", outcome: "WIPE", durationMs: 24500, durationSeconds: 24, deaths: [0, 3], short: false },
    { id: "brief-kill", outcome: "KILL", durationMs: 2700, durationSeconds: 3, deaths: [0, 0], short: false },
    { id: "brief-unknown", outcome: "UNKNOWN", durationMs: 2700, durationSeconds: 3, deaths: [0, 0], short: false },
    { id: "missing-actors", outcome: "WIPE", durationMs: 3200, durationSeconds: 3, deaths: [], short: false },
    { id: "invalid-duration", outcome: "WIPE", durationMs: -1, durationSeconds: 3, deaths: [0, 0], short: false },
    { id: "zero-duration", outcome: "WIPE", durationMs: 0, durationSeconds: 0, deaths: [0, 0], short: false },
    { id: "invalid-deaths", outcome: "WIPE", durationMs: 3200, durationSeconds: 3, deaths: [0, -1], short: false },
  ] as const;
  try {
    await database.boss.create({ data: { id: "boss", name: "Synthetic Boss", slug: "synthetic-boss", raid: "Synthetic", raidSlug: "synthetic" } });
    await database.realm.create({ data: { id: "realm", name: "Synthetic", host: "test" } });
    await database.upload.create({ data: {
      id: "upload", filename: "synthetic.txt", fileHash: "attempt-policy", fileSize: 100, status: "DONE", realmId: "realm",
      sessionDamage: { "0": 1234567 }, sessionAnalytics: { "0": { totalDamage: 1234567, totalHealing: 2345678 } },
    } });
    await database.player.createMany({ data: [0, 1].map(index => ({ id: `player-${index}`, name: `Synthetic${index}` })) });
    for (const [index, item] of cases.entries()) {
      await database.encounter.create({ data: {
        id: item.id, fingerprint: item.id, bossId: "boss", uploadId: "upload", outcome: item.outcome,
        durationMs: item.durationMs, durationSeconds: item.durationSeconds, difficulty: "25N", groupSize: 25,
        startedAt: new Date(start.getTime() + (index + 1) * 1000), endedAt: new Date(start.getTime() + 100000),
        totalDamage: 1000 + index, totalHealing: 2000 + index, totalAbsorbs: 30,
        participants: { create: item.deaths.map((deaths, player) => ({
          playerId: `player-${player}`, deaths, totalDamage: 500 + index, totalHealing: 1000 + index,
          dps: item.id === "brief" ? 999999 : 100 + index, hps: 150 + index,
        })) },
      } });
    }
    const inventory = () => database.encounter.findMany({ orderBy: { id: "asc" }, include: { participants: { orderBy: { playerId: "asc" } } } });
    const before = await inventory();
    const uploadBefore = await database.upload.findUniqueOrThrow({ where: { id: "upload" } });
    for (const item of before) assert.equal(isShortPull(item), cases.find(row => row.id === item.id)!.short, item.id);
    const expectedShort = cases.filter(item => item.short).map(item => item.id).sort();
    assert.deepEqual((await database.encounter.findMany({ where: shortPullWhere(), select: { id: true } })).map(item => item.id).sort(), expectedShort);
    assert.equal(await database.encounter.count({ where: countedAttemptWhere() }), cases.length - expectedShort.length);
    assert.equal(await database.encounter.count({ where: countedAttemptWhere({ includeShortPulls: true }) }), cases.length);
    for (const includeShortPulls of [false, true]) {
      const counts = countAttempts(before, { includeShortPulls });
      const [boss] = await database.$queryRaw<BossAggregate[]>(bossAggregateQuery({ includeShortPulls }));
      assert.equal(boss.totalPulls, counts.totalPulls);
      assert.equal(boss.wipeCount, counts.wipes);
      assert.equal(boss.killCount, counts.kills);
      assert.equal(boss.shortPullCount, counts.shortPulls);
      assert.equal(boss.dps, 999999, "Excluded counting candidates still retain best-DPS semantics");
      const weekly = await database.$queryRaw<WeeklyAggregate[]>(weeklyAggregateQuery(start, end, "realm", includeShortPulls));
      assert.equal(weekly.reduce((total, row) => total + row.count, 0), counts.totalPulls);
      assert.equal(weekly.reduce((total, row) => total + row.shortPullCount, 0), counts.shortPulls);
      assert.equal(weekly.find(row => row.outcome === "WIPE")!.count, counts.wipes);
    }
    assert.deepEqual(await database.$queryRaw(bossAggregateQuery({ realmId: "absent" })), []);
    assert.deepEqual(await database.$queryRaw(weeklyAggregateQuery(start, end, "absent")), []);

    const bossesApi = await import("../app/api/bosses/route");
    const weeklyApi = await import("../app/api/weekly/route");
    const playerApi = await import("../app/api/players/[name]/route");
    const encountersApi = await import("../app/api/encounters/route");
    for (const includeShortPulls of [false, true]) {
      const suffix = includeShortPulls ? "?includeShortPulls=1" : "";
      const counts = countAttempts(before, { includeShortPulls });
      const bossRows = await (await bossesApi.GET(new NextRequest(`http://localhost/api/bosses${suffix}`))).json();
      assert.equal(bossRows[0].totalPulls, counts.totalPulls);
      assert.equal(bossRows[0].wipeCount, counts.wipes);
      assert.equal(bossRows[0].shortPullCount, 3);
      assert.equal(bossRows[0].bestDps.dps, 999999);
      const week = await (await weeklyApi.GET(new NextRequest(`http://localhost/api/weekly${suffix}`))).json();
      assert.equal(week.totalKills, 1);
      assert.equal(week.totalWipes, counts.wipes);
      assert.equal(week.shortPullCount, 3);
      assert.equal(week.topDps[0].dps, 999999);
      const player = await (await playerApi.GET(new Request(`http://localhost/api/players/Synthetic0${suffix}`), { params: Promise.resolve({ name: "Synthetic0" }) })).json();
      assert.equal(player.stats.totalRecordedEncounters, cases.length - 1);
      assert.equal(player.stats.totalEncounters, counts.totalPulls - 1);
      assert.equal(player.stats.wipeCount, counts.wipes - 1);
      assert.equal(player.stats.shortPullCount, 3);
      assert.equal(player.recentParticipation.length, cases.length - 1);
      assert.equal(player.stats.totalDamage, before.flatMap(item => item.participants).filter(item => item.playerId === "player-0").reduce((sum, item) => sum + item.totalDamage, 0));
      const recorded = await (await encountersApi.GET(new NextRequest(`http://localhost/api/encounters${suffix}`))).json();
      assert.ok(Array.isArray(recorded));
      assert.equal(recorded.length, cases.length, "The raw encounter API keeps every recorded attempt");
    }
    assert.deepEqual(await inventory(), before, "Read policies cannot mutate stored encounters or participant metrics");
    assert.deepEqual(await database.upload.findUniqueOrThrow({ where: { id: "upload" } }), uploadBefore, "Session metrics remain unchanged");
  } finally {
    if (previous === undefined) delete globalDatabase.prisma;
    else globalDatabase.prisma = previous;
    await database.$disconnect();
  }
});
