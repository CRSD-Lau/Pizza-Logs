import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Client } from "pg";

const connection = process.env.TEST_DATABASE_URL;

test("legacy adoption inspects the requested PostgreSQL schema and preserves failed ledger entries", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async () => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  // Include a quote to test identifier quoting, not just a typical simple name.
  const schema = `preflight_test_${randomUUID().replaceAll("-", "")}"scope`;
  const quoted = `"${schema.replaceAll('"', '""')}"`;
  url.searchParams.set("schema", schema);
  const client = new Client({ connectionString: connection! });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pizza-migration-test-"));
  const cli = path.join(directory, "record-cli.mjs");
  const trace = path.join(directory, "calls.jsonl");
  fs.writeFileSync(cli, 'import fs from "node:fs"; fs.appendFileSync(process.env.ADOPTION_TRACE, JSON.stringify(process.argv.slice(2)) + "\\n");');
  const run = () => execFileSync(process.execPath, ["scripts/adopt-legacy-migrations.mjs", cli], {
    env: { ...process.env, DATABASE_URL: url.toString(), ADOPTION_TRACE: trace }, stdio: "pipe", timeout: 30_000,
  });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${quoted}`);
    // Only the second adoption candidate exists in this namespace. Other
    // namespaces in the shared local test database must not affect selection.
    await client.query(`CREATE TABLE ${quoted}.guild_roster_members (rank_order integer, professions_json jsonb, gear_score integer)`);
    run();
    const calls = fs.readFileSync(trace, "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(calls, [["migrate", "resolve", "--applied", "20260501120000_add_guild_roster_rank_professions_gearscore"]]);
    await client.query(`CREATE TABLE ${quoted}._prisma_migrations (migration_name text, finished_at timestamptz, rolled_back_at timestamptz)`);
    await client.query(`INSERT INTO ${quoted}._prisma_migrations (migration_name) VALUES ($1)`, ["20260501120000_add_guild_roster_rank_professions_gearscore"]);
    fs.writeFileSync(trace, "");
    run();
    assert.equal(fs.readFileSync(trace, "utf8"), "", "failed migrations must remain for migrate deploy to reject");
  } finally {
    await client.end();
    fs.unlinkSync(cli);
    if (fs.existsSync(trace)) fs.unlinkSync(trace);
    fs.rmdirSync(directory);
    // Retain only this independently named DB schema for investigation.
  }
});
