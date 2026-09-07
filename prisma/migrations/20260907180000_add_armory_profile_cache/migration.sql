-- Additive cache only. No existing records or combat analytics are changed.
CREATE TABLE "armory_profile_cache" (
    "id" TEXT NOT NULL,
    "characterKey" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "payload" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "armory_profile_cache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "armory_profile_cache_characterKey_realm_sectionKey_key"
ON "armory_profile_cache"("characterKey", "realm", "sectionKey");
