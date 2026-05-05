import { sortByICCOrder } from "./constants/bosses";

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

export type PlayerPerBossParticipant = {
  dps: number;
  hps: number;
  encounter: {
    outcome: string;
    boss: {
      name: string;
      slug: string;
    };
  };
};

export type PlayerPerBossSummary = {
  bossName: string;
  bossSlug: string;
  kills: number;
  bestDps: number;
  bestHps: number;
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

export function buildPlayerPerBossSummary(
  participants: readonly PlayerPerBossParticipant[],
): PlayerPerBossSummary[] {
  const perBoss = participants.reduce<Record<string, PlayerPerBossSummary>>((acc, participant) => {
    const key = participant.encounter.boss.slug;

    if (!acc[key]) {
      acc[key] = {
        bossName: participant.encounter.boss.name,
        bossSlug: key,
        kills: 0,
        bestDps: 0,
        bestHps: 0,
      };
    }

    if (participant.encounter.outcome === "KILL") acc[key].kills++;
    if (participant.dps > acc[key].bestDps) acc[key].bestDps = participant.dps;
    if (participant.hps > acc[key].bestHps) acc[key].bestHps = participant.hps;

    return acc;
  }, {});

  return sortByICCOrder(Object.values(perBoss), boss => boss.bossName);
}

export function buildPlayerRecentEncounters<T extends PlayerPerBossParticipant>(
  participants: readonly T[],
  limit = 20,
): T[] {
  return sortByICCOrder(participants.slice(0, limit), participant => participant.encounter.boss.name);
}
