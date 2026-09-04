import pg from "pg";
import { spawnSync } from "node:child_process";

// Only the three historically unrecorded migrations are eligible for adoption.
// Later migrations must always go through migrate deploy and its checksum ledger.
const legacy = [
  ["20260430210000_add_guild_roster_members", "guild_roster_members", ["id", "character_name", "guild_name", "realm"]],
  ["20260501120000_add_guild_roster_rank_professions_gearscore", "guild_roster_members", ["rank_order", "professions_json", "gear_score"]],
  ["20260501213536_add_sync_jobs", "armory_gear_cache", ["lastSuccessAt", "sourceAgent"]],
];
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.argv[2]) throw new Error("Prisma CLI path is required");
// Prisma interprets ?schema=, whereas node-postgres does not. Inspect exactly
// the namespace the child migration command will use, including quoted names.
const schema = new URL(process.env.DATABASE_URL).searchParams.get("schema") ?? "public";
const quotedSchema = `"${schema.replaceAll('"', '""')}"`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
try {
  await client.connect();
  await client.query("SELECT set_config('search_path', $1, false)", [quotedSchema]);
  const ledger = await client.query("SELECT to_regclass('_prisma_migrations') IS NOT NULL AS present");
  for (const [migration, table, columns] of legacy) {
    if (ledger.rows[0].present) {
      const recorded = await client.query('SELECT finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = $1', [migration]);
      // Failed records are deliberately left for migrate deploy to reject.
      if (recorded.rows.some(row => row.rolled_back_at === null)) continue;
    }
    const existing = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = ANY($2::text[])",
      [table, columns],
    );
    if (existing.rows.length !== columns.length) continue;
    const result = spawnSync(process.execPath, [process.argv[2], "migrate", "resolve", "--applied", migration], { stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error(`Legacy migration adoption failed: ${migration}`);
  }
} catch {
  console.error("Migration preflight failed. Check database availability and migration history; startup stopped.");
  process.exitCode = 1;
} finally {
  await client.end();
}
