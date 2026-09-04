import { db } from "@/lib/db";
import { calculateGearScore } from "@/lib/gearscore";
import { getWarmaneCharacterGear } from "@/lib/warmane-armory";

const QUICK_LOOK_MAX_AGE_MS = 5 * 60 * 1000;
const RESPONSE_CACHE_SECONDS = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  const characterName = name.trim();
  const requestedRealm = new URL(request.url).searchParams.get("realm")?.trim() || null;

  if (!/^[A-Za-z]{2,12}$/.test(characterName) || (requestedRealm && !/^[A-Za-z]{2,24}$/.test(requestedRealm))) {
    return Response.json({ error: "Invalid character name or realm." }, { status: 400 });
  }

  const [player, rosterMember] = await Promise.all([
    db.player.findFirst({
      where: {
        name: characterName,
        ...(requestedRealm ? { realm: { is: { name: requestedRealm } } } : {}),
      },
      select: {
        name: true,
        class: true,
        realm: { select: { name: true } },
      },
    }),
    db.guildRosterMember.findFirst({
      where: {
        normalizedCharacterName: characterName.toLowerCase(),
        ...(requestedRealm ? { realm: requestedRealm } : {}),
      },
      select: {
        characterName: true,
        realm: true,
        className: true,
        raceName: true,
        guildName: true,
      },
    }),
  ]);

  if (!player && !rosterMember) {
    return Response.json({ error: "Player not found." }, { status: 404 });
  }

  const canonicalName = player?.name ?? rosterMember?.characterName ?? characterName;
  const realm = player?.realm?.name ?? rosterMember?.realm ?? "Lordaeron";
  const result = await getWarmaneCharacterGear(canonicalName, realm, {
    maxAgeMs: QUICK_LOOK_MAX_AGE_MS,
  });

  if (!result.ok) {
    return Response.json({
      ok: false,
      message: result.message,
      sourceUrl: result.sourceUrl,
      characterName: canonicalName,
      realm,
      className: player?.class ?? rosterMember?.className ?? null,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const className = result.gear.className ?? player?.class ?? rosterMember?.className ?? null;
  const gearScore = calculateGearScore(result.gear.items, className ?? undefined);

  return Response.json({
    ok: true,
    gear: result.gear,
    stale: result.stale ?? false,
    className,
    raceName: result.gear.raceName ?? rosterMember?.raceName ?? null,
    guildName: result.gear.guildName ?? rosterMember?.guildName ?? null,
    gearScore: gearScore
      ? {
        score: gearScore.score,
        averageItemLevel: gearScore.averageItemLevel,
        quality: gearScore.quality.description,
      }
      : null,
  }, {
    headers: {
      "Cache-Control": `public, max-age=${RESPONSE_CACHE_SECONDS}, s-maxage=${QUICK_LOOK_MAX_AGE_MS / 1000}, stale-while-revalidate=300`,
    },
  });
}
