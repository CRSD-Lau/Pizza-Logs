import { db } from "./db";
import { countedAttemptWhere } from "./attempt-policy.server";
import { directoryNameMatches, getDirectoryPagination } from "./directory-pagination";
import { normalizePlayerClass } from "./player-class";
import { DEFAULT_PLAYER_REALM, playerIdentityKey, resolvePlayerIdentity, type PlayerIdentityObservation } from "./player-identity";

export const PLAYERS_PER_PAGE = 30;

type StoredObservation = PlayerIdentityObservation & {
  payloadName: string | null;
  payloadRealm: string | null;
  classObservedAt: string | null;
};

/** Only identity fields leave PostgreSQL; equipment and appearance payloads are never loaded here. */
export async function getStoredPlayerIdentityObservations(name?: string, realm?: string): Promise<PlayerIdentityObservation[]> {
  const rows = await db.$queryRaw<StoredObservation[]>`
    SELECT c."characterName", c.realm, c.gear->>'characterName' AS "payloadName",
      c.gear->>'realm' AS "payloadRealm", c.gear->>'className' AS "className",
      c.gear->>'classFetchedAt' AS "classObservedAt",
      c."fetchedAt" AS "observedAt", 'armory' AS source, c."sourceUrl",
      c.gear->>'raceName' AS "raceName", c.gear->>'guildName' AS "guildName"
    FROM armory_gear_cache c
    WHERE lower(trim(c."characterKey")) = lower(trim(c."characterName"))
      AND (${name ?? null}::text IS NULL OR lower(trim(c."characterName")) = lower(trim(${name ?? null}::text)))
      AND (${realm ?? null}::text IS NULL OR lower(trim(c.realm)) = lower(trim(${realm ?? null}::text)))
      AND (${name ?? null}::text IS NOT NULL OR EXISTS (SELECT 1 FROM players p LEFT JOIN realms r ON r.id = p."realmId"
        WHERE lower(trim(p.name)) = lower(trim(c."characterName"))
          AND lower(COALESCE(NULLIF(trim(r.name), ''), 'Lordaeron')) = lower(trim(c.realm))))
    UNION ALL
    SELECT m.character_name AS "characterName", m.realm, m.character_name AS "payloadName",
      m.realm AS "payloadRealm", m.class_name AS "className", NULL AS "classObservedAt",
      m.last_synced_at AS "observedAt", 'roster' AS source,
      m.armory_url AS "sourceUrl", m.race_name AS "raceName", m.guild_name AS "guildName"
    FROM guild_roster_members m
    WHERE lower(trim(m.normalized_character_name)) = lower(trim(m.character_name))
      AND (${name ?? null}::text IS NULL OR lower(trim(m.character_name)) = lower(trim(${name ?? null}::text)))
      AND (${realm ?? null}::text IS NULL OR lower(trim(m.realm)) = lower(trim(${realm ?? null}::text)))
      AND (${name ?? null}::text IS NOT NULL OR EXISTS (SELECT 1 FROM players p LEFT JOIN realms r ON r.id = p."realmId"
        WHERE lower(trim(p.name)) = lower(trim(m.character_name))
          AND lower(COALESCE(NULLIF(trim(r.name), ''), 'Lordaeron')) = lower(trim(m.realm))))
  `;
  return rows.flatMap(row => {
    if (!row.payloadName || !row.payloadRealm
      || playerIdentityKey(row.characterName, row.realm) !== playerIdentityKey(row.payloadName, row.payloadRealm)) return [];
    return [{ ...row,
      className: normalizePlayerClass(row.className),
      observedAt: row.classObservedAt ?? row.observedAt,
    }];
  });
}

export async function getStoredPlayerIdentity(name: string, realm: string, logClass: unknown) {
  return resolvePlayerIdentity({ name, realmName: realm, class: logClass }, await getStoredPlayerIdentityObservations(name, realm));
}

export async function getPlayersPageData(query: string, classFilter: string | undefined, requestedPage: number, includeShortPulls: boolean) {
  const [storedPlayers, observations] = await Promise.all([
    db.player.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, class: true, realm: { select: { name: true } } },
    }),
    getStoredPlayerIdentityObservations(),
  ]);
  const observationsByIdentity = new Map<string, PlayerIdentityObservation[]>();
  for (const observation of observations) {
    const key = playerIdentityKey(observation.characterName, observation.realm);
    const values = observationsByIdentity.get(key) ?? [];
    values.push(observation);
    observationsByIdentity.set(key, values);
  }
  const allPlayers = storedPlayers.map(player => {
    const realmName = player.realm?.name || DEFAULT_PLAYER_REALM;
    const identity = resolvePlayerIdentity({ ...player, realmName }, observationsByIdentity.get(playerIdentityKey(player.name, realmName)) ?? []);
    return { id: player.id, name: player.name, class: identity.className, realm: { name: realmName },
      classSource: identity.classSource, raceName: identity.raceName, guildName: identity.guildName };
  });
  const canonicalFilter = normalizePlayerClass(classFilter);
  const filtered = allPlayers.filter(player => (!canonicalFilter || player.class === canonicalFilter) && directoryNameMatches(player.name, query));
  const totalCount = filtered.length;
  const pagination = getDirectoryPagination(totalCount, requestedPage, PLAYERS_PER_PAGE);
  const pagePlayers = filtered.slice(pagination.startIndex, pagination.startIndex + PLAYERS_PER_PAGE);
  const pullCounts = pagePlayers.length ? await db.player.findMany({
    where: { id: { in: pagePlayers.map(player => player.id) } },
    select: { id: true, _count: { select: { participants: { where: { encounter: countedAttemptWhere({ includeShortPulls }) } } } } },
  }) : [];
  const countsById = new Map(pullCounts.map(player => [player.id, player._count.participants]));
  return {
    players: pagePlayers.map(player => ({ ...player, _count: { participants: countsById.get(player.id) ?? 0 } })),
    allPlayersForStats: allPlayers.map(player => ({ class: player.class })),
    totalCount, pagination,
  };
}
