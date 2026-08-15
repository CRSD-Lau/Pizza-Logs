import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sessionPage = readFileSync("app/uploads/[id]/sessions/[sessionIdx]/page.tsx", "utf8");
const playerPage = readFileSync(
  "app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx",
  "utf8",
);
const raidsPage = readFileSync("app/raids/page.tsx", "utf8");
const encounterPage = readFileSync("app/encounters/[id]/page.tsx", "utf8");
const uploadRoute = readFileSync("app/api/upload/route.ts", "utf8");
const uploadZone = readFileSync("components/upload/UploadZone.tsx", "utf8");
const adminUploadsPage = readFileSync("app/admin/uploads/page.tsx", "utf8");
const adminUploadPage = readFileSync("app/admin/uploads/[id]/page.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const schema = readFileSync("lib/schema.ts", "utf8");
const prismaSchema = readFileSync("prisma/schema.prisma", "utf8");
const routingServer = readFileSync("lib/raid-session-routing.server.ts", "utf8");
const publicSlugMigration = readFileSync(
  "prisma/migrations/20260815151000_add_public_report_slug/migration.sql",
  "utf8",
);
const generatedLinkSources = [
  sessionPage,
  playerPage,
  raidsPage,
  encounterPage,
  uploadZone,
  adminUploadsPage,
  adminUploadPage,
].join("\n");

assert.match(sessionPage, /resolveRaidSession/);
assert.match(sessionPage, /permanentRedirect/);
assert.match(sessionPage, /isLegacyUploadId/);
assert.match(sessionPage, /alternates:\s*\{\s*canonical/);
assert.match(sessionPage, /openGraph:\s*\{/);
assert.match(sessionPage, /twitter:\s*\{/);
assert.doesNotMatch(sessionPage, /title:\s*`Session /);

assert.match(playerPage, /resolveRaidSession/);
assert.match(playerPage, /getRaidSessionPath/);
assert.doesNotMatch(playerPage, /Session \$\{Number\(sessionIdx\)/);

assert.match(raidsPage, /routeSlug/);
assert.match(encounterPage, /getRaidSessionRouteByIndex/);
assert.match(uploadRoute, /firstSessionSlug/);
assert.match(uploadRoute, /publicReportSlug:\s+upload\.publicSlug/);
assert.match(uploadRoute, /publicReportSlug:\s+existingUpload\.publicSlug/);
assert.match(uploadZone, /result\.firstSessionSlug/);
assert.match(uploadZone, /result\.publicReportSlug/);
assert.match(schema, /firstSessionSlug:\s*z\.string\(\)\.optional\(\)/);
assert.match(schema, /publicReportSlug:\s+z\.string\(\)/);
assert.match(prismaSchema, /publicSlug\s+String\s+@unique/);
assert.match(publicSlugMigration, /UPDATE "uploads" AS upload/);
assert.match(publicSlugMigration, /ALTER COLUMN "publicSlug" SET NOT NULL/);
assert.match(publicSlugMigration, /CREATE UNIQUE INDEX "uploads_publicSlug_key"/);
assert.match(routingServer, /\{ publicSlug: raidRef \}/);
assert.match(routingServer, /isLegacyUploadId:/);
assert.match(rootLayout, /metadataBase:\s*new URL\(PIZZA_LOGS_ORIGIN\)/);
assert.doesNotMatch(generatedLinkSources, /\/sessions\/0/);
assert.doesNotMatch(generatedLinkSources, /\/sessions\/\$\{session(?:Index|Idx)\}/);
assert.doesNotMatch(generatedLinkSources, /getRaidSessionPath\((?:u\.|upload\.)?id,/);
assert.doesNotMatch(uploadZone, /\/raids\/\$\{result\.uploadId\}/);

console.log("raid session routing source tests passed");
