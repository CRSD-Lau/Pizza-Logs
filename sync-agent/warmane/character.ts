import { isHtmlChallengePage, isWarmaneErrorJson, isValidGearPayload } from "../validate";
import { fetchWowheadItem } from "./wowhead";

const TIMEOUT_MS = 10_000;
const WOWHEAD_DELAY_MS = 1_500;

export type GearItem = {
  slot: string;
  name: string;
  itemId?: string;
  quality?: string;
  itemLevel?: number;
  iconUrl?: string;
  itemUrl?: string;
  equipLoc?: string;
  enchant?: string;
  gems?: string[];
};

export type CharacterGear = {
  characterName: string;
  realm: string;
  sourceUrl: string;
  fetchedAt: string;
  items: GearItem[];
};

const SLOTS = [
  "Head", "Neck", "Shoulder", "Back", "Chest", "Shirt", "Tabard", "Wrist",
  "Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2",
  "Trinket 1", "Trinket 2", "Main Hand", "Off Hand", "Ranged",
] as const;

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichItem(item: GearItem): Promise<GearItem> {
  if (item.itemLevel && item.iconUrl) return item;
  if (!item.itemId) return item;

  const data = await fetchWowheadItem(item.itemId);
  await delay(WOWHEAD_DELAY_MS);

  return {
    ...item,
    itemLevel: item.itemLevel ?? data.itemLevel,
    iconUrl: item.iconUrl ?? data.iconUrl,
    itemUrl:
      item.itemUrl ??
      `https://www.wowhead.com/wotlk/item=${item.itemId}`,
  };
}

export async function fetchCharacterGear(
  characterName: string,
  realm: string,
  opts?: { enrich?: boolean }
): Promise<CharacterGear | null> {
  const apiUrl = `https://armory.warmane.com/api/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;
  const sourceUrl = `https://armory.warmane.com/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    const text = await res.text();
    if (isHtmlChallengePage(text)) return null;

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }

    if (isWarmaneErrorJson(data)) return null;
    if (!isValidGearPayload(data)) return null;

    const rawItems = (data as { equipment: unknown[] }).equipment;
    const items: GearItem[] = rawItems
      .map((raw, i): GearItem | null => {
        if (!raw || typeof raw !== "object") return null;
        const r = raw as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name.trim() : null;
        if (!name) return null;
        const itemId =
          typeof r.item === "string"
            ? r.item
            : typeof r.item === "number"
            ? String(r.item)
            : undefined;
        return {
          slot: SLOTS[i] ?? `Slot ${i + 1}`,
          name,
          itemId,
          quality: typeof r.quality === "string" ? r.quality : undefined,
          itemLevel:
            typeof r.itemLevel === "number" ? r.itemLevel : undefined,
          iconUrl:
            typeof r.iconUrl === "string" ? r.iconUrl : undefined,
          equipLoc:
            typeof r.equipLoc === "string" ? r.equipLoc : undefined,
          enchant:
            typeof r.enchant === "string" ? r.enchant : undefined,
        };
      })
      .filter((item): item is GearItem => item !== null);

    if (items.length === 0) return null;

    const finalItems =
      opts?.enrich !== false
        ? await Promise.all(items.map(enrichItem))
        : items;

    return {
      characterName:
        typeof (data as Record<string, unknown>).name === "string"
          ? (data as Record<string, unknown>).name as string
          : characterName,
      realm,
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      items: finalItems,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
