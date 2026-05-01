export type PlayerProfilePlayer = {
  name: string;
  class: string | null;
  realm: { name: string | null } | null;
  milestones: unknown[];
};

export type PlayerProfileRosterMember = {
  characterName: string;
  realm: string;
  guildName: string;
  className: string | null;
  raceName: string | null;
  level: number | null;
  rankName: string | null;
};

export type PlayerProfile = {
  name: string;
  realmName: string;
  guildName: string | null;
  className: string | null;
  raceName: string | null;
  level: number | null;
  rankName: string | null;
  isRosterOnly: boolean;
  milestones: unknown[];
};

export function resolvePlayerProfile({
  player,
  rosterMember,
}: {
  player: PlayerProfilePlayer | null;
  rosterMember: PlayerProfileRosterMember | null;
}): PlayerProfile | null {
  if (!player && !rosterMember) return null;

  return {
    name: player?.name ?? rosterMember?.characterName ?? "",
    realmName: player?.realm?.name ?? rosterMember?.realm ?? "Lordaeron",
    guildName: rosterMember?.guildName ?? null,
    className: player?.class ?? rosterMember?.className ?? null,
    raceName: rosterMember?.raceName ?? null,
    level: rosterMember?.level ?? null,
    rankName: rosterMember?.rankName ?? null,
    isRosterOnly: !player,
    milestones: player?.milestones ?? [],
  };
}
