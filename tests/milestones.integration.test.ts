import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { computeMilestones } from "../lib/actions/milestones";

const connection = process.env.TEST_DATABASE_URL;

test("PostgreSQL milestone scopes, weekly eligibility, distinct-player ranks and retries", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async t => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `milestone_test_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection! }, { schema }) });
  const now = new Date("2026-09-04T12:00:00Z");
  const current = new Date("2026-09-03T10:00:00Z");
  const historical = new Date("2026-08-20T10:00:00Z");
  let nextId = 0;
  try {
    await database.upload.create({ data: { id: "upload", filename: "synthetic.txt", fileHash: "synthetic-milestones", fileSize: 100, status: "DONE" } });
    const boss = async (id: string) => database.boss.create({ data: { id, name: id, slug: id, raid: "Synthetic", raidSlug: "synthetic" } });
    const check = async (bossId: string, playerName: string, value: number, startedAt: Date) => {
      const playerId = `${bossId}-${playerName}`;
      await database.player.upsert({ where: { id: playerId }, create: { id: playerId, name: playerName }, update: {} });
      const encounterId = `encounter-${String(nextId++).padStart(4, "0")}`;
      await database.encounter.create({ data: {
        id: encounterId, uploadId: "upload", bossId, fingerprint: encounterId,
        outcome: "KILL", difficulty: "25N", groupSize: 25, durationSeconds: 30,
        startedAt, endedAt: new Date(startedAt.getTime() + 30_000),
        participants: { create: { playerId, dps: value } },
      } });
      return { playerId, playerName, encounterId, bossId, bossName: bossId,
        difficulty: "25N", metric: "DPS" as const, value, startedAt };
    };

    await t.test("weekly best can be outside the all-time podium", async () => {
      await boss("weekly-outside-podium");
      for (const [index, value] of [5000, 4000, 3000, 2000].entries()) {
        await check("weekly-outside-podium", `Older${index}`, value, historical);
      }
      const currentBest = await check("weekly-outside-podium", "ThisWeek", 1000, current);
      const awards = await computeMilestones([currentBest], database, now);
      assert.deepEqual(awards.map(award => award.type), ["WEEKLY_BEST"]);
      assert.equal(awards[0].rank, 1);
    });

    await t.test("historical and future encounters cannot earn the current weekly award", async () => {
      await boss("outside-week");
      const old = await check("outside-week", "Historical", 10_000, historical);
      assert.deepEqual((await computeMilestones([old], database, now)).map(award => award.type), ["ALL_TIME_RANK"]);
      const future = await check("outside-week", "Future", 20_000, new Date("2026-09-09T09:00:00Z"));
      assert.deepEqual((await computeMilestones([future], database, now)).map(award => award.type), ["ALL_TIME_RANK"]);
      assert.equal(await database.milestone.count({ where: { bossId: "outside-week", type: "WEEKLY_BEST" } }), 0);
    });

    await t.test("an existing higher personal best does not suppress a lower current weekly best", async () => {
      await boss("personal-best");
      const old = await check("personal-best", "SamePlayer", 5000, historical);
      await computeMilestones([old], database, now);
      const week = await check("personal-best", "SamePlayer", 3000, current);
      const awards = await computeMilestones([week], database, now);
      assert.deepEqual(awards.map(award => award.type), ["WEEKLY_BEST"]);
      assert.equal(awards[0].value, 3000);
      assert.equal(await database.milestone.count({ where: { bossId: "personal-best", type: "ALL_TIME_RANK" } }), 1);
    });

    await t.test("batch reduction keeps the separate historical and weekly maxima", async () => {
      await boss("mixed-batch");
      const old = await check("mixed-batch", "SamePlayer", 5000, historical);
      const week = await check("mixed-batch", "SamePlayer", 3000, current);
      const awards = await computeMilestones([week, old], database, now);
      assert.deepEqual(awards.map(award => [award.type, award.value]).sort(), [["ALL_TIME_RANK", 5000], ["WEEKLY_BEST", 3000]]);
    });

    await t.test("ties use competition rank and repeated attempts count one player", async () => {
      await boss("ties");
      for (const value of [5000, 4500, 4000]) await check("ties", "Leader", value, historical);
      const second = await check("ties", "Second", 3000, current);
      const tied = await check("ties", "Tied", 3000, current);
      const fourth = await check("ties", "Fourth", 2000, current);
      const awards = await computeMilestones([second, tied, fourth], database, now);
      assert.deepEqual(awards.filter(award => award.type === "ALL_TIME_RANK").map(award => [award.playerName, award.rank]),
        [["Second", 2], ["Tied", 2]]);
      assert.equal(awards.filter(award => award.type === "WEEKLY_BEST").length, 2);
    });

    await t.test("concurrent repeats cannot create duplicate active awards", async () => {
      await boss("concurrent");
      const candidate = await check("concurrent", "SamePlayer", 5000, current);
      const awards = await Promise.all([
        computeMilestones([candidate], database, now), computeMilestones([candidate], database, now),
      ]);
      assert.equal(awards.flat().length, 2);
      assert.equal(await database.milestone.count({ where: { bossId: "concurrent", supersededAt: null } }), 2);
      assert.deepEqual(await computeMilestones([candidate], database, now), []);
    });
  } finally {
    await database.$disconnect();
  }
});
