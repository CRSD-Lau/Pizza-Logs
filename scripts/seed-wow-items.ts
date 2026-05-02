/**
 * Seed the WowItem table from data already in ArmoryGearCache.
 *
 * The gear imported by the Tampermonkey userscript already has itemLevel,
 * iconUrl, quality, and equipLoc enriched by the browser. This script
 * extracts those fields from the existing cache rows — no external API calls.
 *
 * Usage:
 *   npm run db:seed-items
 *
 * Safe to re-run — already-known items are skipped.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type GearItem = {
  itemId?: string;
  name?: string;
  itemLevel?: number;
  quality?: string;
  equipLoc?: string;
  iconUrl?: string;
};

function iconNameFromUrl(iconUrl: string | undefined): string | null {
  if (!iconUrl) return null;
  const match = iconUrl.match(/\/([^/]+?)(?:\.jpg)?$/i);
  return match ? match[1].toLowerCase() : null;
}

async function main() {
  console.log("Extracting item metadata from gear cache…");

  const rows = await db.armoryGearCache.findMany({ select: { gear: true } });
  console.log(`  Found ${rows.length} cached characters`);

  // Collect best-known data per itemId (merge richer fields across characters)
  const itemMap = new Map<string, {
    name: string;
    itemLevel: number | null;
    quality: string | null;
    equipLoc: string | null;
    iconName: string | null;
  }>();

  for (const row of rows) {
    const gear = row.gear as Record<string, unknown>;
    if (!Array.isArray(gear.items)) continue;

    for (const raw of gear.items as GearItem[]) {
      const itemId = raw.itemId;
      if (!itemId || typeof itemId !== "string") continue;
      const name = raw.name?.trim();
      if (!name) continue;

      const incoming = {
        name,
        itemLevel: typeof raw.itemLevel === "number" ? raw.itemLevel : null,
        quality: typeof raw.quality === "string" ? raw.quality : null,
        equipLoc: typeof raw.equipLoc === "string" ? raw.equipLoc : null,
        iconName: iconNameFromUrl(raw.iconUrl),
      };

      const existing = itemMap.get(itemId);
      if (!existing) {
        itemMap.set(itemId, incoming);
      } else {
        itemMap.set(itemId, {
          name: incoming.name || existing.name,
          itemLevel: incoming.itemLevel ?? existing.itemLevel,
          quality: incoming.quality ?? existing.quality,
          equipLoc: incoming.equipLoc ?? existing.equipLoc,
          iconName: incoming.iconName ?? existing.iconName,
        });
      }
    }
  }

  console.log(`  Collected ${itemMap.size} distinct item IDs`);

  const alreadySeeded = await db.wowItem.findMany({ select: { itemId: true } });
  const seededSet = new Set(alreadySeeded.map(r => r.itemId));
  const toUpsert = [...itemMap.entries()].filter(([id]) => !seededSet.has(id));
  console.log(`  ${seededSet.size} already seeded, ${toUpsert.length} to insert`);

  let done = 0;
  for (const [itemId, data] of toUpsert) {
    await db.wowItem.upsert({
      where: { itemId },
      create: { itemId, ...data },
      update: { ...data },
    });
    done++;
    if (done % 50 === 0) {
      process.stdout.write(`\r  Inserted ${done}/${toUpsert.length}…`);
    }
  }

  console.log(`\n\nDone. ${done} items seeded from cache.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
