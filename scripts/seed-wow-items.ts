/**
 * Seed the WowItem table from existing ArmoryGearCache data.
 *
 * For each unique itemId found across all cached gear snapshots, fetch the
 * Wowhead tooltip API once and upsert into wow_items. Subsequent enrichment
 * calls will hit the DB instead of Wowhead.
 *
 * Usage:
 *   npm run db:seed-items
 *
 * Run this after you've imported some gear data via the Tampermonkey scripts.
 * Re-running is safe — already-known items are skipped.
 */

import { PrismaClient } from "@prisma/client";
import * as https from "https";

const db = new PrismaClient();

const WOWHEAD_DELAY_MS = 800;
const WOWHEAD_TIMEOUT_MS = 10_000;

type WowheadTooltipResponse = {
  name?: string;
  quality?: number;
  icon?: string;
  tooltip?: string;
  jsonequip?: Record<string, unknown>;
};

const QUALITY_BY_ID: Record<number, string> = {
  0: "poor", 1: "common", 2: "uncommon", 3: "rare",
  4: "epic", 5: "legendary", 6: "artifact", 7: "heirloom",
};

const INVTYPE_TO_EQUIPLOC: Record<number, string> = {
  1: "INVTYPE_HEAD", 2: "INVTYPE_NECK", 3: "INVTYPE_SHOULDER",
  4: "INVTYPE_BODY", 5: "INVTYPE_CHEST", 6: "INVTYPE_WAIST",
  7: "INVTYPE_LEGS", 8: "INVTYPE_FEET", 9: "INVTYPE_WRIST",
  10: "INVTYPE_HAND", 11: "INVTYPE_FINGER", 12: "INVTYPE_TRINKET",
  13: "INVTYPE_WEAPON", 14: "INVTYPE_SHIELD", 15: "INVTYPE_RANGED",
  16: "INVTYPE_CLOAK", 17: "INVTYPE_2HWEAPON", 20: "INVTYPE_CHEST",
  21: "INVTYPE_WEAPONMAINHAND", 22: "INVTYPE_WEAPONOFFHAND",
  23: "INVTYPE_HOLDABLE", 25: "INVTYPE_THROWN",
  26: "INVTYPE_RANGEDRIGHT", 28: "INVTYPE_RELIC",
};

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), WOWHEAD_TIMEOUT_MS);
    https.get(url, {
      headers: { "User-Agent": "PizzaLogsBot/0.1", "Accept": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => {
        clearTimeout(timer);
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("invalid JSON")); }
      });
    }).on("error", (err: Error) => { clearTimeout(timer); reject(err); });
  });
}

function parseItemLevelFromTooltip(html: string): number | undefined {
  const match = html.match(/Item Level\s*(?:<!--[^-]*-->)?\s*(\d+)/i);
  const val = match ? Number(match[1]) : NaN;
  return Number.isFinite(val) && val > 0 ? val : undefined;
}

async function fetchWowheadItem(itemId: string): Promise<{
  name: string; itemLevel: number | null; quality: string | null;
  equipLoc: string | null; iconName: string | null;
} | null> {
  try {
    const json = await fetchJson(
      `https://www.wowhead.com/wotlk/tooltip/item/${itemId}`
    ) as WowheadTooltipResponse;

    const name = typeof json.name === "string" ? json.name.trim() : null;
    if (!name) return null;

    const qualityId = typeof json.quality === "number" ? json.quality : undefined;
    const iconName = typeof json.icon === "string" ? json.icon.trim() : null;
    const tooltip = typeof json.tooltip === "string" ? json.tooltip : "";
    const jsonequip = json.jsonequip && typeof json.jsonequip === "object" ? json.jsonequip : {};
    const slotbak = typeof (jsonequip as Record<string, unknown>).slotbak === "number"
      ? (jsonequip as Record<string, number>).slotbak
      : undefined;

    return {
      name,
      itemLevel: parseItemLevelFromTooltip(tooltip) ?? null,
      quality: qualityId !== undefined ? (QUALITY_BY_ID[qualityId] ?? null) : null,
      equipLoc: slotbak !== undefined ? (INVTYPE_TO_EQUIPLOC[slotbak] ?? null) : null,
      iconName,
    };
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function collectItemIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const rows = await db.armoryGearCache.findMany({ select: { gear: true } });

  for (const row of rows) {
    const gear = row.gear as Record<string, unknown>;
    if (!Array.isArray(gear.items)) continue;
    for (const item of gear.items as Record<string, unknown>[]) {
      if (typeof item.itemId === "string" && item.itemId) {
        ids.add(item.itemId);
      }
    }
  }

  return ids;
}

async function main() {
  console.log("Collecting item IDs from gear cache…");
  const allIds = await collectItemIds();
  console.log(`  Found ${allIds.size} distinct item IDs`);

  if (allIds.size === 0) {
    console.log("No gear data found. Import some gear first via the Tampermonkey scripts, then re-run.");
    return;
  }

  const existing = await db.wowItem.findMany({ select: { itemId: true } });
  const existingSet = new Set(existing.map(r => r.itemId));

  const toFetch = [...allIds].filter(id => !existingSet.has(id));
  console.log(`  ${existingSet.size} already seeded, ${toFetch.length} to fetch from Wowhead`);

  let done = 0;
  let failed = 0;

  for (const itemId of toFetch) {
    const data = await fetchWowheadItem(itemId);
    if (data) {
      await db.wowItem.upsert({
        where: { itemId },
        create: { itemId, ...data },
        update: { ...data },
      });
      done++;
    } else {
      failed++;
    }

    if ((done + failed) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${done + failed}/${toFetch.length} (${failed} failed)`);
    }

    await wait(WOWHEAD_DELAY_MS);
  }

  console.log(`\n\nDone. ${done} items seeded, ${failed} failed.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
