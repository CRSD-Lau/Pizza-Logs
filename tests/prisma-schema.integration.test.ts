import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { createPrismaClient } from "../lib/prisma-client";
import { bossAggregateQuery, type BossAggregate } from "../lib/report-aggregates";

const connection = process.env.TEST_DATABASE_URL;

test("application Prisma client scopes generated and raw queries to the URL schema on every connection", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  // Exercise SQL quoting and the PostgreSQL startup-options escaping boundary.
  const initialSchema = `client_test_${randomUUID().replaceAll("-", "")}`;
  const schema = `${initialSchema} x,\\scope`;
  const quoted = `"${schema.replaceAll('"', '""')}"`;
  url.searchParams.set("schema", initialSchema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const catalog = new Client({ connectionString: connection! });
  await catalog.connect();
  // Rename the independently created schema to exercise quoting without
  // depending on the migration engine accepting punctuation in schema URLs.
  await catalog.query(`ALTER SCHEMA "${initialSchema}" RENAME TO ${quoted}`);
  url.searchParams.set("schema", schema);
  url.searchParams.set("options", "-c application_name=pizza-schema-test");
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url.toString();
  const db = createPrismaClient();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  try {
    const marker = randomUUID();
    const upload = await db.upload.create({ data: {
      filename: "synthetic.txt", fileHash: marker, fileSize: 1, status: "DONE",
    } });
    const boss = await db.boss.create({ data: {
      name: "Synthetic Schema", slug: marker, raid: "Synthetic", raidSlug: "synthetic",
    } });
    await db.encounter.create({ data: {
      bossId: boss.id, uploadId: upload.id, fingerprint: marker,
      difficulty: "25N", outcome: "KILL", durationSeconds: 30,
      startedAt: new Date("2026-09-04T00:00:00Z"), endedAt: new Date("2026-09-04T00:00:30Z"),
    } });
    const checks = await Promise.all(Array.from({ length: 12 }, () => db.$queryRaw<{
      namespace: string; uploads: number; application: string; timeout: string;
    }[]>`SELECT current_schema() AS namespace, (SELECT COUNT(*)::int FROM uploads) AS uploads,
      current_setting('application_name') AS application, current_setting('statement_timeout') AS timeout`));
    for (const rows of checks) {
      assert.equal(rows[0].namespace, schema);
      assert.equal(rows[0].uploads, 1);
      assert.equal(rows[0].application, "pizza-schema-test");
      assert.equal(rows[0].timeout, "15s");
    }
    const aggregates = await db.$queryRaw<BossAggregate[]>(bossAggregateQuery({ raidSlug: "synthetic" }));
    assert.deepEqual(aggregates.map(row => [row.bossId, row.killCount]), [[boss.id, 1]]);
    assert.equal((await catalog.query(`SELECT COUNT(*)::int AS count FROM ${quoted}.uploads WHERE "fileHash" = $1`, [marker])).rows[0].count, 1);
    assert.equal((await catalog.query('SELECT COUNT(*)::int AS count FROM public.uploads WHERE "fileHash" = $1', [marker])).rows[0].count, 0);
  } finally {
    await db.$disconnect();
    await catalog.end();
    // Only this invocation's schema was written; retain it for investigation.
  }
});
