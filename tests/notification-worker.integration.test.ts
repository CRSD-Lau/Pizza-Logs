import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import pg from "pg";
import {
  claimNextJob,
  enqueueDailyDigest,
  loadWorkerConfig,
  releaseFailedJob,
} from "../scripts/notification-worker.mjs";

const connection = process.env.TEST_DATABASE_URL;
const { Pool } = pg;

test("notification leases, retries, and UTC digest dedupe are enforced by PostgreSQL", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Integration tests require a local database");
  const schema = `notification_test_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });

  const connectionUrl = new URL(connection!);
  connectionUrl.searchParams.delete("schema");
  const pool = new Pool({ connectionString: connectionUrl.toString(), max: 4 });
  const config = loadWorkerConfig({
    NODE_ENV: "test",
    DATABASE_URL: url.toString(),
    RESEND_API_KEY: "re_test",
    REPORT_EMAIL_FROM: "Pizza Logs <notifications@example.test>",
    REPORT_EMAIL_TO: "owner@example.test",
    SITE_URL: "https://logs.example.test",
  });
  const table = `"${schema}"."notification_jobs"`;

  try {
    const now = new Date("2026-09-08T12:00:00Z");
    assert.equal(await enqueueDailyDigest(pool, config, now), true);
    assert.equal(await enqueueDailyDigest(pool, config, now), false);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE "dedupeKey" = $1`, ["digest:2026-09-07"])).rows[0].count, 1);

    const [left, right] = await Promise.all([claimNextJob(pool, config), claimNextJob(pool, config)]);
    const claimed = left ?? right;
    assert.ok(claimed);
    assert.equal([left, right].filter(Boolean).length, 1, "SKIP LOCKED allows one owner for a job");
    assert.equal(claimed.attempts, 1);
    const firstLeaseToken = claimed.leaseToken;

    await pool.query(`UPDATE ${table} SET "leaseExpiresAt" = NOW() - INTERVAL '1 minute' WHERE "id" = $1`, [claimed.id]);
    const recovered = await claimNextJob(pool, config);
    assert.equal(recovered.id, claimed.id);
    assert.equal(recovered.attempts, 2);
    assert.notEqual(recovered.leaseToken, firstLeaseToken);

    await releaseFailedJob(pool, config, recovered, Object.assign(new Error("retry"), { code: "TEST_RETRY" }));
    const released = (await pool.query(`SELECT "state", "leaseToken", "attempts" FROM ${table} WHERE "id" = $1`, [claimed.id])).rows[0];
    assert.deepEqual(released, { state: "PENDING", leaseToken: null, attempts: 2 });

    await pool.query(
      `UPDATE ${table} SET "state" = 'PROCESSING', "attempts" = $2, "leaseExpiresAt" = NOW() - INTERVAL '1 minute', "leaseToken" = 'expired' WHERE "id" = $1`,
      [claimed.id, config.maxAttempts],
    );
    assert.equal(await claimNextJob(pool, config), null);
    const terminal = (await pool.query(`SELECT "state", "leaseToken", "lastErrorCode" FROM ${table} WHERE "id" = $1`, [claimed.id])).rows[0];
    assert.deepEqual(terminal, { state: "FAILED", leaseToken: null, lastErrorCode: "LEASE_EXPIRED_FINAL_ATTEMPT" });
  } finally {
    await pool.end();
  }
});
