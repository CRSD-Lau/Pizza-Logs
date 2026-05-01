ALTER TABLE "guild_roster_members"
    ADD COLUMN "rank_order" INTEGER,
    ADD COLUMN "professions_json" JSONB,
    ADD COLUMN "gear_score" INTEGER;

CREATE INDEX "guild_roster_members_guild_name_realm_rank_order_idx"
    ON "guild_roster_members"("guild_name", "realm", "rank_order");
