import { slugify } from "./utils";
import type { ArmoryGearItem } from "./warmane-armory";

type WowheadItemData = {
  itemId: string;
  name?: string;
  quality?: string;
  itemLevel?: number;
  iconUrl?: string;
  itemUrl: string;
  details?: string[];
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

export function getWowheadItemUrl(itemId: string, itemName?: string): string {
  const suffix = itemName ? `/${slugify(itemName)}` : "";
  return `https://www.wowhead.com/wotlk/item=${encodeURIComponent(itemId)}${suffix}`;
}

function extractJsonObjectAfter(pageHtml: string, marker: string): unknown | null {
  const start = pageHtml.indexOf(marker);
  if (start === -1) return null;

  const objectStart = pageHtml.indexOf("{", start);
  if (objectStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = objectStart; i < pageHtml.length; i++) {
    const char = pageHtml[i];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") inString = true;
    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) {
      try {
        return JSON.parse(pageHtml.slice(objectStart, i + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractJsonStringAfter(pageHtml: string, marker: string): string | null {
  const start = pageHtml.indexOf(marker);
  if (start === -1) return null;

  const stringStart = pageHtml.indexOf("\"", start);
  if (stringStart === -1) return null;

  let escaping = false;
  for (let i = stringStart + 1; i < pageHtml.length; i++) {
    const char = pageHtml[i];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === "\"") {
      try {
        return JSON.parse(pageHtml.slice(stringStart, i + 1)) as string;
      } catch {
        return null;
      }
    }
  }

  return null;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseWowheadItemPage(itemId: string | number, pageHtml: string): WowheadItemData | null {
  const id = String(itemId);
  const extendData = asRecord(extractJsonObjectAfter(pageHtml, `$.extend(g_items[${id}],`));
  const gathererData = asRecord(extractJsonObjectAfter(pageHtml, `WH.Gatherer.addData(3, 8,`));
  const gatheredItem = asRecord(gathererData?.[id]);
  const tooltipHtml = extractJsonStringAfter(pageHtml, `g_items[${id}].tooltip_enus = `);

  const name = asString(extendData?.name) ?? asString(gatheredItem?.name_enus);
  const iconName = asString(gatheredItem?.icon);
  const qualityId = asNumber(extendData?.quality) ?? asNumber(gatheredItem?.quality);
  const itemLevel = asNumber(extendData?.level);

  return {
    itemId: id,
    name,
    quality: qualityId !== undefined ? QUALITY_BY_ID[qualityId] : undefined,
    itemLevel,
    iconUrl: iconName ? `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg` : undefined,
    itemUrl: getWowheadItemUrl(id, name),
    details: parseTooltipDetails(tooltipHtml),
  };
}

export async function fetchWowheadItemData(itemId: string, itemName?: string): Promise<WowheadItemData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WOWHEAD_TIMEOUT_MS);

  try {
    const response = await fetch(getWowheadItemUrl(itemId, itemName), {
      headers: {
        Accept: "text/html,*/*",
        "User-Agent": "PizzaLogsBot/0.1 (+https://pizza-logs-production.up.railway.app)",
      },
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 * 7 },
    } as RequestInit & { next: { revalidate: number } });

    if (!response.ok) return null;
    return parseWowheadItemPage(itemId, await response.text());
  } catch (error) {
    console.error("Wowhead item fetch failed", { itemId, error });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichGearWithWowhead(items: ArmoryGearItem[]): Promise<ArmoryGearItem[]> {
  return Promise.all(items.map(async (item) => {
    if (!item.itemId) return item;

    const wowhead = await fetchWowheadItemData(item.itemId, item.name);
    return {
      ...item,
      name: wowhead?.name ?? item.name,
      quality: wowhead?.quality ?? item.quality,
      itemLevel: wowhead?.itemLevel ?? item.itemLevel,
      iconUrl: wowhead?.iconUrl ?? item.iconUrl,
      itemUrl: wowhead?.itemUrl ?? item.itemUrl ?? getWowheadItemUrl(item.itemId, item.name),
      details: wowhead?.details ?? item.details,
    };
  }));
}
