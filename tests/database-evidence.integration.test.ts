import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
// Operational scripts are intentionally plain Node modules, usable in recovery.
import { collectDatabaseEvidence, compareDatabaseEvidence } from "../scripts/database-evidence.mjs";

test("restore evidence detects changed content with unchanged counts and requires read-only snapshots", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `restore_${randomUUID().replaceAll("-", "")}`;
  const quoted = `"${schema}"`;
  await client.connect();
  const capture = async () => {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try { return await collectDatabaseEvidence(client, schema); }
    finally { await client.query("ROLLBACK"); }
  };
  try {
    await client.query(`CREATE SCHEMA ${quoted}`);
    await client.query(`CREATE TABLE ${quoted}._prisma_migrations (migration_name text,checksum text,finished_at timestamptz,rolled_back_at timestamptz,started_at timestamptz)`);
    await client.query(`CREATE TABLE ${quoted}.uploads (id text PRIMARY KEY,status text,"createdAt" timestamptz,"updatedAt" timestamptz,payload jsonb)`);
    await client.query(`INSERT INTO ${quoted}.uploads VALUES ('synthetic','DONE','2026-01-01','2026-01-01','{"privateCharacter":"DoNotPrint","damage":123}')`);
    await assert.rejects(collectDatabaseEvidence(client, schema), /read-only transaction/);
    const before = await capture();
    assert.equal(JSON.stringify(before).includes("DoNotPrint"), false);
    assert.equal(compareDatabaseEvidence(before, await capture()).matches, true);
    await client.query(`UPDATE ${quoted}.uploads SET payload=jsonb_set(payload,'{damage}','124')`);
    const changed = await capture();
    assert.deepEqual(before.tables.map((row: { count: string }) => row.count), changed.tables.map((row: { count: string }) => row.count));
    assert.deepEqual(compareDatabaseEvidence(before, changed).differences, ["tables"]);
    await client.query(`UPDATE ${quoted}.uploads SET payload=jsonb_set(payload,'{damage}','123')`);
    assert.equal(compareDatabaseEvidence(before, await capture()).matches, true);
    await client.query(`CREATE TYPE ${quoted}.state AS ENUM ('ready','complete')`);
    const enumBaseline = await capture();
    await client.query(`ALTER TYPE ${quoted}.state ADD VALUE 'unexpected'`);
    assert.deepEqual(compareDatabaseEvidence(enumBaseline, await capture()).differences, ["enums"]);
    await client.query(`ALTER TABLE ${quoted}.uploads ADD COLUMN extra integer`);
    assert.ok(compareDatabaseEvidence(before, await capture()).differences.includes("columns"));
    assert.throws(() => compareDatabaseEvidence({}, {}), /Invalid or incomplete/);
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA ${quoted} CASCADE`);
    await client.end();
  }
});
