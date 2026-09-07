import { db } from "@/lib/db";
import { ARMORY_SECTIONS, isArmoryCategory, type ArmorySection } from "@/lib/armory-profile";
import { getArmoryProfileSection, getArmorySpell } from "@/lib/armory-profile.server";
import { DEFAULT_PLAYER_REALM } from "@/lib/player-identity";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await params;
  const query = new URL(request.url).searchParams;
  const realm = query.get("realm")?.trim() || DEFAULT_PLAYER_REALM;
  const section = query.get("section") ?? "summary";
  const category = query.get("category") ?? "summary";
  const spell = query.get("spell");
  if (!/^[A-Za-z]{2,12}$/.test(name) || !/^[A-Za-z]{2,24}$/.test(realm) || !ARMORY_SECTIONS.includes(section as ArmorySection)
    || !isArmoryCategory(section as ArmorySection, category) || (spell !== null && (!/^[0-9]{1,7}$/.test(spell) || section !== "talents"))) {
    return Response.json({ error: "Invalid Armory request." }, { status: 400 });
  }
  const [player, member] = await Promise.all([
    db.player.findFirst({ where: { name: { equals: name, mode: "insensitive" }, OR: [
      { realm: { is: { name: { equals: realm, mode: "insensitive" } } } },
      ...(realm.toLowerCase() === DEFAULT_PLAYER_REALM.toLowerCase() ? [{ realmId: null }] : []),
    ] }, select: { name: true } }),
    db.guildRosterMember.findFirst({ where: { normalizedCharacterName: { equals: name.toLowerCase(), mode: "insensitive" },
      realm: { equals: realm, mode: "insensitive" } }, select: { characterName: true } }),
  ]);
  if (!player && !member) return Response.json({ error: "Player not found." }, { status: 404 });
  const result = await getArmoryProfileSection(player?.name ?? member!.characterName, realm, section as ArmorySection, category);
  if (spell !== null) {
    if (!result.data?.specs.some(spec => spec.trees.some(tree => tree.nodes.some(node => node.spellId === Number(spell)))))
      return Response.json({ error: "Talent not found in this character's builds." }, { status: 404 });
    return Response.json({ spell: await getArmorySpell(Number(spell)) }, { headers: { "Cache-Control": "private, no-store" } });
  }
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
