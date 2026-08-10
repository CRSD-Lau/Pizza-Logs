-- Additive analytics fields. Existing encounters and participants retain zero/null defaults.
ALTER TABLE "encounters"
  ADD COLUMN "totalAbsorbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "unattributedAbsorbs" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "participants"
  ADD COLUMN "spec" TEXT,
  ADD COLUMN "totalAbsorbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "aps" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "absorbBreakdown" JSONB,
  ADD COLUMN "auraBreakdown" JSONB,
  ADD COLUMN "powerBreakdown" JSONB,
  ADD COLUMN "consumableBreakdown" JSONB,
  ADD COLUMN "deathEvents" JSONB;
