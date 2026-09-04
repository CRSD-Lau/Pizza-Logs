-- Reconstructs the core schema that predates the versioned migrations.
-- Derived from this repository's pre-roster schema (82f467b^), not live data.
-- Existing complete core installations are adopted without altering their rows.
DO $baseline$
BEGIN
  IF to_regclass('realms') IS NULL THEN


-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'PARSING', 'DONE', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('KILL', 'WIPE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DPS', 'HEALER', 'TANK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('ALL_TIME_RANK', 'WEEKLY_BEST', 'PERSONAL_BEST');

-- CreateEnum
CREATE TYPE "MilestoneMetric" AS ENUM ('DPS', 'HPS');

-- CreateTable
CREATE TABLE "realms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "expansion" TEXT NOT NULL DEFAULT 'wotlk',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bosses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "raid" TEXT NOT NULL,
    "raidSlug" TEXT NOT NULL,
    "wowBossId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bosses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "guildId" TEXT,
    "realmId" TEXT,
    "uploaderName" TEXT,
    "errorMessage" TEXT,
    "parsedAt" TIMESTAMP(3),
    "rawLineCount" INTEGER,
    "sessionDamage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "outcome" "Outcome" NOT NULL DEFAULT 'UNKNOWN',
    "difficulty" TEXT NOT NULL,
    "groupSize" INTEGER NOT NULL DEFAULT 10,
    "sessionIndex" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "totalDamage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHealing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDamageTaken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT,
    "realmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "armory_gear_cache" (
    "id" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "characterKey" TEXT NOT NULL,
    "realm" TEXT NOT NULL DEFAULT 'Lordaeron',
    "sourceUrl" TEXT NOT NULL,
    "gear" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "armory_gear_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'UNKNOWN',
    "totalDamage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHealing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "damageTaken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "critPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spellBreakdown" JSONB,
    "targetBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "rank" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "metric" "MilestoneMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_summaries" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "realmId" TEXT,
    "guildId" TEXT,
    "totalKills" INTEGER NOT NULL DEFAULT 0,
    "totalWipes" INTEGER NOT NULL DEFAULT 0,
    "totalUploads" INTEGER NOT NULL DEFAULT 0,
    "topDps" JSONB NOT NULL,
    "topHps" JSONB NOT NULL,
    "bossKills" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "realms_name_host_key" ON "realms"("name", "host");

-- CreateIndex
CREATE UNIQUE INDEX "guilds_name_realmId_key" ON "guilds"("name", "realmId");

-- CreateIndex
CREATE UNIQUE INDEX "bosses_slug_key" ON "bosses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_fileHash_key" ON "uploads"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_fingerprint_key" ON "encounters"("fingerprint");

-- CreateIndex
CREATE INDEX "encounters_bossId_idx" ON "encounters"("bossId");

-- CreateIndex
CREATE INDEX "encounters_startedAt_idx" ON "encounters"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "players_name_realmId_key" ON "players"("name", "realmId");

-- CreateIndex
CREATE INDEX "armory_gear_cache_fetchedAt_idx" ON "armory_gear_cache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "armory_gear_cache_characterKey_realm_key" ON "armory_gear_cache"("characterKey", "realm");

-- CreateIndex
CREATE INDEX "participants_playerId_idx" ON "participants"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_encounterId_playerId_key" ON "participants"("encounterId", "playerId");

-- CreateIndex
CREATE INDEX "milestones_bossId_difficulty_metric_idx" ON "milestones"("bossId", "difficulty", "metric");

-- CreateIndex
CREATE INDEX "milestones_playerId_idx" ON "milestones"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_summaries_weekStart_realmId_guildId_key" ON "weekly_summaries"("weekStart", "realmId", "guildId");

-- AddForeignKey
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_realmId_fkey" FOREIGN KEY ("realmId") REFERENCES "realms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_realmId_fkey" FOREIGN KEY ("realmId") REFERENCES "realms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "bosses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_realmId_fkey" FOREIGN KEY ("realmId") REFERENCES "realms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ELSE
    IF to_regclass('guilds') IS NULL OR to_regclass('bosses') IS NULL
       OR to_regclass('uploads') IS NULL OR to_regclass('encounters') IS NULL
       OR to_regclass('players') IS NULL OR to_regclass('participants') IS NULL
       OR to_regclass('milestones') IS NULL OR to_regclass('weekly_summaries') IS NULL
       OR to_regclass('armory_gear_cache') IS NULL THEN
      RAISE EXCEPTION 'Incomplete legacy core schema; restore or reconcile before migration';
    END IF;
  END IF;
END
$baseline$;
