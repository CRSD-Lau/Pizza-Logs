-- Additive only: old reports retain unknown provenance. No historical values
-- are backfilled with the current parser or reference version.
ALTER TABLE "uploads"
  ADD COLUMN "parserVersion" TEXT,
  ADD COLUMN "metricSchemaVersion" TEXT,
  ADD COLUMN "compatibilityProfile" TEXT,
  ADD COLUMN "referenceSha" TEXT,
  ADD COLUMN "parserParsedAt" TIMESTAMP(3);
