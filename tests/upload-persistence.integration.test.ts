import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { IncompleteStoredUploadError, persistParsedUpload } from "../lib/upload-persistence";
import { ParseResultSchema, UploadRequestSchema } from "../lib/schema";
import { parserPayload } from "./helpers/parser-payload";

const connection = process.env.TEST_DATABASE_URL;

test("PostgreSQL ingestion is atomic, idempotent, and preserves exact provenance and milliseconds", {
  skip: connection ? false : "Set TEST_DATABASE_URL to a dedicated local PostgreSQL test database",
}, async t => {
  const url = new URL(connection!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Integration tests require a local database");
  const schema = `upload_test_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  // Each invocation creates its own schema. Never reset a database or touch
  // existing schemas, and retain this schema for failure investigation.
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", timeout: 60_000,
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection! }, { schema }) });
  const sql = new Client({ connectionString: connection! });
  await sql.connect();
  try {
    await db.boss.create({ data: { name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel" } });
    const input = (id: string) => ({
      parsed: parserPayload(id), filename: "synthetic.txt", fileSize: 128,
      metadata: UploadRequestSchema.parse({ uploaderName: "Example", realmName: "Integration", realmHost: "test" }),
    });

    await t.test("fractional seconds survive persistence and retries return one completed report", async () => {
      const payload = input("same-file");
      const [left, right] = await Promise.all([persistParsedUpload(db, payload), persistParsedUpload(db, payload)]);
      assert.deepEqual([left.result.status, right.result.status].sort(), ["DONE", "DUPLICATE"]);
      assert.equal(left.result.uploadId, right.result.uploadId);
      const stored = await db.upload.findUniqueOrThrow({ where: { id: left.result.uploadId }, include: { encounters: { include: { participants: true } } } });
      assert.equal(stored.status, "DONE");
      assert.equal(stored.encounters.length, 1);
      assert.equal(stored.encounters[0].participants.length, 1);
      assert.equal(stored.encounters[0].durationSeconds, 30);
      assert.equal(stored.encounters[0].durationMs, 30_125);
      assert.equal(stored.encounters[0].participants[0].dps, 3.32);
      assert.equal(stored.parserVersion, "1.1.0");
      assert.equal(stored.metricSchemaVersion, "1");
      assert.equal(stored.compatibilityProfile, "canonical-v1");
      assert.equal(stored.referenceSha, null);
      assert.equal(stored.parserParsedAt?.toISOString(), "2026-09-04T12:00:00.000Z");
    });

    await t.test("overlapping files cannot create duplicate or partial encounters", async () => {
      const left = input("overlap-left");
      const right = input("overlap-right");
      right.parsed.encounters[0].fingerprint = left.parsed.encounters[0].fingerprint;
      const results = await Promise.all([persistParsedUpload(db, left), persistParsedUpload(db, right)]);
      assert.equal(results.reduce((sum, item) => sum + item.result.encountersInserted, 0), 1);
      assert.equal(results.reduce((sum, item) => sum + item.result.encountersDuplicate, 0), 1);
      const encounters = await db.encounter.findMany({ where: { fingerprint: left.parsed.encounters[0].fingerprint }, include: { participants: true } });
      assert.equal(encounters.length, 1);
      assert.equal(encounters[0].participants.length, 1);
      for (const item of results) assert.equal((await db.upload.findUniqueOrThrow({ where: { id: item.result.uploadId } })).status, "DONE");
    });

    await t.test("overlapping multi-session files return a route for a stored session on initial upload and retry", async () => {
      const previous = input("route-previous");
      await persistParsedUpload(db, previous);
      const combined = input("route-combined");
      combined.parsed = ParseResultSchema.parse({
        ...combined.parsed,
        encounters: [previous.parsed.encounters[0], {
          ...combined.parsed.encounters[0], sessionIndex: 1,
          startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T10:00:30.125Z",
        }],
        sessionAnalytics: {
          0: { startedAt: "2026-09-04T09:00:00Z", endedAt: "2026-09-04T10:00:30.125Z", durationMs: 3_630_125 },
          1: { startedAt: "2026-09-05T09:00:00Z", endedAt: "2026-09-05T10:00:30.125Z", durationMs: 3_630_125 },
        },
      });
      const initial = await persistParsedUpload(db, combined);
      assert.equal(initial.result.encountersInserted, 1);
      assert.equal(initial.result.encountersDuplicate, 1);
      const stored = await db.encounter.findMany({ where: { uploadId: initial.result.uploadId } });
      assert.deepEqual(stored.map(encounter => encounter.sessionIndex), [1]);
      assert.equal(initial.result.firstSessionSlug, "2026-09-05");
      const retry = await persistParsedUpload(db, combined);
      assert.equal(retry.result.status, "DUPLICATE");
      assert.equal(retry.result.uploadId, initial.result.uploadId);
      assert.equal(retry.result.firstSessionSlug, initial.result.firstSessionSlug);
    });

    await t.test("participant failure rolls back upload, encounter, and players; retry succeeds", async () => {
      // An actual database constraint injects failure after upload/encounter
      // insertion. This tests PostgreSQL rollback, not a mocked Prisma call.
      await sql.query(`ALTER TABLE "${schema}"."participants" ADD CONSTRAINT "test_reject_deaths" CHECK ("deaths" <> 12345)`);
      const payload = input("rollback");
      payload.parsed.encounters[0].participants[0].name = "RollbackOnly";
      payload.parsed.encounters[0].participants[0].deaths = 12345;
      await assert.rejects(persistParsedUpload(db, payload));
      assert.equal(await db.upload.findUnique({ where: { fileHash: payload.parsed.fileHash } }), null);
      assert.equal(await db.encounter.findUnique({ where: { fingerprint: payload.parsed.encounters[0].fingerprint } }), null);
      assert.equal(await db.player.count({ where: { name: "RollbackOnly" } }), 0);
      payload.parsed.encounters[0].participants[0].deaths = 0;
      assert.equal((await persistParsedUpload(db, payload)).result.status, "DONE");
    });

    await t.test("legacy missing provenance stays unknown and incomplete records are not success", async () => {
      const legacy = input("legacy");
      delete legacy.parsed.provenance;
      const result = await persistParsedUpload(db, legacy);
      const stored = await db.upload.findUniqueOrThrow({ where: { id: result.result.uploadId } });
      assert.equal(stored.parserVersion, null);
      assert.equal(stored.metricSchemaVersion, null);
      assert.equal(stored.compatibilityProfile, null);
      assert.equal(stored.parserParsedAt, null);
      const partial = input("old-partial");
      await db.upload.create({ data: { filename: partial.filename, fileHash: partial.parsed.fileHash, fileSize: 128, status: "PARSING" } });
      await assert.rejects(persistParsedUpload(db, partial), IncompleteStoredUploadError);
    });
  } finally {
    await db.$disconnect();
    await sql.end();
  }
});
