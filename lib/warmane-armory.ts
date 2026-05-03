import { db } from "./db";
import { enrichGearWithLocalTemplate } from "./item-template";
import type { GearScoreEquipLoc } from "./gearscore";

export type ArmoryGearItem = {
  slot: string;
  name: string;
  itemId?: string;
  quality?: string;
  itemLevel?: number;
  iconUrl?: string;
  itemUrl?: string;
  equipLoc?: GearScoreEquipLoc;
  details?: string[];
  enchant?: string;
  gems?: string[];
};

export type ArmoryCharacterGear = {
  characterName: string;
  realm: string;
  sourceUrl: string;
  fetchedAt: string;
  items: ArmoryGearItem[];
};

export type ArmoryGearResult =
  | { ok: true; gear: ArmoryCharacterGear; stale?: boolean }
  | { ok: false; sourceUrl: string; message: string };

type WarmaneEquipmentItem = {
  name?: unknown;
  item?: unknown;
  quality?: unknown;
  itemLevel?: unknown;
  itemlevel?: unknown;
  icon?: unknown;
  iconUrl?: unknown;
  equipLoc?: unknown;
  itemEquipLoc?: unknown;
  enchant?: unknown;
  gems?: unknown;
};

type WarmaneCharacterSummary = {
  name?: unknown;
  realm?: unknown;
  equipment?: unknown;
  error?: unknown;
};

export type ImportedArmoryGearPayload = {
  characterName?: unknown;
  name?: unknown;
  realm?: unknown;
  sourceUrl?: unknown;
  items?: unknown;
  equipment?: unknown;
};

export type WowItemIconBackfill = {
  itemId: string;
  name: string;
  itemLevel: number | null;
  quality: string | null;
  equipLoc: string | null;
  iconName: string;
};

const DEFAULT_REALM = "Lordaeron";
const CACHE_SECONDS = 60 * 60 * 12;
const CACHE_MS = CACHE_SECONDS * 1000;
const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "PizzaLogsBot/0.1 (+https://pizza-logs-production.up.railway.app)";

const EQUIPMENT_SLOTS = [
  "Head",
  "Neck",
  "Shoulder",
  "Back",
  "Chest",
  "Shirt",
  "Tabard",
  "Wrist",
  "Hands",
  "Waist",
  "Legs",
  "Feet",
  "Finger 1",
  "Finger 2",
  "Trinket 1",
  "Trinket 2",
  "Main Hand",
  "Off Hand",
  "Ranged",
] as const;

function sanitizeCharacterName(name: string): string | null {
  const normalized = name.trim();
  if (!/^[A-Za-z]{2,12}$/.test(normalized)) return null;
  return normalized;
}

function getCharacterKey(name: string): string {
  return name.trim().toLowerCase();
}

function sanitizeRealm(realm: string): string {
  return /^[A-Za-z]{2,24}$/.test(realm) ? realm : DEFAULT_REALM;
}

function getSourceUrl(characterName: string, realm: string): string {
  return `https://armory.warmane.com/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;
}

function getApiUrl(characterName: string, realm: string): string {
  return `https://armory.warmane.com/api/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeExternalIconUrl(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (!/^https?:$/.test(parsed.protocol)) return undefined;
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.map(asString).filter((gem): gem is string => Boolean(gem));
  return strings.length > 0 ? strings : undefined;
}

function asGearScoreEquipLoc(value: unknown): GearScoreEquipLoc | undefined {
  const equipLoc = asString(value);
  return equipLoc?.startsWith("INVTYPE_") ? equipLoc as GearScoreEquipLoc : undefined;
}

function sanitizeSourceUrl(value: unknown, characterName: string, realm: string): string {
  const fallback = getSourceUrl(characterName, realm);
  const url = asString(value);
  if (!url) return fallback;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "armory.warmane.com") return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function isArmoryGearItem(value: unknown): value is ArmoryGearItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.slot === "string" && typeof item.name === "string";
}

function isArmoryCharacterGear(value: unknown): value is ArmoryCharacterGear {
  if (!value || typeof value !== "object") return false;
  const gear = value as Record<string, unknown>;

  return (
    typeof gear.characterName === "string" &&
    typeof gear.realm === "string" &&
    typeof gear.sourceUrl === "string" &&
    typeof gear.fetchedAt === "string" &&
    Array.isArray(gear.items) &&
    gear.items.every(isArmoryGearItem)
  );
}

export function gearNeedsEnrichment(gear: unknown): boolean {
  if (!isArmoryCharacterGear(gear)) return true;
  return gear.items.some(item => !item.itemId || !item.itemLevel || !item.equipLoc || !item.iconUrl);
}

function normalizeEquipment(items: unknown): ArmoryGearItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw, index): ArmoryGearItem | null => {
      const item = raw as WarmaneEquipmentItem;
      const name = asString(item.name);
      if (!name) return null;

      const itemId = asString(item.item);
      const iconSlug = asString(item.icon);
      const directIcon = normalizeExternalIconUrl(item.iconUrl)
        ?? (iconSlug ? `https://wow.zamimg.com/images/wow/icons/large/${iconSlug}.jpg` : undefined);

      return {
        slot: EQUIPMENT_SLOTS[index] ?? `Slot ${index + 1}`,
        name,
        itemId,
        quality: asString(item.quality),
        itemLevel: asNumber(item.itemLevel) ?? asNumber(item.itemlevel),
        iconUrl: directIcon,
        itemUrl: undefined,
        equipLoc: asGearScoreEquipLoc(item.equipLoc) ?? asGearScoreEquipLoc(item.itemEquipLoc),
        enchant: asString(item.enchant),
        gems: asStringArray(item.gems),
      };
    })
    .filter((item): item is ArmoryGearItem => Boolean(item));
}

function iconNameFromZamimgUrl(iconUrl: string | undefined): string | null {
  if (!iconUrl) return null;

  try {
    const parsed = new URL(iconUrl);
    if (parsed.hostname !== "wow.zamimg.com") return null;
    const match = parsed.pathname.match(/\/images\/wow\/icons\/(?:large|medium|small)\/([^/.]+)\.jpg$/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function collectWowItemIconBackfills(items: ArmoryGearItem[]): WowItemIconBackfill[] {
  const backfills = new Map<string, WowItemIconBackfill>();

  for (const item of items) {
    if (!item.itemId || !item.name) continue;
    const iconName = iconNameFromZamimgUrl(item.iconUrl);
    if (!iconName) continue;

    backfills.set(item.itemId, {
      itemId: item.itemId,
      name: item.name,
      itemLevel: item.itemLevel ?? null,
      quality: item.quality ?? null,
      equipLoc: item.equipLoc ?? null,
      iconName,
    });
  }

  return Array.from(backfills.values());
}

async function backfillWowItemIcons(items: ArmoryGearItem[]): Promise<void> {
  const backfills = collectWowItemIconBackfills(items);
  if (backfills.length === 0) return;

  for (const item of backfills) {
    await db.wowItem.upsert({
      where: { itemId: item.itemId },
      create: {
        itemId: item.itemId,
        name: item.name,
        itemLevel: item.itemLevel,
        quality: item.quality,
        equipLoc: item.equipLoc,
        iconName: item.iconName,
      },
      update: {
        iconName: item.iconName,
      },
    });
  }
}

export function normalizeArmoryGearSlots(items: ArmoryGearItem[]): ArmoryGearItem[] {
  const seen = {
    finger: 0,
    trinket: 0,
    weapon: 0,
  };

  return items.map((item) => {
    let slot = item.slot;

    switch (item.equipLoc) {
      case "INVTYPE_HEAD":
        slot = "Head";
        break;
      case "INVTYPE_NECK":
        slot = "Neck";
        break;
      case "INVTYPE_SHOULDER":
        slot = "Shoulder";
        break;
      case "INVTYPE_CLOAK":
        slot = "Back";
        break;
      case "INVTYPE_CHEST":
      case "INVTYPE_ROBE":
        slot = "Chest";
        break;
      case "INVTYPE_BODY":
        slot = "Shirt";
        break;
      case "INVTYPE_WRIST":
        slot = "Wrist";
        break;
      case "INVTYPE_HAND":
        slot = "Hands";
        break;
      case "INVTYPE_WAIST":
        slot = "Waist";
        break;
      case "INVTYPE_LEGS":
        slot = "Legs";
        break;
      case "INVTYPE_FEET":
        slot = "Feet";
        break;
      case "INVTYPE_FINGER":
        seen.finger += 1;
        slot = seen.finger === 1 ? "Finger 1" : "Finger 2";
        break;
      case "INVTYPE_TRINKET":
        seen.trinket += 1;
        slot = seen.trinket === 1 ? "Trinket 1" : "Trinket 2";
        break;
      case "INVTYPE_WEAPONMAINHAND":
        slot = "Main Hand";
        break;
      case "INVTYPE_2HWEAPON":
      case "INVTYPE_WEAPON":
        seen.weapon += 1;
        slot = seen.weapon === 1 ? "Main Hand" : "Off Hand";
        break;
      case "INVTYPE_WEAPONOFFHAND":
      case "INVTYPE_SHIELD":
      case "INVTYPE_HOLDABLE":
        slot = "Off Hand";
        break;
      case "INVTYPE_RELIC":
      case "INVTYPE_RANGED":
      case "INVTYPE_THROWN":
      case "INVTYPE_RANGEDRIGHT":
        slot = "Ranged/Relic";
        break;
    }

    const iconUrl = normalizeExternalIconUrl(item.iconUrl) ?? item.iconUrl;
    if (slot === item.slot && iconUrl === item.iconUrl) return item;
    return { ...item, slot, iconUrl };
  });
}

export function normalizeImportedArmoryGear(
  payload: ImportedArmoryGearPayload
): { ok: true; gear: ArmoryCharacterGear } | { ok: false; error: string } {
  const characterName = sanitizeCharacterName(asString(payload.characterName) ?? asString(payload.name) ?? "");
  if (!characterName) return { ok: false, error: "Invalid character name." };

  const realm = sanitizeRealm(asString(payload.realm) ?? DEFAULT_REALM);
  const items = normalizeArmoryGearSlots(normalizeEquipment(payload.items ?? payload.equipment));
  if (items.length === 0) return { ok: false, error: "No gear items found in import." };

  return {
    ok: true,
    gear: {
      characterName,
      realm,
      sourceUrl: sanitizeSourceUrl(payload.sourceUrl, characterName, realm),
      fetchedAt: new Date().toISOString(),
      items,
    },
  };
}

async function fetchWarmaneGearLive(
  characterName: string,
  realm: string = DEFAULT_REALM
): Promise<ArmoryGearResult> {
  const sanitizedName = sanitizeCharacterName(characterName);
  const sanitizedRealm = sanitizeRealm(realm);
  const sourceUrl = getSourceUrl(sanitizedName ?? characterName, sanitizedRealm);

  if (!sanitizedName) {
    return {
      ok: false,
      sourceUrl,
      message: "No gear data available from Warmane Armory.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(getApiUrl(sanitizedName, sanitizedRealm), {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Warmane Armory returned ${response.status}`);
    }

    const data = (await response.json()) as WarmaneCharacterSummary;
    if (data.error) {
      throw new Error("Warmane Armory returned an error response");
    }

    return {
      ok: true,
      gear: {
        characterName: asString(data.name) ?? sanitizedName,
        realm: asString(data.realm) ?? sanitizedRealm,
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        items: normalizeArmoryGearSlots(await enrichGearWithLocalTemplate(normalizeEquipment(data.equipment))),
      },
    };
  } catch (error) {
    console.error("Warmane Armory fetch error", {
      characterName: sanitizedName,
      realm: sanitizedRealm,
      error,
    });

    return {
      ok: false,
      sourceUrl,
      message: "Gear data is temporarily unavailable from Warmane Armory.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveArmoryGearResult({
  cachedGear,
  liveResult,
}: {
  cachedGear?: ArmoryCharacterGear | null;
  liveResult: ArmoryGearResult;
}): ArmoryGearResult {
  if (liveResult.ok) return liveResult;
  if (cachedGear) return { ok: true, gear: cachedGear, stale: true };
  return liveResult;
}

async function readCachedGear(characterName: string, realm: string): Promise<ArmoryCharacterGear | null> {
  const cached = await db.armoryGearCache.findUnique({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(characterName),
        realm,
      },
    },
  });

  if (!cached || !isArmoryCharacterGear(cached.gear)) return null;
  return { ...cached.gear, items: normalizeArmoryGearSlots(cached.gear.items) };
}

export async function writeCachedGear(
  gear: ArmoryCharacterGear,
  opts?: { sourceAgent?: string }
): Promise<ArmoryCharacterGear> {
  // Skip enrichment if items are already fully enriched (e.g. posted by bridge)
  const needsEnrichment = gearNeedsEnrichment(gear);
  const enrichedGear: ArmoryCharacterGear = {
    ...gear,
    items: needsEnrichment
      ? normalizeArmoryGearSlots(await enrichGearWithLocalTemplate(gear.items))
      : normalizeArmoryGearSlots(gear.items),
  };
  await backfillWowItemIcons(enrichedGear.items);

  // Snapshot preservation: don't overwrite a healthy cache with a degraded fetch
  const existing = await db.armoryGearCache.findUnique({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(enrichedGear.characterName),
        realm: enrichedGear.realm,
      },
    },
    select: { gear: true },
  });

  if (existing && isArmoryCharacterGear(existing.gear)) {
    const existingCount = existing.gear.items.length;
    if (existingCount >= 10 && enrichedGear.items.length < Math.floor(existingCount * 0.5)) {
      // New snapshot has fewer than half the items of the existing one — skip write
      return enrichedGear;
    }
  }

  await db.armoryGearCache.upsert({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(enrichedGear.characterName),
        realm: enrichedGear.realm,
      },
    },
    create: {
      characterName: enrichedGear.characterName,
      characterKey: getCharacterKey(enrichedGear.characterName),
      realm: enrichedGear.realm,
      sourceUrl: enrichedGear.sourceUrl,
      gear: enrichedGear,
      fetchedAt: new Date(enrichedGear.fetchedAt),
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
      ...(opts?.sourceAgent ? { sourceAgent: opts.sourceAgent } : {}),
    },
    update: {
      characterName: enrichedGear.characterName,
      sourceUrl: enrichedGear.sourceUrl,
      gear: enrichedGear,
      fetchedAt: new Date(enrichedGear.fetchedAt),
      lastAttemptAt: new Date(),
      lastError: null,
      lastSuccessAt: new Date(),
      ...(opts?.sourceAgent ? { sourceAgent: opts.sourceAgent } : {}),
    },
  });

  return enrichedGear;
}

async function markRefreshFailed(
  characterName: string,
  realm: string,
  sourceUrl: string,
  message: string
): Promise<void> {
  try {
    await db.armoryGearCache.update({
      where: {
        characterKey_realm: {
          characterKey: getCharacterKey(characterName),
          realm,
        },
      },
      data: {
        sourceUrl,
        lastAttemptAt: new Date(),
        lastError: message,
      },
    });
  } catch {
    // No cached row exists yet; the returned public result already handles that state.
  }
}

export async function getWarmaneCharacterGear(
  characterName: string,
  realm: string = DEFAULT_REALM
): Promise<ArmoryGearResult> {
  const sanitizedName = sanitizeCharacterName(characterName);
  const sanitizedRealm = sanitizeRealm(realm);
  const sourceUrl = getSourceUrl(sanitizedName ?? characterName, sanitizedRealm);

  if (!sanitizedName) {
    return {
      ok: false,
      sourceUrl,
      message: "No gear data available from Warmane Armory.",
    };
  }

  let cachedGear = await readCachedGear(sanitizedName, sanitizedRealm);
  if (shouldRefreshArmoryGearCache({ cachedGear, now: new Date() }) && cachedGear && gearNeedsEnrichment(cachedGear)) {
    cachedGear = await writeCachedGear(cachedGear);
  }

  const cacheIsFresh = cachedGear && !shouldRefreshArmoryGearCache({ cachedGear, now: new Date() });

  if (cachedGear && cacheIsFresh) {
    // Always re-enrich details from local template at read time (fast batch lookup,
    // ensures AzerothCore stats are current regardless of what's stored in the cache blob)
    const freshItems = await enrichGearWithLocalTemplate(cachedGear.items);
    return { ok: true, gear: { ...cachedGear, items: normalizeArmoryGearSlots(freshItems) } };
  }

  const liveResult = await fetchWarmaneGearLive(sanitizedName, sanitizedRealm);

  if (liveResult.ok) {
    await writeCachedGear(liveResult.gear);
  } else {
    await markRefreshFailed(sanitizedName, sanitizedRealm, sourceUrl, liveResult.message);
  }

  const baseResult = resolveArmoryGearResult({ cachedGear, liveResult });
  if (baseResult.ok && baseResult.gear) {
    const freshItems = await enrichGearWithLocalTemplate(baseResult.gear.items);
    return { ...baseResult, gear: { ...baseResult.gear, items: normalizeArmoryGearSlots(freshItems) } };
  }
  return baseResult;
}

export function shouldRefreshArmoryGearCache({
  cachedGear,
  now,
}: {
  cachedGear?: ArmoryCharacterGear | null;
  now: Date;
}): boolean {
  if (!cachedGear) return true;
  if (gearNeedsEnrichment(cachedGear)) return true;

  const cachedFetchedAt = new Date(cachedGear.fetchedAt).getTime();
  return !Number.isFinite(cachedFetchedAt) || now.getTime() - cachedFetchedAt >= CACHE_MS;
}
