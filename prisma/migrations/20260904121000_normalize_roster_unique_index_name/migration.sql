-- Historical SQL and Prisma db-push shortened this long index name differently.
-- Normalize only the known db-push name; no rows or index definition change.
DO $index_name$
BEGIN
  IF to_regclass('guild_roster_members_normalized_character_name_guild_name_r_key') IS NOT NULL
     AND to_regclass('guild_roster_members_normalized_character_name_guild_name_realm') IS NULL THEN
    ALTER INDEX "guild_roster_members_normalized_character_name_guild_name_r_key"
      RENAME TO "guild_roster_members_normalized_character_name_guild_name_realm";
  END IF;
END
$index_name$;
