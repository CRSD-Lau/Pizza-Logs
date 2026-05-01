import { db } from "./db";

export const DEFAULT_GUILD_NAME = "PizzaWarriors";
export const DEFAULT_GUILD_REALM = "Lordaeron";

const FETCH_TIMEOUT_MS = 8_000;
const SYNC_COOLDOWN_MS = 30 * 60 * 1000;
const USER_AGENT = "PizzaLogsBot/0.1 (+https://pizza-logs-production.up.railway.app)";

const WOW_CLASSES = [
  "Death Knight",
  "Druid",
  "Hunter",
  "Mage",
  "Paladin",
  "Priest",
  "Rogue",
  "Shaman",
  "Warlock",
  "Warrior",
] as const;

const WOW_RACES = [
  "Blood Elf",
  "Draenei",
  "Dwarf",
  "Gnome",
  "Human",
  "Night Elf",
  "Orc",
  "Tauren",
  "Troll",
  "Undead",
] as const;

const FACTIONS = new Set(["Alliance", "Horde"]);

type WarmaneGuildRosterContext = {
  guildName: string;
  realm: string;
  now?: Date;
};

export type GuildRosterMemberInput = {
  characterName: string;
  normalizedCharacterName: string;
  guildName: string;
  realm: string;
  className?: string;
  raceName?: string;
  level?: number;
  rankName?: string;
  armoryUrl: string;
  gearSnapshotJson?: unknown;
  lastSyncedAt: Date;
};

export type GuildRosterResult =
  | { ok: true; members: GuildRosterMemberInput[]; sourceUrl?: string }
  | { ok: false; message: string; sourceUrl?: string };

export type GuildRosterUpsert = {
  where: {
    normalizedCharacterName_guildName_realm: {
      normalizedCharacterName: string;
      guildName: string;
      realm: string;
    };
  };
  create: GuildRosterMemberInput;
  update: Omit<GuildRosterMemberInput, "normalizedCharacterName" | "guildName" | "realm">;
};

type GuildRosterDbClient = {
  guildRosterMember: {
    upsert: (operation: GuildRosterUpsert) => Promise<unknown>;
  };
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function sanitizeCharacterName(name: string): string | null {
  const normalized = name.trim();
  if (!/^[A-Za-z]{2,12}$/.test(normalized)) return null;
  return normalized;
}

function sanitizeGuildName(name: string): string {
  const normalized = name.trim();
  return /^[A-Za-z0-9 '\-]{2,64}$/.test(normalized) ? normalized : DEFAULT_GUILD_NAME;
}

function sanitizeRealm(realm: string): string {
  return /^[A-Za-z]{2,24}$/.test(realm) ? realm : DEFAULT_GUILD_REALM;
}

function normalizeCharacterName(name: string): string {
  return name.trim().toLowerCase();
}

function camelCaseGuildVariant(guildName: string): string {
  return guildName.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function encodeWarmaneGuildName(guildName: string): string {
  return guildName.trim().replace(/\s+/g, "+");
}

function getGuildNameCandidates(guildName: string): string[] {
  const sanitized = sanitizeGuildName(guildName);
  return Array.from(new Set([
    camelCaseGuildVariant(sanitized),
    sanitized,
  ]));
}

function getCharacterArmoryUrl(characterName: string, realm: string): string {
  return `https://armory.warmane.com/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`;
}

export function buildWarmaneGuildApiUrls(guildName: string, realm: string): string[] {
  const sanitizedRealm = sanitizeRealm(realm);
  return getGuildNameCandidates(guildName).map((candidate) => (
    `https://armory.warmane.com/api/guild/${encodeWarmaneGuildName(candidate)}/${encodeURIComponent(sanitizedRealm)}/summary`
  ));
}

function buildWarmaneGuildMembersApiUrls(guildName: string, realm: string): string[] {
  const sanitizedRealm = sanitizeRealm(realm);
  return getGuildNameCandidates(guildName).map((candidate) => (
    `https://armory.warmane.com/api/guild/${encodeWarmaneGuildName(candidate)}/${encodeURIComponent(sanitizedRealm)}/members`
  ));
}

function buildWarmaneGuildHtmlUrls(guildName: string, realm: string): string[] {
  const sanitizedRealm = sanitizeRealm(realm);
  return getGuildNameCandidates(guildName).map((candidate) => (
    `https://armory.warmane.com/guild/${encodeWarmaneGuildName(candidate)}/${encodeURIComponent(sanitizedRealm)}/summary`
  ));
}

function getRosterArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.roster)) return record.roster;
  if (Array.isArray(record.members)) return record.members;
  if (Array.isArray(record.guildmembers)) return record.guildmembers;
  return null;
}

function normalizeMember(raw: unknown, context: Required<WarmaneGuildRosterContext>): GuildRosterMemberInput | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const characterName = sanitizeCharacterName(
    asString(row.name) ?? asString(row.characterName) ?? asString(row.character) ?? ""
  );

  if (!characterName) return null;

  return {
    characterName,
    normalizedCharacterName: normalizeCharacterName(characterName),
    guildName: context.guildName,
    realm: context.realm,
    className: asString(row.class) ?? asString(row.className),
    raceName: asString(row.race) ?? asString(row.raceName),
    level: asNumber(row.level),
    rankName: asString(row.rank) ?? asString(row.rankName) ?? asString(row.rankname),
    armoryUrl: getCharacterArmoryUrl(characterName, context.realm),
    lastSyncedAt: context.now,
  };
}

export function normalizeWarmaneGuildRosterPayload(
  payload: unknown,
  context: WarmaneGuildRosterContext
): GuildRosterResult {
  const guildName = sanitizeGuildName(context.guildName);
  const realm = sanitizeRealm(context.realm);
  const now = context.now ?? new Date();
  const roster = getRosterArray(payload);

  if (!roster) {
    return { ok: false, message: "Warmane roster response did not include usable guild members." };
  }

  const members = roster
    .map((raw) => normalizeMember(raw, { guildName, realm, now }))
    .filter((member): member is GuildRosterMemberInput => Boolean(member));

  if (members.length === 0) {
    return { ok: false, message: "Warmane roster response did not include usable guild members." };
  }

  return { ok: true, members };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "));
}

function extractCellValues(rowHtml: string): string[] {
  const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi));
  return cells
    .map(([, cellHtml]) => {
      const imageLabels = Array.from(cellHtml.matchAll(/\b(?:alt|title)=["']([^"']+)["']/gi))
        .map(([, label]) => decodeHtmlEntities(label));
      const text = stripTags(cellHtml);
      return [...imageLabels, text]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
}

function findKnownValue(values: string[], knownValues: readonly string[]): string | undefined {
  return values.find((value) => knownValues.some((known) => value.includes(known)))
    ?.replace(/\s+/g, " ")
    .trim();
}

function normalizeKnownValue(value: string | undefined, knownValues: readonly string[]): string | undefined {
  if (!value) return undefined;
  return knownValues.find((known) => value.includes(known));
}

function findLevel(values: string[]): number | undefined {
  for (const value of values) {
    const match = value.match(/\b([1-7]?\d|80)\b/);
    if (!match) continue;
    const level = Number(match[1]);
    if (level > 0 && level <= 80) return level;
  }
  return undefined;
}

function findRank(values: string[], level?: number): string | undefined {
  const levelIndex = level ? values.findIndex((value) => new RegExp(`\\b${level}\\b`).test(value)) : -1;
  const candidates = levelIndex >= 0 ? values.slice(levelIndex + 1) : values;

  return candidates.find((value) => {
    if (!value || /^\d+$/.test(value)) return false;
    if (FACTIONS.has(value)) return false;
    if (normalizeKnownValue(value, WOW_CLASSES) || normalizeKnownValue(value, WOW_RACES)) return false;
    return !/Alchemy|Blacksmithing|Enchanting|Engineering|Herbalism|Inscription|Jewelcrafting|Leatherworking|Mining|Skinning|Tailoring/i.test(value);
  });
}

export function parseWarmaneGuildRosterHtml(
  html: string,
  context: WarmaneGuildRosterContext
): GuildRosterResult {
  const guildName = sanitizeGuildName(context.guildName);
  const realm = sanitizeRealm(context.realm);
  const now = context.now ?? new Date();
  const members: GuildRosterMemberInput[] = [];
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));

  for (const [, rowHtml] of rows) {
    const linkMatch = rowHtml.match(/href=["'](?:https?:\/\/armory\.warmane\.com)?\/character\/([^\/"']+)\/([^\/"']+)\/summary["']/i);
    if (!linkMatch || decodeURIComponent(linkMatch[2]) !== realm) continue;

    const characterName = sanitizeCharacterName(decodeURIComponent(linkMatch[1]));
    if (!characterName) continue;

    const cellValues = extractCellValues(rowHtml).filter((value) => value !== characterName);
    const rawRace = findKnownValue(cellValues, WOW_RACES);
    const rawClass = findKnownValue(cellValues, WOW_CLASSES);
    const level = findLevel(cellValues);

    members.push({
      characterName,
      normalizedCharacterName: normalizeCharacterName(characterName),
      guildName,
      realm,
      className: normalizeKnownValue(rawClass, WOW_CLASSES),
      raceName: normalizeKnownValue(rawRace, WOW_RACES),
      level,
      rankName: findRank(cellValues, level),
      armoryUrl: getCharacterArmoryUrl(characterName, realm),
      lastSyncedAt: now,
    });
  }

  if (members.length === 0) {
    return { ok: false, message: "Warmane roster page did not include usable guild members." };
  }

  return { ok: true, members };
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWarmaneGuildRoster(
  guildName: string = DEFAULT_GUILD_NAME,
  realm: string = DEFAULT_GUILD_REALM,
): Promise<GuildRosterResult> {
  const context = {
    guildName: sanitizeGuildName(guildName),
    realm: sanitizeRealm(realm),
    now: new Date(),
  };
  const jsonUrls = [...buildWarmaneGuildApiUrls(context.guildName, context.realm), ...buildWarmaneGuildMembersApiUrls(context.guildName, context.realm)];

  for (const url of jsonUrls) {
    try {
      const response = await fetchWithTimeout(url, "application/json,text/plain,*/*");
      if (!response.ok) throw new Error(`Warmane Armory returned ${response.status}`);
      const result = normalizeWarmaneGuildRosterPayload(await response.json(), context);
      if (result.ok) return { ...result, sourceUrl: url };
    } catch (error) {
      console.error("Warmane guild roster JSON fetch error", { guildName: context.guildName, realm: context.realm, url, error });
    }
  }

  for (const url of buildWarmaneGuildHtmlUrls(context.guildName, context.realm)) {
    try {
      const response = await fetchWithTimeout(url, "text/html,application/xhtml+xml,*/*");
      if (!response.ok) throw new Error(`Warmane Armory returned ${response.status}`);
      const result = parseWarmaneGuildRosterHtml(await response.text(), context);
      if (result.ok) return { ...result, sourceUrl: url };
    } catch (error) {
      console.error("Warmane guild roster HTML fetch error", { guildName: context.guildName, realm: context.realm, url, error });
    }
  }

  return {
    ok: false,
    message: "Guild roster sync is temporarily unavailable from Warmane Armory.",
    sourceUrl: buildWarmaneGuildHtmlUrls(context.guildName, context.realm)[0],
  };
}

export function toGuildRosterRecord(member: GuildRosterMemberInput): GuildRosterUpsert {
  return {
    where: {
      normalizedCharacterName_guildName_realm: {
        normalizedCharacterName: member.normalizedCharacterName,
        guildName: member.guildName,
        realm: member.realm,
      },
    },
    create: member,
    update: {
      characterName: member.characterName,
      className: member.className,
      raceName: member.raceName,
      level: member.level,
      rankName: member.rankName,
      armoryUrl: member.armoryUrl,
      gearSnapshotJson: member.gearSnapshotJson,
      lastSyncedAt: member.lastSyncedAt,
    },
  };
}

export async function upsertGuildRosterMembers(
  dbClient: GuildRosterDbClient,
  members: GuildRosterMemberInput[],
): Promise<void> {
  for (const member of members) {
    await dbClient.guildRosterMember.upsert(toGuildRosterRecord(member));
  }
}

export async function readGuildRosterMembers(
  guildName: string = DEFAULT_GUILD_NAME,
  realm: string = DEFAULT_GUILD_REALM,
) {
  return db.guildRosterMember.findMany({
    where: {
      guildName: sanitizeGuildName(guildName),
      realm: sanitizeRealm(realm),
    },
    orderBy: [
      { className: "asc" },
      { characterName: "asc" },
    ],
  });
}

export async function syncGuildRoster({
  guildName = DEFAULT_GUILD_NAME,
  realm = DEFAULT_GUILD_REALM,
  force = false,
}: {
  guildName?: string;
  realm?: string;
  force?: boolean;
} = {}): Promise<{ ok: true; count: number; skipped?: boolean } | { ok: false; message: string }> {
  const sanitizedGuild = sanitizeGuildName(guildName);
  const sanitizedRealm = sanitizeRealm(realm);

  if (!force) {
    const latest = await db.guildRosterMember.findFirst({
      where: { guildName: sanitizedGuild, realm: sanitizedRealm },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    });

    if (latest && Date.now() - latest.lastSyncedAt.getTime() < SYNC_COOLDOWN_MS) {
      const count = await db.guildRosterMember.count({
        where: { guildName: sanitizedGuild, realm: sanitizedRealm },
      });
      return { ok: true, count, skipped: true };
    }
  }

  const result = await fetchWarmaneGuildRoster(sanitizedGuild, sanitizedRealm);
  if (!result.ok) return { ok: false, message: result.message };

  await upsertGuildRosterMembers(db as unknown as GuildRosterDbClient, result.members);
  return { ok: true, count: result.members.length };
}
