import { db } from "@/lib/db";
import { calculateGearScore } from "@/lib/gearscore";
import { getWarmaneCharacterGear } from "@/lib/warmane-armory";
import { DEFAULT_PLAYER_REALM, isMatchingArmorySource, playerIdentityKey, resolvePlayerIdentity, type PlayerIdentityObservation } from "@/lib/player-identity";

const QUICK_LOOK_MAX_AGE_MS = 5 * 60 * 1000;
const RESPONSE_CACHE_SECONDS = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  const characterName = name.trim();
  const requestedRealm = new URL(request.url).searchParams.get("realm")?.trim() || DEFAULT_PLAYER_REALM;

  if (!/^[A-Za-z]{2,12}$/.test(characterName) || !/^[A-Za-z]{2,24}$/.test(requestedRealm)) {
    return Response.json({ error: "Invalid character name or realm." }, { status: 400 });
  }

  // Every source is scoped to the same realm, including requests which omit it.
  const [player, rosterMembers] = await Promise.all([
    db.player.findFirst({
      where: {
        name: { equals: characterName, mode: "insensitive" },
        OR: [
          { realm: { is: { name: { equals: requestedRealm, mode: "insensitive" } } } },
          ...(requestedRealm.toLowerCase() === DEFAULT_PLAYER_REALM.toLowerCase() ? [{ realmId: null }] : []),
        ],
      },
      orderBy: { id: "asc" },
      select: { name: true, class: true, realm: { select: { name: true } } },
    }),
    db.guildRosterMember.findMany({
      where: {
        normalizedCharacterName: { equals: characterName.toLowerCase(), mode: "insensitive" },
        realm: { equals: requestedRealm, mode: "insensitive" },
      },
      orderBy: [{ lastSyncedAt: "desc" }, { id: "asc" }],
      select: { characterName: true, realm: true, className: true, raceName: true, guildName: true, lastSyncedAt: true, armoryUrl: true },
    }),
  ]);

  if (!player && !rosterMembers.length) return Response.json({ error: "Player not found." }, { status: 404 });

  const canonicalName = player?.name ?? rosterMembers[0].characterName;
  const realm = player?.realm?.name ?? rosterMembers[0]?.realm ?? requestedRealm;
  const sourceUrl = `https://armory.warmane.com/character/${encodeURIComponent(canonicalName)}/${encodeURIComponent(realm)}/summary`;
  const upstream = await getWarmaneCharacterGear(canonicalName, realm, { maxAgeMs: QUICK_LOOK_MAX_AGE_MS });
  const result = upstream.ok && (playerIdentityKey(upstream.gear.characterName, upstream.gear.realm) !== playerIdentityKey(canonicalName, realm)
    || !isMatchingArmorySource(upstream.gear.sourceUrl, canonicalName, realm))
    ? { ok: false as const, sourceUrl, message: "Gear data is temporarily unavailable from Warmane Armory." }
    : upstream;
  const observations: PlayerIdentityObservation[] = rosterMembers.map(member => ({
    characterName: member.characterName, realm: member.realm, className: member.className,
    observedAt: member.lastSyncedAt, source: "roster", sourceUrl: member.armoryUrl,
    raceName: member.raceName, guildName: member.guildName,
  }));
  const armoryIdentity = result.ok ? result.gear : result.identity;
  if (armoryIdentity) observations.push({
    characterName: armoryIdentity.characterName, realm: armoryIdentity.realm, className: armoryIdentity.className,
    observedAt: armoryIdentity.classFetchedAt ?? (result.ok ? result.gear.fetchedAt : null),
    source: "armory", sourceUrl: result.ok ? result.gear.sourceUrl : result.sourceUrl,
    raceName: armoryIdentity.raceName, guildName: armoryIdentity.guildName,
  });
  const identity = resolvePlayerIdentity({ name: canonicalName, realmName: realm, class: player?.class }, observations);

  if (!result.ok) {
    return Response.json({
      ok: false, message: result.message, sourceUrl: result.sourceUrl, characterName: canonicalName, realm,
      className: identity.className, classSource: identity.classSource, raceName: identity.raceName, guildName: identity.guildName,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const gearScore = calculateGearScore(result.gear.items, identity.className ?? undefined);
  return Response.json({
    ok: true, gear: result.gear, stale: result.stale ?? false,
    className: identity.className, classSource: identity.classSource,
    raceName: identity.raceName, guildName: identity.guildName,
    gearScore: gearScore ? { score: gearScore.score, averageItemLevel: gearScore.averageItemLevel, quality: gearScore.quality.description } : null,
  }, {
    headers: { "Cache-Control": `public, max-age=${RESPONSE_CACHE_SECONDS}, s-maxage=${QUICK_LOOK_MAX_AGE_MS / 1000}, stale-while-revalidate=300` },
  });
}
