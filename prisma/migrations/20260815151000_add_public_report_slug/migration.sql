ALTER TABLE "uploads" ADD COLUMN "publicSlug" TEXT;

-- Existing uploads receive a stable, URL-safe alias derived from their internal
-- identifier. The internal CUID remains the primary key and is never exposed by
-- newly generated public report links.
UPDATE "uploads" AS upload
SET "publicSlug" = concat(
  COALESCE(
    NULLIF(
      trim(BOTH '-' FROM regexp_replace(
        lower(COALESCE((SELECT guild."name" FROM "guilds" AS guild WHERE guild."id" = upload."guildId"), 'raid')),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'raid'
  ),
  '-',
  substr(md5('pizza-logs-public:' || upload."id"), 1, 7)
);

ALTER TABLE "uploads"
ALTER COLUMN "publicSlug" SET DEFAULT ('raid-'::text || substr(md5(((random())::text || (clock_timestamp())::text)), 1, 7)),
ALTER COLUMN "publicSlug" SET NOT NULL;

CREATE UNIQUE INDEX "uploads_publicSlug_key" ON "uploads"("publicSlug");
