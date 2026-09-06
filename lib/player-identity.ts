import { normalizePlayerClass } from "./player-class";

export const DEFAULT_PLAYER_REALM = "Lordaeron";
export type PlayerClassSource = "armory" | "roster" | "combat-log" | "unknown";
export type PlayerIdentityObservation = {
  characterName: string;
  realm: string;
  className: unknown;
  observedAt: Date | string | null;
  source: "armory" | "roster";
  sourceUrl: string;
  raceName?: string | null;
  guildName?: string | null;
};

export function playerIdentityKey(name: string, realm?: string | null): string {
  return `${name.trim().toLowerCase()}@${(realm?.trim() || DEFAULT_PLAYER_REALM).toLowerCase()}`;
}

export function isMatchingArmorySource(sourceUrl: string, name: string, realm: string): boolean {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    return url.protocol === "https:" && url.hostname === "armory.warmane.com" && !url.username && !url.password
      && !url.port && parts.length === 4 && parts[0] === "character" && parts[3] === "summary"
      && playerIdentityKey(parts[1], parts[2]) === playerIdentityKey(name, realm);
  } catch {
    return false;
  }
}

/** Log inference is a fallback; only a dated observation for this exact character may override it. */
export function resolvePlayerIdentity(
  player: { name: string; realmName?: string | null; class?: unknown },
  observations: readonly PlayerIdentityObservation[],
) {
  const realmName = player.realmName?.trim() || DEFAULT_PLAYER_REALM;
  const key = playerIdentityKey(player.name, realmName);
  const valid = observations.flatMap(observation => {
    const className = normalizePlayerClass(observation.className);
    const observedAt = observation.observedAt === null ? NaN : new Date(observation.observedAt).getTime();
    if (!className || !Number.isFinite(observedAt)
      || playerIdentityKey(observation.characterName, observation.realm) !== key
      || !isMatchingArmorySource(observation.sourceUrl, player.name, realmName)) return [];
    return [{ ...observation, className, timestamp: observedAt }];
  }).sort((a, b) => b.timestamp - a.timestamp
    || (a.source === b.source ? 0 : a.source === "armory" ? -1 : 1)
    || a.className.localeCompare(b.className)
    || (a.guildName ?? "").localeCompare(b.guildName ?? ""));
  const selected = valid[0];
  const conflicting = selected && valid.some(observation => observation.timestamp === selected.timestamp && observation.className !== selected.className);
  if (conflicting) return { className: null, classSource: "unknown" as const, raceName: null, guildName: null, observedAt: new Date(selected.timestamp).toISOString() };
  const className = selected?.className ?? normalizePlayerClass(player.class);
  return {
    className,
    classSource: (selected?.source ?? (className ? "combat-log" : "unknown")) as PlayerClassSource,
    raceName: selected?.raceName ?? null,
    guildName: selected?.guildName ?? null,
    observedAt: selected ? new Date(selected.timestamp).toISOString() : null,
  };
}
