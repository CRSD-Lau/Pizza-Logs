-- Drop sync job infrastructure
DROP TABLE IF EXISTS "sync_jobs";
DROP TYPE IF EXISTS "SyncJobType";
DROP TYPE IF EXISTS "SyncJobStatus";

-- Create static WoTLK item cache
CREATE TABLE "wow_items" (
    "itemId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "itemLevel" INTEGER,
    "quality"   TEXT,
    "equipLoc"  TEXT,
    "iconName"  TEXT,

    CONSTRAINT "wow_items_pkey" PRIMARY KEY ("itemId")
);
