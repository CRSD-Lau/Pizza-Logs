import { isHtmlChallengePage, isWarmaneErrorJson } from "../validate";

const GUILD = "Pizza+Warriors";
const REALM = "Lordaeron";
const TIMEOUT_MS = 15_000;

export type RosterMember = {
  characterName: string;
  normalizedCharacterName: string;
  guildName: string;
  realm: string;
  className?: string;
  raceName?: string;
  level?: number;
  rankName?: string;
  rankOrder?: number;
  armoryUrl: string;
  lastSyncedAt: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeRosterJson(data: unknown): RosterMember[] | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).roster;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const now = new Date().toISOString();
  const members = raw
    .map((entry): RosterMember | null => {
      if (!entry || typeof entry !== "object") return null;
      const r = entry as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : null;
      if (!name) return null;
      return {
        characterName: name,
        normalizedCharacterName: normalizeName(name),
        guildName: "Pizza Warriors",
        realm: REALM,
        className: typeof r.class === "string" ? r.class : undefined,
        raceName: typeof r.race === "string" ? r.race : undefined,
        level: typeof r.level === "number" ? r.level : undefined,
        rankName:
          typeof r.rankName === "string" ? r.rankName : undefined,
        rankOrder:
          typeof r.rankOrder === "number" ? r.rankOrder : undefined,
        armoryUrl: `https://armory.warmane.com/character/${encodeURIComponent(name)}/${REALM}/summary`,
        lastSyncedAt: now,
      };
    })
    .filter((m): m is RosterMember => m !== null);

  return members.length > 0 ? members : null;
}

export async function fetchGuildRoster(): Promise<RosterMember[] | null> {
  const url = `https://armory.warmane.com/api/guild/${GUILD}/${REALM}/summary`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
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
    return normalizeRosterJson(data);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
