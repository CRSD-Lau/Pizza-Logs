import { gearNeedsWowheadEnrichment } from "./warmane-armory";

export type ArmoryGearQueuePlayer = {
  name: string;
  realm?: { name: string | null } | null;
};

export type ArmoryGearQueueRosterMember = {
  characterName: string;
  normalizedCharacterName: string;
  realm: string;
};

export type ArmoryGearQueueCachedRow = {
  characterKey: string;
  realm: string;
  gear: unknown;
};

export type ArmoryGearQueueEntry = {
  characterName: string;
  realm: string;
};

function queueKey(characterName: string, realm: string): string {
  return `${characterName.trim().toLowerCase()}:${realm}`;
}

export function getMissingArmoryGearPlayers({
  players,
  rosterMembers,
  cachedRows,
}: {
  players: ArmoryGearQueuePlayer[];
  rosterMembers: ArmoryGearQueueRosterMember[];
  cachedRows: ArmoryGearQueueCachedRow[];
}): ArmoryGearQueueEntry[] {
  const entries = new Map<string, ArmoryGearQueueEntry>();

  for (const player of players) {
    const realm = player.realm?.name ?? "Lordaeron";
    entries.set(queueKey(player.name, realm), {
      characterName: player.name,
      realm,
    });
  }

  for (const member of rosterMembers) {
    entries.set(queueKey(member.characterName, member.realm), {
      characterName: member.characterName,
      realm: member.realm,
    });
  }

  const freshCachedKeys = new Set(
    cachedRows
      .filter((row) => !gearNeedsWowheadEnrichment(row.gear))
      .map((row) => queueKey(row.characterKey, row.realm))
  );

  return Array.from(entries.values())
    .filter((entry) => !freshCachedKeys.has(queueKey(entry.characterName, entry.realm)))
    .sort((left, right) => left.characterName.localeCompare(right.characterName));
}
