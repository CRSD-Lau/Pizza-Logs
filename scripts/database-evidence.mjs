import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const quote = value => `"${value.replaceAll('"', '""')}"`;

// The caller owns a repeatable-read, read-only transaction. Hash rows rather than
// exporting report contents, names, cached upstream errors or connection details.
export async function collectDatabaseEvidence(client, schema = "public") {
  const state = (await client.query("SELECT current_setting('transaction_read_only') AS readonly, current_setting('transaction_isolation') AS isolation, current_timestamp AS captured_at, current_setting('server_version') AS server_version")).rows[0];
  if (state.readonly !== "on" || state.isolation !== "repeatable read") {
    throw new Error("Evidence requires a repeatable-read, read-only transaction");
  }
  const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name", [schema])).rows.map(row => row.table_name);
  if (!tables.includes("uploads") || !tables.includes("_prisma_migrations")) throw new Error("Expected Pizza Logs schema is absent");
  const columns = (await client.query("SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position", [schema])).rows;
  const constraints = (await client.query("SELECT c.relname AS table_name, k.conname AS name, k.contype AS type, k.convalidated AS validated, pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,k.conname", [schema])).rows;
  const indexes = (await client.query("SELECT tablename AS table_name,indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname=$1 ORDER BY tablename,indexname", [schema])).rows;
  const enums = (await client.query("SELECT t.typname AS name,e.enumlabel AS label,e.enumsortorder AS position FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname=$1 ORDER BY t.typname,e.enumsortorder", [schema])).rows;
  const tableEvidence = [];
  for (const table of tables) {
    const qualified = `${quote(schema)}.${quote(table)}`;
    const count = (await client.query(`SELECT count(*)::text AS count FROM ${qualified}`)).rows[0].count;
    // A server cursor bounds client memory even for large analytics tables.
    // Hashes are sorted, preserving duplicate multiplicity without requiring IDs.
    await client.query(`DECLARE evidence_rows NO SCROLL CURSOR FOR SELECT md5(to_jsonb(t)::text) AS hash FROM ${qualified} t ORDER BY 1`);
    const digest = createHash("sha256");
    try {
      while (true) {
        const batch = (await client.query("FETCH FORWARD 500 FROM evidence_rows")).rows;
        if (!batch.length) break;
        for (const row of batch) digest.update(row.hash).update("\n");
      }
    } finally { await client.query("CLOSE evidence_rows"); }
    tableEvidence.push({ table, count, sha256OfRowHashes: digest.digest("hex") });
  }
  const qualified = name => `${quote(schema)}.${quote(name)}`;
  const migrations = (await client.query(`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM ${qualified("_prisma_migrations")} ORDER BY migration_name,started_at`)).rows;
  const uploadColumns = columns.filter(row => row.table_name === "uploads").map(row => row.column_name);
  const provenanceAvailable = ["parserVersion", "metricSchemaVersion", "compatibilityProfile", "parserParsedAt"].every(name => uploadColumns.includes(name));
  const uploads = (await client.query(`SELECT status::text,count(*)::text AS count FROM ${qualified("uploads")} GROUP BY status ORDER BY status`)).rows;
  const provenance = provenanceAvailable ? (await client.query(`SELECT "parserVersion","metricSchemaVersion","compatibilityProfile",count(*)::text AS count FROM ${qualified("uploads")} GROUP BY 1,2,3 ORDER BY 1,2,3`)).rows : null;
  const latestUpload = (await client.query(`SELECT max("createdAt") AS newest_upload_at,max("updatedAt") AS newest_upload_update_at FROM ${qualified("uploads")}`)).rows[0];
  const totals = tables.includes("encounters") ? (await client.query(`SELECT count(*)::text AS encounters,coalesce(sum("totalDamage"),0)::text AS damage,coalesce(sum("totalHealing"),0)::text AS healing,coalesce(sum("totalAbsorbs"),0)::text AS absorbs,coalesce(sum("durationMs"),0)::text AS duration_ms FROM ${qualified("encounters")}`)).rows[0] : null;
  return {
    formatVersion: 1, author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell",
    capturedAt: state.captured_at, serverVersion: state.server_version, schema,
    columns, constraints, indexes, enums, tables: tableEvidence, migrations, uploads,
    provenance, latestUpload, totals,
  };
}

export function compareDatabaseEvidence(before, after) {
  for (const value of [before, after]) {
    if (value?.formatVersion !== 1 || typeof value.schema !== "string"
      || !Array.isArray(value.tables) || value.tables.length < 2
      || !["columns", "constraints", "indexes", "enums", "migrations", "uploads"].every(key => Array.isArray(value[key]))
      || !["_prisma_migrations", "uploads"].every(name => value.tables.some(table => table.table === name && /^\d+$/.test(table.count) && /^[a-f0-9]{64}$/.test(table.sha256OfRowHashes)))) {
      throw new Error("Invalid or incomplete database evidence");
    }
  }
  const differences = [];
  // Capture times and server patch versions can change during restoration.
  for (const key of ["formatVersion", "schema", "columns", "constraints", "indexes", "enums", "tables", "migrations", "uploads", "provenance", "latestUpload", "totals"]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) differences.push(key);
  }
  return { author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell", matches: differences.length === 0, differences };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "compare" && args.length === 2) {
    const result = compareDatabaseEvidence(...await Promise.all(args.map(async filename => JSON.parse(await fs.readFile(filename, "utf8")))));
    console.log(JSON.stringify(result));
    if (!result.matches) process.exitCode = 1;
    return;
  }
  if (command !== "capture" || args.length !== 1 || !process.env.DATABASE_URL) throw new Error("Usage: DATABASE_URL=... node scripts/database-evidence.mjs capture <private-output.json>; or compare <before.json> <after.json>");
  const schema = new URL(process.env.DATABASE_URL).searchParams.get("schema") ?? "public";
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 60000 });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='60s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    const evidence = await collectDatabaseEvidence(client, schema);
    await client.query("ROLLBACK");
    await fs.writeFile(args[0], `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ captured: true, tables: evidence.tables.length, migrationRecords: evidence.migrations.length, author: evidence.author }));
  } finally { await client.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Database evidence failed; check access, schema, output path and timeout. Connection details and database errors were withheld."); process.exitCode = 1; });
}
