import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import pg from "pg";

test("admin migration preserves existing report tables and enforces one designated account", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.TEST_DATABASE_URL!).hostname), "migration tests require an isolated loopback database");
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `admin_upgrade_${randomUUID().replaceAll("-", "")}`;
  const quoted = `"${schema}"`;
  const directory = path.join(process.cwd(), "prisma", "migrations");
  const authMigration = "20260905120000_add_private_admin_mfa";
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${quoted}`);
    await client.query(`SET search_path TO ${quoted}`);
    const migrations = (await readdir(directory)).filter(name => /^\d/.test(name)).sort();
    for (const name of migrations.filter(name => name < authMigration)) {
      await client.query(await readFile(path.join(directory, name, "migration.sql"), "utf8"));
    }
    await client.query("INSERT INTO realms (id,name,host) VALUES ('preserve-me','Synthetic Realm','warmane')");
    const oldTables = (await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename", [schema],
    )).rows.map(row => row.tablename);
    assert.ok(oldTables.length >= 12, "exercise the existing application schema, excluding Prisma's separate migration ledger");
    const tableContents = async () => {
      const contents = [];
      for (const table of oldTables) contents.push({
        name: table,
        rows: (await client.query(`SELECT to_jsonb(t)::text AS row FROM ${quoted}."${table}" t ORDER BY row`)).rows,
      });
      return contents;
    };
    const before = await tableContents();
    await client.query(await readFile(path.join(directory, authMigration, "migration.sql"), "utf8"));
    assert.deepEqual(await tableContents(), before, "auth migration must not alter any existing report/cache row");
    const authTables = (await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename LIKE 'admin_%'", [schema],
    )).rows;
    assert.equal(authTables.length, 8);
    await client.query("INSERT INTO admin_auth_users (id,name,email,\"updatedAt\") VALUES ('operator','Synthetic','synthetic@example.test',now())");
    await client.query("INSERT INTO admin_identity (id,\"userId\",\"updatedAt\") VALUES (1,'operator',now())");
    await assert.rejects(client.query("INSERT INTO admin_identity (id,\"userId\",\"updatedAt\") VALUES (2,'operator',now())"));
    const count = await client.query("SELECT count(*)::int AS count FROM admin_identity");
    assert.equal(count.rows[0].count, 1);
  } finally {
    await client.query(`DROP SCHEMA ${quoted} CASCADE`);
    await client.end();
  }
});
