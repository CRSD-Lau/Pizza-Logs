import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { getAverageLeaderboards } from "../lib/average-leaderboards";

const connection = process.env.TEST_DATABASE_URL;

test("average podiums aggregate all appearances before eligibility and ranking", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a local test database");
  const schema = `average_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
  try {
    await database.realm.createMany({ data: [
      { id: "realm-a", name: "Test Realm A", host: "test-a" },
      { id: "realm-b", name: "Test Realm B", host: "test-b" },
    ] });
    await database.boss.createMany({ data: [
      { id: "boss-a", name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel" },
      { id: "boss-b", name: "Festergut", slug: "festergut", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel" },
    ] });
    await database.upload.create({ data: { id: "upload", filename: "synthetic.txt", fileHash: schema, fileSize: 100, status: "DONE" } });
    const players = [
      { id: "average", name: "Consistent", class: "Mage", realmId: "realm-a" },
      { id: "healer", name: "Shieldandheal", class: "Priest", realmId: "realm-a" },
      { id: "tie-a", name: "Twin", class: "Warrior", realmId: "realm-a" },
      { id: "tie-b", name: "Twin", class: "Warrior", realmId: "realm-b" },
      { id: "tie-more", name: "Morefights", class: "Hunter" },
      { id: "few", name: "Onehugefight", class: "Mage" },
      { id: "zero", name: "Zerooutput", class: "Paladin" },
      { id: "mode", name: "Heroiconly", class: "Warlock" },
      { id: "boss", name: "Wipesonly", class: "Shaman" },
    ];
    await database.player.createMany({ data: players });
    for (let i = 0; i < 11; i++) {
      for (const [scope, bossId, difficulty] of [["normal", "boss-a", "10N"], ["heroic", "boss-a", "25H"], ["wipes", "boss-b", "10N"]]) {
        // Unequal durations make an accidental duration-weighted mean detectably wrong.
        const duration = i === 0 ? 10 : 100;
        const id = `${scope}-${i}`;
        await database.encounter.create({ data: {
          id, fingerprint: id, bossId, uploadId: "upload", difficulty,
          outcome: scope === "wipes" ? "WIPE" : i === 0 ? "KILL" : i === 1 ? "UNKNOWN" : "WIPE",
          durationSeconds: duration, durationMs: i === 1 ? 0 : duration * 1000,
          startedAt: new Date(Date.UTC(2026, 0, 1, 0, i)), endedAt: new Date(Date.UTC(2026, 0, 1, 0, i, duration)),
          participants: { create: scope === "heroic" ? [{ playerId: "mode", dps: 9000, hps: 9000 }] : scope === "wipes" ? [{ playerId: "boss", dps: 8000, hps: 8000 }] : [
            ...(i < 10 ? [
              { playerId: "average", dps: i === 0 ? 10000 : i === 1 ? 0 : 1000, hps: 0, totalDamage: (i === 0 ? 10000 : i === 1 ? 0 : 1000) * duration },
              { playerId: "healer", dps: 0, hps: i === 0 ? 10000 : 0, totalAbsorbs: 999999, aps: 99999 },
              { playerId: "tie-a", dps: 1500, hps: 500 },
              { playerId: "tie-b", dps: 1500, hps: 500 },
              { playerId: "zero", dps: 0, hps: 0 },
            ] : []),
            { playerId: "tie-more", dps: 1500, hps: 500 },
            ...(i < 9 ? [{ playerId: "few", dps: 999999, hps: 999999 }] : []),
          ] },
        } });
      }
    }
    // Neither missing nor corrupt duration evidence can qualify the nine-fight player.
    for (const durationMs of [0, -1]) {
      const id = `invalid-${durationMs}`;
      await database.encounter.create({ data: {
        id, fingerprint: id, bossId: "boss-a", uploadId: "upload", difficulty: "10N", outcome: "KILL",
        durationSeconds: durationMs === 0 ? 0 : 100, durationMs,
        startedAt: new Date(), endedAt: new Date(),
        participants: { create: { playerId: "few", dps: 999999, hps: 999999 } },
      } });
    }
    const normal = await getAverageLeaderboards(database, "10N", "boss-a");
    assert.deepEqual(normal.dps.map(p => [p.playerId, p.value, p.fights]), [
      ["average", 1800, 10], ["tie-more", 1500, 11], ["tie-a", 1500, 10],
    ], "Uses arithmetic means including zeros, wipes, unknown outcomes and short pulls; ties prefer count then ID");
    assert.deepEqual(normal.hps.map(p => [p.playerId, p.value, p.fights]), [
      ["healer", 1000, 10], ["tie-more", 500, 11], ["tie-a", 500, 10],
    ], "Absorbs are not included and zero-healing appearances remain in the denominator");
    assert.equal(normal.dps[2].realm, "Test Realm A", "Same-name characters in different realms are not merged");
    const heroic = await getAverageLeaderboards(database, "25H", "boss-a");
    assert.deepEqual(heroic.dps.map(p => p.playerId), ["mode"]);
    const wipes = await getAverageLeaderboards(database, "10N", "boss-b");
    assert.deepEqual(wipes.hps.map(p => [p.playerId, p.fights]), [["boss", 11]], "A boss with no kills still has averages");
    const all = await getAverageLeaderboards(database, "all");
    assert.deepEqual(all.dps.map(p => p.playerId), ["mode", "boss", "average"]);
    assert.deepEqual(await getAverageLeaderboards(database, "UNKNOWN"), { dps: [], hps: [] });
    if (process.env.PIZZA_AVERAGE_PREVIEW === "1") console.log(`Preview schema: ${schema}`);
  } finally {
    await database.$disconnect();
  }
});
