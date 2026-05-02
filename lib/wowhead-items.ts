/**
 * @deprecated Wowhead runtime enrichment is no longer used.
 * This file is kept for reference only. Do not import from it in production code.
 * Gear enrichment now uses lib/item-template.ts (AzerothCore item_template data).
 * Safe to delete after verifying no production imports remain.
 */
import { db } from "./db";
import { slugify } from "./utils";
import type { ArmoryGearItem } from "./warmane-armory";
import { mapWowheadInventoryTypeToEquipLoc } from "./gearscore";
import type { GearScoreEquipLoc } from "./gearscore";

type WowheadItemData = {
  itemId: string;
  name?: string;
  quality?: string;
  itemLevel?: number;
  iconUrl?: string;
  itemUrl: string;
  equipLoc?: GearScoreEquipLoc;
  details?: string[];
};

// Shape of the Wowhead /wotlk/tooltip/item/{id} JSON response
type WowheadTooltipResponse = {
  name?: string;
  quality?: number;
  icon?: string;
  tooltip?: string;
  jsonequip?: Record<string, unknown>;
};

const QUALITY_BY_ID: Record<number, string> = {
  0: "poor",
  1: "common",
  2: "uncommon",
  3: "rare",
  4: "epic",
  5: "legendary",
  6: "artifact",
  7: "heirloom",
};

const WOWHEAD_TIMEOUT_MS = 8_000;
const WOWHEAD_RETRY_ATTEMPTS = 3;
const WOWHEAD_RETRY_DELAY_MS = 600;
const WOWHEAD_ENRICHMENT_CONCURRENCY = 3;

export function getWowheadItemUrl(itemId: string, itemName?: string): string {
  const suffix = itemName ? `/${slugify(itemName)}` : "";
  return `https://www.wowhead.com/wotlk/item=${encodeURIComponent(itemId)}${suffix}`;
}

function getWowheadTooltipUrl(itemId: string): string {
  return `https://www.wowhead.com/wotlk/tooltip/item/${itemId}`;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

function parseTooltipDetails(tooltipHtml: string | null): string[] | undefined {
  if (!tooltipHtml) return undefined;

  const lines = decodeHtmlEntities(
    tooltipHtml
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|tr|table)>/gi, "\n")
      .replace(/<th[^>]*>/gi, " ")
      .replace(/<td[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const uniqueLines = [...new Set(lines)];
  return uniqueLines.length > 0 ? uniqueLines.slice(0, 18) : undefined;
}

// The tooltip HTML contains "Item Level <!--ilvl-->264" — strip the comment and parse the number.
function parseItemLevelFromTooltip(tooltipHtml: string): number | undefined {
  const match = tooltipHtml.match(/Item Level\s*(?:<!--[^-]*-->)?\s*(\d+)/i);
  const val = match ? Number(match[1]) : NaN;
  return Number.isFinite(val) && val > 0 ? val : undefined;
}

// Parse a Wowhead tooltip JSON API response into the shape the rest of the codebase expects.
// Exported so it can be unit-tested without a live HTTP call.
export function parseWowheadTooltipJson(
  itemId: string | number,
  json: WowheadTooltipResponse,
): WowheadItemData {
  const id = String(itemId);
  const name = asString(json.name);
  const qualityId = asNumber(json.quality);
  const iconName = asString(json.icon);
  const tooltipHtml = asString(json.tooltip) ?? null;

  const jsonequip = json.jsonequip && typeof json.jsonequip === "object" ? json.jsonequip : {};
  const inventoryType = asNumber(jsonequip.slotbak);

  return {
    itemId: id,
    name,
    quality: qualityId !== undefined ? QUALITY_BY_ID[qualityId] : undefined,
    itemLevel: parseItemLevelFromTooltip(tooltipHtml ?? ""),
    iconUrl: iconName ? `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg` : undefined,
    itemUrl: getWowheadItemUrl(id, name),
    equipLoc: mapWowheadInventoryTypeToEquipLoc(inventoryType),
    details: parseTooltipDetails(tooltipHtml),
  };
}

export async function fetchWowheadItemData(itemId: string, _itemName?: string): Promise<WowheadItemData | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= WOWHEAD_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WOWHEAD_TIMEOUT_MS);

    try {
      const response = await fetch(getWowheadTooltipUrl(itemId), {
        headers: {
          Accept: "application/json,*/*",
          "User-Agent": "PizzaLogsBot/0.1 (+https://pizza-logs-production.up.railway.app)",
        },
        signal: controller.signal,
        next: { revalidate: 60 * 60 * 24 * 7 },
      } as RequestInit & { next: { revalidate: number } });

      if (response.ok) {
        const json = await response.json() as WowheadTooltipResponse;
        return parseWowheadTooltipJson(itemId, json);
      }

      lastError = new Error(`Wowhead returned ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < WOWHEAD_RETRY_ATTEMPTS) {
      await wait(WOWHEAD_RETRY_DELAY_MS * attempt);
    }
  }

  console.error("Wowhead item fetch failed", { itemId, error: lastError });
  return null;
}

function dbItemToData(row: { itemId: string; name: string; itemLevel: number | null; quality: string | null; equipLoc: string | null; iconName: string | null }): WowheadItemData {
  const iconUrl = row.iconName ? `https://wow.zamimg.com/images/wow/icons/large/${row.iconName}.jpg` : undefined;
  return {
    itemId: row.itemId,
    name: row.name,
    quality: row.quality ?? undefined,
    itemLevel: row.itemLevel ?? undefined,
    iconUrl,
    itemUrl: getWowheadItemUrl(row.itemId, row.name),
    equipLoc: row.equipLoc as GearScoreEquipLoc | undefined,
  };
}

export async function enrichGearWithWowhead(items: ArmoryGearItem[]): Promise<ArmoryGearItem[]> {
  // Batch DB lookup first — avoids per-item Wowhead calls for known items
  const itemIds = items.map(i => i.itemId).filter((id): id is string => Boolean(id));
  const dbRows = itemIds.length > 0
    ? await db.wowItem.findMany({ where: { itemId: { in: itemIds } } })
    : [];
  const dbMap = new Map(dbRows.map(r => [r.itemId, r]));

  const enriched: ArmoryGearItem[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex++;
      const item = items[index];

      if (!item.itemId) {
        enriched[index] = item;
        continue;
      }

      const dbRow = dbMap.get(item.itemId);
      if (dbRow) {
        const cached = dbItemToData(dbRow);
        enriched[index] = {
          ...item,
          name:      cached.name      ?? item.name,
          quality:   cached.quality   ?? item.quality,
          itemLevel: cached.itemLevel ?? item.itemLevel,
          iconUrl:   cached.iconUrl   ?? item.iconUrl,
          itemUrl:   cached.itemUrl   ?? item.itemUrl,
          equipLoc:  cached.equipLoc  ?? item.equipLoc,
        };
        continue;
      }

      const wowhead = await fetchWowheadItemData(item.itemId, item.name);

      if (wowhead) {
        const iconName = wowhead.iconUrl
          ? wowhead.iconUrl.replace(/.*\/([^/]+)\.jpg$/, "$1")
          : null;
        await db.wowItem.upsert({
          where: { itemId: item.itemId },
          create: {
            itemId: item.itemId,
            name: wowhead.name ?? item.name,
            itemLevel: wowhead.itemLevel ?? null,
            quality: wowhead.quality ?? null,
            equipLoc: wowhead.equipLoc ?? null,
            iconName,
          },
          update: {
            name: wowhead.name ?? item.name,
            itemLevel: wowhead.itemLevel ?? null,
            quality: wowhead.quality ?? null,
            equipLoc: wowhead.equipLoc ?? null,
            iconName,
          },
        });
      }

      enriched[index] = {
        ...item,
        name:      wowhead?.name      ?? item.name,
        quality:   wowhead?.quality   ?? item.quality,
        itemLevel: wowhead?.itemLevel ?? item.itemLevel,
        iconUrl:   wowhead?.iconUrl   ?? item.iconUrl,
        itemUrl:   wowhead?.itemUrl   ?? item.itemUrl ?? getWowheadItemUrl(item.itemId, item.name),
        equipLoc:  wowhead?.equipLoc  ?? item.equipLoc,
        details:   wowhead?.details   ?? item.details,
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(WOWHEAD_ENRICHMENT_CONCURRENCY, items.length) }, () => worker())
  );

  return enriched;
}
