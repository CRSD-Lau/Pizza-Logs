import { db } from "./db";

export type ArmoryGearItem = {
  slot: string;
  name: string;
  quality?: string;
  itemLevel?: number;
  iconUrl?: string;
  itemUrl?: string;
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

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.map(asString).filter((gem): gem is string => Boolean(gem));
  return strings.length > 0 ? strings : undefined;
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

function normalizeEquipment(items: unknown): ArmoryGearItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw, index): ArmoryGearItem | null => {
      const item = raw as WarmaneEquipmentItem;
      const name = asString(item.name);
      if (!name) return null;

      const itemId = asString(item.item);
      const directIcon = asString(item.iconUrl) ?? asString(item.icon);
      const iconUrl = directIcon?.startsWith("http") ? directIcon : undefined;

      return {
        slot: EQUIPMENT_SLOTS[index] ?? `Slot ${index + 1}`,
        name,
        quality: asString(item.quality),
        itemLevel: asNumber(item.itemLevel) ?? asNumber(item.itemlevel),
        iconUrl,
        itemUrl: itemId ? `https://armory.warmane.com/item/${encodeURIComponent(itemId)}` : undefined,
        enchant: asString(item.enchant),
        gems: asStringArray(item.gems),
      };
    })
    .filter((item): item is ArmoryGearItem => Boolean(item));
}

export function normalizeImportedArmoryGear(
  payload: ImportedArmoryGearPayload
): { ok: true; gear: ArmoryCharacterGear } | { ok: false; error: string } {
  const characterName = sanitizeCharacterName(asString(payload.characterName) ?? asString(payload.name) ?? "");
  if (!characterName) return { ok: false, error: "Invalid character name." };

  const realm = sanitizeRealm(asString(payload.realm) ?? DEFAULT_REALM);
  const items = normalizeEquipment(payload.items ?? payload.equipment);
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
        items: normalizeEquipment(data.equipment),
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
  return cached.gear;
}

export async function writeCachedGear(gear: ArmoryCharacterGear): Promise<void> {
  await db.armoryGearCache.upsert({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(gear.characterName),
        realm: gear.realm,
      },
    },
    create: {
      characterName: gear.characterName,
      characterKey: getCharacterKey(gear.characterName),
      realm: gear.realm,
      sourceUrl: gear.sourceUrl,
      gear,
      fetchedAt: new Date(gear.fetchedAt),
      lastAttemptAt: new Date(),
    },
    update: {
      characterName: gear.characterName,
      sourceUrl: gear.sourceUrl,
      gear,
      fetchedAt: new Date(gear.fetchedAt),
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
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

  const cachedGear = await readCachedGear(sanitizedName, sanitizedRealm);
  const cachedFetchedAt = cachedGear ? new Date(cachedGear.fetchedAt).getTime() : 0;
  const cacheIsFresh = cachedGear && Number.isFinite(cachedFetchedAt) && Date.now() - cachedFetchedAt < CACHE_MS;

  if (cacheIsFresh) {
    return { ok: true, gear: cachedGear };
  }

  const liveResult = await fetchWarmaneGearLive(sanitizedName, sanitizedRealm);

  if (liveResult.ok) {
    await writeCachedGear(liveResult.gear);
  } else {
    await markRefreshFailed(sanitizedName, sanitizedRealm, sourceUrl, liveResult.message);
  }

  return resolveArmoryGearResult({ cachedGear, liveResult });
}
