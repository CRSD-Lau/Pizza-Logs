import { realmFilterWhere } from "./realm-filter";

export const PLAYER_SEARCH_DEFAULT_GUILD = "PizzaWarriors";
export const PLAYER_SEARCH_DEFAULT_REALM = "Lordaeron";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 20;
const MAX_QUERY_LENGTH = 64;

type StringFilter = {
  contains?: string;
  equals?: string;
  mode?: "insensitive";
};

type PlayerFindManyArgs = {
  where?: { name?: StringFilter; realmId?: string };
  select?: unknown;
  orderBy?: unknown;
  take?: number;
};

type RosterFindManyArgs = {
  where?: {
    guildName?: string;
    realm?: string;
    normalizedCharacterName?: { contains?: string } | string;
  };
  select?: unknown;
  orderBy?: unknown;
  take?: number;
};

type PlayerRow = {
  id: string;
  name: string;
  class: string | null;
  realmId: string | null;
  realm: { name: string | null; host: string } | null;
};

type RosterRow = {
  id: string;
  characterName: string;
  normalizedCharacterName: string;
  realm: string;
  guildName: string;
  className: string | null;
  raceName: string | null;
  level: number | null;
};

export type PlayerSearchDb = {
  player: {
    findMany(args: PlayerFindManyArgs): Promise<PlayerRow[]>;
  };
  guildRosterMember: {
    findMany(args: RosterFindManyArgs): Promise<RosterRow[]>;
  };
};

export type PlayerSearchResult = {
  name: string;
  profilePath: string;
  realmName: string;
  realmId?: string;
  realmHost?: string;
  className: string | null;
  raceName: string | null;
  level: number | null;
  guildName: string | null;
  source: "logs" | "roster" | "logs+roster";
};

export type PlayerSearchKeyboardAction =
  | { type: "noop"; activeIndex: number }
  | { type: "close"; activeIndex: number }
  | { type: "highlight"; activeIndex: number }
  | { type: "navigate"; activeIndex: number; navigateIndex: number };

export function sanitizePlayerSearchQuery(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

export function buildPlayerProfilePath(name: string, realmName?: string, realmId?: string): string {
  const path = `/players/${encodeURIComponent(name)}`;
  const params = new URLSearchParams();
  if (realmName) params.set("realm", realmName);
  if (realmId) params.set("realmId", realmId);
  return params.size ? `${path}?${params}` : path;
}

export function getPlayerSearchKeyboardAction({
  key,
  resultCount,
  activeIndex,
}: {
  key: string;
  resultCount: number;
  activeIndex: number;
}): PlayerSearchKeyboardAction {
  if (key === "Escape") return { type: "close", activeIndex };

  if (key === "Enter") {
    if (resultCount <= 0) return { type: "noop", activeIndex };
    return {
      type: "navigate",
      activeIndex,
      navigateIndex: activeIndex >= 0 ? activeIndex : 0,
    };
  }

  if (key === "ArrowDown") {
    if (resultCount <= 0) return { type: "noop", activeIndex };
    return { type: "highlight", activeIndex: (activeIndex + 1) % resultCount };
  }

  if (key === "ArrowUp") {
    if (resultCount <= 0) return { type: "noop", activeIndex };
    return {
      type: "highlight",
      activeIndex: activeIndex <= 0 ? resultCount - 1 : activeIndex - 1,
    };
  }

  return { type: "noop", activeIndex };
}

export async function searchPlayers(
  db: PlayerSearchDb,
  rawQuery: string,
  options: { limit?: number; realmId?: string; includeDefaultRoster?: boolean } = {},
): Promise<PlayerSearchResult[]> {
  const query = sanitizePlayerSearchQuery(rawQuery);
  if (!query) return [];

  const normalizedQuery = query.toLowerCase();
  const limit = clampLimit(options.limit);
  const candidateLimit = Math.min(Math.max(limit * 3, 20), 60);
  const playerRealmWhere = realmFilterWhere(options.realmId);
  const rosterWhere = options.includeDefaultRoster === false ? null : {
    guildName: PLAYER_SEARCH_DEFAULT_GUILD,
    realm: PLAYER_SEARCH_DEFAULT_REALM,
  };

  const [exactPlayers, matchingPlayers, exactRoster, matchingRoster] = await Promise.all([
    db.player.findMany({
      where: { name: { equals: query, mode: "insensitive" }, ...playerRealmWhere },
      select: { id: true, name: true, class: true, realmId: true, realm: { select: { name: true, host: true } } },
      orderBy: { name: "asc" },
      take: candidateLimit,
    }),
    db.player.findMany({
      where: { name: { contains: query, mode: "insensitive" }, ...playerRealmWhere },
      select: { id: true, name: true, class: true, realmId: true, realm: { select: { name: true, host: true } } },
      orderBy: { name: "asc" },
      take: candidateLimit,
    }),
    rosterWhere ? db.guildRosterMember.findMany({
      where: { ...rosterWhere, normalizedCharacterName: normalizedQuery },
      select: {
        id: true,
        characterName: true,
        normalizedCharacterName: true,
        realm: true,
        guildName: true,
        className: true,
        raceName: true,
        level: true,
      },
      orderBy: { characterName: "asc" },
      take: candidateLimit,
    }) : Promise.resolve([] as RosterRow[]),
    rosterWhere ? db.guildRosterMember.findMany({
      where: { ...rosterWhere, normalizedCharacterName: { contains: normalizedQuery } },
      select: {
        id: true,
        characterName: true,
        normalizedCharacterName: true,
        realm: true,
        guildName: true,
        className: true,
        raceName: true,
        level: true,
      },
      orderBy: { characterName: "asc" },
      take: candidateLimit,
    }) : Promise.resolve([] as RosterRow[]),
  ]);

  const merged = new Map<string, PlayerSearchResult>();
  for (const player of [...exactPlayers, ...matchingPlayers]) {
    mergePlayerResult(merged, player);
  }
  for (const rosterMember of [...exactRoster, ...matchingRoster]) {
    mergeRosterResult(merged, rosterMember, options.realmId);
  }

  return Array.from(merged.values())
    .filter((result) => result.name.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => comparePlayerSearchResults(left, right, normalizedQuery))
    .slice(0, limit);
}

function mergePlayerResult(results: Map<string, PlayerSearchResult>, player: PlayerRow): void {
  const realmName = player.realm?.name ?? PLAYER_SEARCH_DEFAULT_REALM;
  const realmHost = player.realm?.host;
  const key = resultKey(player.name, realmName, realmHost);
  const existing = results.get(key);
  const realmId = player.realmId ?? existing?.realmId;

  results.set(key, {
    name: existing?.name ?? player.name,
    profilePath: buildPlayerProfilePath(existing?.name ?? player.name, realmName, realmId),
    realmName,
    ...(realmId ? { realmId } : {}),
    ...(realmHost ? { realmHost } : {}),
    className: player.class ?? existing?.className ?? null,
    raceName: existing?.raceName ?? null,
    level: existing?.level ?? null,
    guildName: existing?.guildName ?? null,
    source: existing?.source === "roster" || existing?.source === "logs+roster" ? "logs+roster" : "logs",
  });
}

function mergeRosterResult(
  results: Map<string, PlayerSearchResult>,
  member: RosterRow,
  selectedRealmId?: string,
): void {
  const realmName = member.realm || PLAYER_SEARCH_DEFAULT_REALM;
  // Roster records identify the established PizzaWarriors Warmane realm by name only.
  // Do not merge an equal realm name from another provider (or a legacy null realm).
  const realmHost = "warmane";
  const key = resultKey(member.characterName, realmName, realmHost);
  const existing = results.get(key);
  const realmId = existing?.realmId ?? selectedRealmId;

  results.set(key, {
    name: existing?.name ?? member.characterName,
    profilePath: buildPlayerProfilePath(existing?.name ?? member.characterName, realmName, realmId),
    realmName,
    ...(realmId ? { realmId } : {}),
    realmHost,
    className: existing?.className ?? member.className ?? null,
    raceName: member.raceName ?? existing?.raceName ?? null,
    level: member.level ?? existing?.level ?? null,
    guildName: member.guildName ?? existing?.guildName ?? null,
    source: existing?.source === "logs" || existing?.source === "logs+roster" ? "logs+roster" : "roster",
  });
}

function comparePlayerSearchResults(
  left: PlayerSearchResult,
  right: PlayerSearchResult,
  normalizedQuery: string,
): number {
  const leftRank = matchRank(left.name, normalizedQuery);
  const rightRank = matchRank(right.name, normalizedQuery);
  if (leftRank !== rightRank) return leftRank - rightRank;

  const leftSource = sourceRank(left.source);
  const rightSource = sourceRank(right.source);
  if (leftSource !== rightSource) return leftSource - rightSource;

  const nameCompare = left.name.localeCompare(right.name);
  if (nameCompare !== 0) return nameCompare;
  const realmCompare = left.realmName.localeCompare(right.realmName);
  if (realmCompare !== 0) return realmCompare;
  return (left.realmHost ?? "").localeCompare(right.realmHost ?? "");
}

function matchRank(name: string, normalizedQuery: string): number {
  const normalizedName = name.toLowerCase();
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return 3;
}

function sourceRank(source: PlayerSearchResult["source"]): number {
  if (source === "logs+roster") return 0;
  if (source === "logs") return 1;
  return 2;
}

function resultKey(name: string, realmName: string, realmHost?: string): string {
  return `${realmHost?.toLowerCase() ?? "legacy"}:${realmName.toLowerCase()}:${name.toLowerCase()}`;
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}
