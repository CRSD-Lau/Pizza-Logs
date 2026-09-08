import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("new stored uploads enqueue a durable owner notification while duplicate files do not", () => {
  const persistence = readFileSync("lib/upload-persistence.ts", "utf8");
  const migration = readFileSync("prisma/migrations/20260908194500_add_notification_outbox/migration.sql", "utf8");
  const worker = readFileSync("scripts/notification-worker.mjs", "utf8");
  const dockerfile = readFileSync("Dockerfile", "utf8");

  const duplicateReturn = persistence.slice(persistence.indexOf("if (existing)"), persistence.indexOf("const realm"));
  assert.doesNotMatch(duplicateReturn, /notificationJob\.create/);
  assert.match(persistence, /await tx\.notificationJob\.create/);
  assert.match(persistence, /dedupeKey: `upload:\$\{upload\.id\}`/);
  assert.match(migration, /CREATE UNIQUE INDEX "notification_jobs_dedupeKey_key"/);
  assert.match(worker, /FOR UPDATE SKIP LOCKED/);
  assert.match(worker, /"leaseToken" = \$3/);
  assert.match(worker, /AND "leaseToken" = \$5/);
  assert.match(worker, /"lastErrorCode" = 'LEASE_EXPIRED_FINAL_ATTEMPT'/, "an expired final attempt becomes terminal");
  assert.match(worker, /"attempts" = job\."attempts" \+ 1/, "every fresh or recovered claim consumes one bounded attempt");
  assert.match(worker, /MAX_JOBS_PER_RUN = 20/);
  assert.match(worker, /MAX_RUNTIME_MS = 240_000/);
  assert.match(worker, /"Idempotency-Key": `pizzalogs\/\$\{job\.id\}`/);
  assert.match(dockerfile, /scripts\/notification-worker\.mjs/);
});
