CREATE TABLE "guild_roster_members" (
    "id" TEXT NOT NULL,
    "character_name" TEXT NOT NULL,
    "normalized_character_name" TEXT NOT NULL,
    "guild_name" TEXT NOT NULL,
    "realm" TEXT NOT NULL DEFAULT 'Lordaeron',
    "class_name" TEXT,
    "race_name" TEXT,
    "level" INTEGER,
    "rank_name" TEXT,
    "armory_url" TEXT NOT NULL,
    "gear_snapshot_json" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_roster_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guild_roster_members_normalized_character_name_guild_name_realm_key"
    ON "guild_roster_members"("normalized_character_name", "guild_name", "realm");

CREATE INDEX "guild_roster_members_guild_name_realm_idx"
    ON "guild_roster_members"("guild_name", "realm");

CREATE INDEX "guild_roster_members_last_synced_at_idx"
    ON "guild_roster_members"("last_synced_at");
