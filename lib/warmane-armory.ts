import { db } from "./db";
import { readUpstreamText } from "./upstream-response";
import { enrichGearWithLocalTemplate } from "./item-template";
import type { GearScoreEquipLoc } from "./gearscore";
import { normalizePlayerClass } from "./player-class";
import { isMatchingArmorySource, playerIdentityKey } from "./player-identity";
import { PAPER_DOLL_LEFT_SLOTS, PAPER_DOLL_RIGHT_SLOTS, PAPER_DOLL_WEAPON_SLOTS } from "./gear-layout";

export type ArmoryGearItem = {
  slot: string;
  slotSource?: "armory-profile";
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

export type ArmoryCharacterAppearance = {
  modelId: string;
  skin: number;
  hairStyle: number;
  hairColor: number;
  face: number;
  facialHair: number;
  faceColor: number;
  earPiercing: number;
  hornStyle: number;
  tattoo: number;
  classId: number;
  items: Array<[number, number]>;
};

export type ArmoryCharacterGear = {
  characterName: string;
  realm: string;
  className?: string;
  classFetchedAt?: string;
  identityOnly?: boolean;
  raceName?: string;
  guildName?: string;
  sourceUrl: string;
  fetchedAt: string;
  items: ArmoryGearItem[];
  appearance?: ArmoryCharacterAppearance | null;
  appearanceStale?: boolean;
};

export type ArmoryCharacterIdentity = {
  characterName: string;
  realm: string;
  className: string;
  classFetchedAt: string;
  raceName?: string;
  guildName?: string;
};

export type ArmoryGearResult =
  | { ok: true; gear: ArmoryCharacterGear; stale?: boolean }
  | {
      ok: false;
      sourceUrl: string;
      message: string;
      appearance?: ArmoryCharacterAppearance;
      identity?: ArmoryCharacterIdentity;
    };

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
  class?: unknown;
  race?: unknown;
  guild?: unknown;
  equipment?: unknown;
  error?: unknown;
};

export type ImportedArmoryGearPayload = {
  characterName?: unknown;
  name?: unknown;
  realm?: unknown;
  className?: unknown;
  class?: unknown;
  raceName?: unknown;
  race?: unknown;
  guildName?: unknown;
  guild?: unknown;
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
  const trimmed = realm.trim();
  if (!/^[A-Za-z]{2,24}$/.test(trimmed)) return DEFAULT_REALM;
  return ["Lordaeron", "Icecrown", "Blackrock", "Onyxia"].find(value => value.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}

export function hasMatchingWarmaneProfileIdentity(html: string, name: string, realm: string): boolean {
  const title = html.match(/<title>\s*Warmane Armory\s*\|\s*Character\s+([A-Za-z]{2,12})\s*@\s*([A-Za-z]{2,24})\s*<\/title>/i);
  return Boolean(title && playerIdentityKey(title[1], title[2]) === playerIdentityKey(name, realm));
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

export function extractWarmaneGearIconUrls(html: string): Record<string, string> {
  const icons: Record<string, string> = {};
  const itemLinkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(itemLinkPattern)) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    const itemId = attributes.match(/(?:href|rel)=["'][^"']*\bitem=(\d+)/i)?.[1];
    const iconUrl = body.match(/<img\b[^>]*\bsrc=["']([^"']*cdn\.warmane\.com\/wotlk\/icons\/large\/[^"']+)["']/i)?.[1];
    if (!itemId || !iconUrl) continue;

    const normalized = normalizeExternalIconUrl(iconUrl);
    if (normalized) icons[itemId] = normalized;
  }

  return icons;
}

/** Read balanced divs only; nested icon wrappers must not consume an equipment position. */
function extractDivContents(html: string, className: string): string[] | null {
  const tags = /<\/?div\b[^>]*>/gi;
  const contents: string[] = [];
  let token: RegExpExecArray | null;
  while ((token = tags.exec(html))) {
    if (token[0].startsWith("</")) continue;
    const classes = token[0].match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1].split(/\s+/) ?? [];
    if (!classes.includes(className)) continue;
    const start = tags.lastIndex;
    let depth = 1;
    let scanned = 0;
    while ((token = tags.exec(html))) {
      if (++scanned > 256) return null;
      depth += token[0].startsWith("</") ? -1 : 1;
      if (depth === 0) break;
    }
    if (!token || depth !== 0 || contents.length >= 24) return null;
    contents.push(html.slice(start, token.index));
  }
  return contents;
}

export function extractWarmaneEquipmentSlots(html: string, characterName: string, realm: string): Array<{ slot: string; itemId: string | null }> {
  if (!hasMatchingWarmaneProfileIdentity(html, characterName, realm)) return [];
  const result: Array<{ slot: string; itemId: string | null }> = [];
  const rails = [
    ["item-left", PAPER_DOLL_LEFT_SLOTS], ["item-right", PAPER_DOLL_RIGHT_SLOTS], ["item-bottom", PAPER_DOLL_WEAPON_SLOTS],
  ] as const;
  for (const [className, slots] of rails) {
    const containers = extractDivContents(html, className);
    if (containers?.length !== 1) return [];
    const cells = extractDivContents(containers[0], "item-slot");
    // A changed or truncated grid cannot safely establish positional meaning.
    if (cells?.length !== slots.length) return [];
    for (const [index, cell] of cells.entries()) {
      const ids = new Set(Array.from(cell.matchAll(/<a\b[^>]*\bhref\s*=\s*["'][^"']*\bitem=(\d{1,8})(?:[^\d"'][^"']*)?["']/gi), match => match[1]));
      if (ids.size > 1) return [];
      result.push({ slot: slots[index], itemId: [...ids][0] ?? null });
    }
  }
  return result;
}

function assignProfileEquipmentSlots(items: ArmoryGearItem[], slots: Array<{ slot: string; itemId: string | null }>): ArmoryGearItem[] {
  const occurrences = new Map<string, string[]>();
  for (const entry of slots) {
    if (!entry.itemId) continue;
    const values = occurrences.get(entry.itemId) ?? [];
    values.push(entry.slot);
    occurrences.set(entry.itemId, values);
  }
  return items.map(item => {
    const slot = item.itemId ? occurrences.get(item.itemId)?.shift() : undefined;
    return slot ? { ...item, slot, slotSource: "armory-profile" } : item;
  });
}

export function extractWarmaneCharacterAppearance(html: string): ArmoryCharacterAppearance | null {
  const recipe = html.match(/var\s+charactermodel\s*=\s*\{([\s\S]*?)\s*\};/i)?.[1];
  if (!recipe) return null;

  const readInt = (key: string, max = 255): number | null => {
    const raw = recipe.match(new RegExp(`\\b${key}\\s*:\\s*(\\d+)`, "i"))?.[1];
    const value = raw ? Number(raw) : NaN;
    return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
  };

  const modelId = recipe.match(/\bmodels\s*:\s*\{[\s\S]*?\bid\s*:\s*['"]([a-z]+)['"]/i)?.[1]?.toLowerCase();
  if (!modelId || !/^[a-z]{3,32}$/.test(modelId)) return null;

  const itemBlock = recipe.match(/\bitems\s*:\s*\[([\s\S]*?)\]\s*,?\s*models\s*:/i)?.[1] ?? "";
  const items = Array.from(itemBlock.matchAll(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/g))
    .slice(0, 24)
    .map((match): [number, number] => [Number(match[1]), Number(match[2])])
    .filter(([slot, displayId]) => slot > 0 && slot <= 32 && displayId > 0 && displayId <= 1_000_000);

  const values = {
    skin: readInt("sk"),
    hairStyle: readInt("ha"),
    hairColor: readInt("hc"),
    face: readInt("fa"),
    facialHair: readInt("fh"),
    faceColor: readInt("fc"),
    earPiercing: readInt("ep"),
    hornStyle: readInt("ho"),
    tattoo: readInt("ta"),
    classId: readInt("cls", 20),
  };

  if (Object.values(values).some((value) => value === null)) return null;

  return {
    modelId,
    skin: values.skin!,
    hairStyle: values.hairStyle!,
    hairColor: values.hairColor!,
    face: values.face!,
    facialHair: values.facialHair!,
    faceColor: values.faceColor!,
    earPiercing: values.earPiercing!,
    hornStyle: values.hornStyle!,
    tattoo: values.tattoo!,
    classId: values.classId!,
    items,
  };
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

function isArmoryCharacterAppearance(value: unknown): value is ArmoryCharacterAppearance {
  if (!value || typeof value !== "object") return false;
  const appearance = value as Record<string, unknown>;
  const isIntegerInRange = (number: unknown, min: number, max: number) => (
    typeof number === "number" && Number.isInteger(number) && number >= min && number <= max
  );

  return (
    typeof appearance.modelId === "string" && /^[a-z]{3,32}$/.test(appearance.modelId) &&
    ["skin", "hairStyle", "hairColor", "face", "facialHair", "faceColor", "earPiercing", "hornStyle", "tattoo"]
      .every(key => isIntegerInRange(appearance[key], 0, 255)) &&
    isIntegerInRange(appearance.classId, 0, 20) &&
    Array.isArray(appearance.items) && appearance.items.length <= 24 &&
    appearance.items.every(item => (
      Array.isArray(item) && item.length === 2 &&
      isIntegerInRange(item[0], 1, 32) && isIntegerInRange(item[1], 1, 1_000_000)
    ))
  );
}

export function gearNeedsEnrichment(gear: unknown): boolean {
  if (!isArmoryCharacterGear(gear)) return true;
  return gear.items.some(item => !item.itemId || !item.itemLevel || !item.equipLoc || !item.iconUrl);
}

function normalizeEquipment(items: unknown, { positionalSlots = true }: { positionalSlots?: boolean } = {}): ArmoryGearItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw, index): ArmoryGearItem | null => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as WarmaneEquipmentItem;
      const name = asString(item.name);
      if (!name) return null;

      const itemId = asString(item.item);
      const iconSlug = asString(item.icon);
      const directIcon = normalizeExternalIconUrl(item.iconUrl)
        ?? (iconSlug ? `https://wow.zamimg.com/images/wow/icons/large/${iconSlug}.jpg` : undefined);

      return {
        slot: positionalSlots ? EQUIPMENT_SLOTS[index] ?? `Slot ${index + 1}` : "Unknown slot",
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
    if (item.slotSource === "armory-profile") slot = item.slot;
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
      ...(asString(payload.className) ?? asString(payload.class)
        ? { className: asString(payload.className) ?? asString(payload.class) }
        : {}),
      ...(asString(payload.raceName) ?? asString(payload.race)
        ? { raceName: asString(payload.raceName) ?? asString(payload.race) }
        : {}),
      ...(asString(payload.guildName) ?? asString(payload.guild)
        ? { guildName: asString(payload.guildName) ?? asString(payload.guild) }
        : {}),
      sourceUrl: sanitizeSourceUrl(payload.sourceUrl, characterName, realm),
      fetchedAt: new Date().toISOString(),
      items,
    },
  };
}

export async function fetchWarmaneGearLive(
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
  let liveAppearance: ArmoryCharacterAppearance | null = null;
  let liveIdentity: ArmoryCharacterIdentity | undefined;

  try {
    const requestHeaders = {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": USER_AGENT,
    };
    const [summaryResult, profileResult] = await Promise.allSettled([
      fetch(getApiUrl(sanitizedName, sanitizedRealm), {
        redirect: "error",
        headers: requestHeaders,
        signal: controller.signal,
      }),
      fetch(sourceUrl, {
        redirect: "error",
        headers: requestHeaders,
        signal: controller.signal,
      }).then(async pageResponse => {
        if (pageResponse.ok) return readUpstreamText(pageResponse);
        await pageResponse.body?.cancel().catch(() => undefined);
        return null;
      }),
    ]);
    const armoryHtml = profileResult.status === "fulfilled" ? profileResult.value : null;
    const profileMismatch = armoryHtml && /<title\b/i.test(armoryHtml) && !hasMatchingWarmaneProfileIdentity(armoryHtml, sanitizedName, sanitizedRealm);
    liveAppearance = armoryHtml && !profileMismatch ? extractWarmaneCharacterAppearance(armoryHtml) : null;
    const profileClass = armoryHtml && hasMatchingWarmaneProfileIdentity(armoryHtml, sanitizedName, sanitizedRealm)
      ? normalizePlayerClass(liveAppearance?.classId) : null;
    if (profileClass) liveIdentity = { characterName: sanitizedName, realm: sanitizedRealm, className: profileClass, classFetchedAt: new Date().toISOString() };

    if (summaryResult.status === "rejected") {
      throw summaryResult.reason;
    }
    const response = summaryResult.value;

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Warmane Armory returned ${response.status}`);
    }

    const data = JSON.parse(await readUpstreamText(response)) as WarmaneCharacterSummary;
    if (data.error) {
      throw new Error("Warmane Armory returned an error response");
    }
    if ((data.name !== undefined && (typeof data.name !== "string" || getCharacterKey(data.name) !== getCharacterKey(sanitizedName)))
      || (data.realm !== undefined && (typeof data.realm !== "string" || data.realm.trim().toLowerCase() !== sanitizedRealm.toLowerCase()))) {
      throw new Error("Warmane Armory returned a different character");
    }
    const summaryClass = normalizePlayerClass(data.class);
    if (summaryClass) liveIdentity = {
      characterName: sanitizedName, realm: sanitizedRealm, className: summaryClass, classFetchedAt: new Date().toISOString(),
      ...(asString(data.race) ? { raceName: asString(data.race) } : {}),
      ...(asString(data.guild) ? { guildName: asString(data.guild) } : {}),
    };
    if (!Array.isArray(data.equipment)) throw new Error("Warmane Armory equipment is unavailable");

    const liveIcons = armoryHtml ? extractWarmaneGearIconUrls(armoryHtml) : {};
    const profileSlots = armoryHtml ? extractWarmaneEquipmentSlots(armoryHtml, sanitizedName, sanitizedRealm) : [];
    const equipment = assignProfileEquipmentSlots(normalizeEquipment(data.equipment, {
      positionalSlots: data.equipment.length === EQUIPMENT_SLOTS.length,
    }), profileSlots).map(item => (
      item.iconUrl || !item.itemId || !liveIcons[item.itemId]
        ? item
        : { ...item, iconUrl: liveIcons[item.itemId] }
    ));

    return {
      ok: true,
      gear: {
        characterName: sanitizedName,
        realm: sanitizedRealm,
        ...(liveIdentity ? { className: liveIdentity.className, classFetchedAt: liveIdentity.classFetchedAt } : {}),
        ...(asString(data.race) ? { raceName: asString(data.race) } : {}),
        ...(asString(data.guild) ? { guildName: asString(data.guild) } : {}),
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        items: normalizeArmoryGearSlots(await enrichGearWithLocalTemplate(equipment)),
        appearance: liveAppearance,
      },
    };
  } catch (error) {
    console.error("Warmane Armory fetch error", {
      code: error instanceof Error && error.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_FAILURE",
    });

    return {
      ok: false,
      sourceUrl,
      message: "Gear data is temporarily unavailable from Warmane Armory.",
      ...(liveAppearance ? { appearance: liveAppearance } : {}),
      ...(liveIdentity ? { identity: liveIdentity } : {}),
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
  if (liveResult.ok) {
    const sameCharacter = cachedGear &&
      getCharacterKey(cachedGear.characterName) === getCharacterKey(liveResult.gear.characterName) &&
      cachedGear.realm.trim().toLowerCase() === liveResult.gear.realm.trim().toLowerCase();
    const cachedClass = sameCharacter ? normalizePlayerClass(cachedGear.className) : null;
    const gear = !normalizePlayerClass(liveResult.gear.className) && cachedClass && cachedGear
      ? { ...liveResult.gear, className: cachedClass, classFetchedAt: cachedGear.classFetchedAt ?? cachedGear.fetchedAt }
      : liveResult.gear;
    if (isArmoryCharacterAppearance(gear.appearance)) {
      return { ...liveResult, gear: { ...gear, appearanceStale: false } };
    }
    if (sameCharacter && isArmoryCharacterAppearance(cachedGear.appearance)) {
      return {
        ...liveResult,
        gear: { ...gear, appearance: cachedGear.appearance, appearanceStale: true },
      };
    }
    return gear === liveResult.gear ? liveResult : { ...liveResult, gear };
  }
  if (cachedGear) {
    const identity = liveResult.identity && playerIdentityKey(liveResult.identity.characterName, liveResult.identity.realm) === playerIdentityKey(cachedGear.characterName, cachedGear.realm)
      ? liveResult.identity : undefined;
    if (cachedGear.identityOnly) {
      const className = normalizePlayerClass(cachedGear.className);
      return { ...liveResult, ...(identity ? { identity } : className ? { identity: {
        characterName: cachedGear.characterName, realm: cachedGear.realm, className,
        classFetchedAt: cachedGear.classFetchedAt ?? cachedGear.fetchedAt,
        ...(cachedGear.raceName ? { raceName: cachedGear.raceName } : {}),
        ...(cachedGear.guildName ? { guildName: cachedGear.guildName } : {}),
      } } : {}) };
    }
    const gear = identity ? { ...cachedGear, ...identity } : cachedGear;
    return {
      ok: true,
      gear: isArmoryCharacterAppearance(liveResult.appearance)
        ? { ...gear, appearance: liveResult.appearance, appearanceStale: false }
        : gear,
      stale: true,
    };
  }
  return liveResult;
}

async function readCachedGear(characterName: string, realm: string): Promise<ArmoryCharacterGear | null> {
  const cached = await db.armoryGearCache.findFirst({
    where: {
      characterKey: { equals: getCharacterKey(characterName), mode: "insensitive" },
      realm: { equals: realm, mode: "insensitive" },
    },
    orderBy: [{ fetchedAt: "desc" }, { id: "asc" }],
  });

  if (!cached || !isArmoryCharacterGear(cached.gear)
    || !Number.isFinite(new Date(cached.gear.fetchedAt).getTime())
    || playerIdentityKey(cached.gear.characterName, cached.gear.realm) !== playerIdentityKey(characterName, realm)
    || !isMatchingArmorySource(cached.gear.sourceUrl, characterName, realm)) return null;
  return { ...cached.gear, realm: sanitizeRealm(cached.gear.realm), items: normalizeArmoryGearSlots(cached.gear.items) };
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
  const existing = await db.armoryGearCache.findFirst({
    where: {
      characterKey: { equals: getCharacterKey(enrichedGear.characterName), mode: "insensitive" },
      realm: { equals: enrichedGear.realm, mode: "insensitive" },
    },
    orderBy: [{ fetchedAt: "desc" }, { id: "asc" }],
    select: { gear: true, realm: true },
  });

  if (existing && isArmoryCharacterGear(existing.gear)) {
    const existingCount = existing.gear.items.length;
    if (existingCount >= 10 && enrichedGear.items.length < Math.floor(existingCount * 0.5)) {
      // New snapshot has fewer than half the items of the existing one - skip write
      return enrichedGear;
    }
  }

  await db.armoryGearCache.upsert({
    where: {
      characterKey_realm: {
        characterKey: getCharacterKey(enrichedGear.characterName),
        realm: existing?.realm ?? enrichedGear.realm,
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
  message: string,
  cachedGear?: ArmoryCharacterGear | null,
  identity?: ArmoryCharacterIdentity,
): Promise<void> {
  try {
    const existing = await db.armoryGearCache.findFirst({
      where: { characterKey: { equals: getCharacterKey(characterName), mode: "insensitive" }, realm: { equals: realm, mode: "insensitive" } },
      orderBy: [{ fetchedAt: "desc" }, { id: "asc" }], select: { realm: true },
    });
    const sameIdentity = identity && playerIdentityKey(identity.characterName, identity.realm) === playerIdentityKey(characterName, realm) ? identity : undefined;
    if (!existing && !sameIdentity) return;
    const identityGear: ArmoryCharacterGear | undefined = sameIdentity ? {
      ...sameIdentity, sourceUrl, fetchedAt: sameIdentity.classFetchedAt, items: [], appearance: null, identityOnly: true,
    } : undefined;
    const gear = cachedGear ? (sameIdentity ? { ...cachedGear, ...sameIdentity } : cachedGear) : identityGear;
    if (!gear) return;
    await db.armoryGearCache.upsert({
      where: {
        characterKey_realm: {
          characterKey: getCharacterKey(characterName),
          realm: existing?.realm ?? realm,
        },
      },
      create: { characterName, characterKey: getCharacterKey(characterName), realm, sourceUrl, gear,
        fetchedAt: new Date(gear.fetchedAt), lastAttemptAt: new Date(), lastError: message },
      update: {
        sourceUrl,
        lastAttemptAt: new Date(),
        lastError: message,
        gear,
      },
    });
  } catch {
    // The public response remains useful even if preserving identity is temporarily unavailable.
  }
}

export async function getWarmaneCharacterGear(
  characterName: string,
  realm: string = DEFAULT_REALM,
  options?: { maxAgeMs?: number },
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
  const maxAgeMs = options?.maxAgeMs ?? CACHE_MS;
  if (shouldRefreshArmoryGearCache({ cachedGear, now: new Date(), maxAgeMs }) && cachedGear && gearNeedsEnrichment(cachedGear)) {
    cachedGear = await writeCachedGear(cachedGear);
  }

  const cacheIsFresh = cachedGear && !shouldRefreshArmoryGearCache({ cachedGear, now: new Date(), maxAgeMs });

  if (cachedGear && cacheIsFresh && !cachedGear.identityOnly) {
    // Always re-enrich details from local template at read time (fast batch lookup,
    // ensures AzerothCore stats are current regardless of what's stored in the cache blob)
    const freshItems = await enrichGearWithLocalTemplate(cachedGear.items);
    return { ok: true, gear: { ...cachedGear, items: normalizeArmoryGearSlots(freshItems) } };
  }

  const liveResult = await fetchWarmaneGearLive(sanitizedName, sanitizedRealm);
  // Resolve both upstream sources before persisting so cache hits retain the same
  // appearance and its freshness marker as the immediate refresh response.
  const baseResult = resolveArmoryGearResult({ cachedGear, liveResult });

  if (liveResult.ok && baseResult.ok) {
    await writeCachedGear(baseResult.gear);
  } else if (!liveResult.ok) {
    await markRefreshFailed(
      sanitizedName, sanitizedRealm, sourceUrl, liveResult.message,
      baseResult.ok ? baseResult.gear : cachedGear,
      !baseResult.ok ? baseResult.identity : liveResult.identity,
    );
  }

  if (baseResult.ok && baseResult.gear) {
    const freshItems = await enrichGearWithLocalTemplate(baseResult.gear.items);
    return { ...baseResult, gear: { ...baseResult.gear, items: normalizeArmoryGearSlots(freshItems) } };
  }
  return baseResult;
}

export function shouldRefreshArmoryGearCache({
  cachedGear,
  now,
  maxAgeMs = CACHE_MS,
}: {
  cachedGear?: ArmoryCharacterGear | null;
  now: Date;
  maxAgeMs?: number;
}): boolean {
  if (!cachedGear) return true;
  if (cachedGear.identityOnly) return true;
  if (cachedGear.appearance === undefined) return true;
  if (gearNeedsEnrichment(cachedGear)) return true;

  const cachedFetchedAt = new Date(cachedGear.fetchedAt).getTime();
  return !Number.isFinite(cachedFetchedAt) || now.getTime() - cachedFetchedAt >= Math.max(0, maxAgeMs);
}
