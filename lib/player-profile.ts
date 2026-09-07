import { sortByICCOrder } from "./constants/bosses";
import { getRecordedDurationSeconds } from "./utils";
import { getReportMetricView, getReportRoleLabel, type ReportMetricView, type ReportRoleEvidence } from "./report-metric-view";

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

export type PlayerPerBossParticipant = ReportRoleEvidence & {
  dps: number;
  hps: number;
  aps?: number;
  totalDamage?: number;
  totalHealing?: number;
  totalAbsorbs?: number;
  damageTaken?: number;
  deaths?: number;
  encounter: {
    outcome: string;
    durationMs?: number;
    durationSeconds?: number;
    boss: {
      name: string;
      slug: string;
    };
  };
};

export type PlayerPerformanceSummary = {
  bestDps: number | null;
  avgDps: number | null;
  bestHps: number | null;
  avgHps: number | null;
  bestAps: number | null;
  bestHealingAbsorbsPerSecond: number | null;
  totalDamage: number | null;
  totalHealing: number | null;
  totalAbsorbs: number | null;
  totalHealingAbsorbs: number | null;
  damageTaken: number | null;
  damageTakenPerSecond: number | null;
  deaths: number | null;
  metricView: ReportMetricView;
  roles: string[];
  specs: string[];
};

export type PlayerPerBossSummary = PlayerPerformanceSummary & {
  bossName: string;
  bossSlug: string;
  kills: number;
};

function completeSum(values: readonly (number | null | undefined)[]): number | null {
  if (!values.length || values.some(value => value == null || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + value!, 0);
}

function recordedBest(values: readonly (number | undefined)[]): number | null {
  const recorded = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  return recorded.length ? Math.max(...recorded) : null;
}

/** Retains the caller's encounter window, stored rates and equal-weight kill averages. */
export function buildPlayerPerformanceSummary(participants: readonly PlayerPerBossParticipant[]): PlayerPerformanceSummary {
  const kills = participants.filter(participant => participant.encounter.outcome === "KILL");
  const totalHealing = completeSum(participants.map(participant => participant.totalHealing));
  const totalAbsorbs = completeSum(participants.map(participant => participant.totalAbsorbs));
  const damageTaken = completeSum(participants.map(participant => participant.damageTaken));
  const seconds = completeSum(participants.map(participant => getRecordedDurationSeconds(participant.encounter)));
  return {
    bestDps: recordedBest(participants.map(participant => participant.dps)),
    avgDps: kills.length ? kills.reduce((sum, participant) => sum + participant.dps, 0) / kills.length : null,
    bestHps: recordedBest(participants.map(participant => participant.hps)),
    avgHps: kills.length ? kills.reduce((sum, participant) => sum + participant.hps, 0) / kills.length : null,
    bestAps: recordedBest(participants.map(participant => participant.aps)),
    // Compare actual combined encounter rates, never the sum of unrelated bests.
    bestHealingAbsorbsPerSecond: recordedBest(participants.map(participant => participant.aps == null ? undefined : participant.hps + participant.aps)),
    totalDamage: completeSum(participants.map(participant => participant.totalDamage)),
    totalHealing,
    totalAbsorbs,
    totalHealingAbsorbs: totalHealing === null || totalAbsorbs === null ? null : totalHealing + totalAbsorbs,
    damageTaken,
    damageTakenPerSecond: damageTaken !== null && seconds !== null && seconds > 0 ? damageTaken / seconds : null,
    deaths: completeSum(participants.map(participant => participant.deaths)),
    metricView: getReportMetricView(participants),
    roles: [...new Set(participants.map(getReportRoleLabel))],
    specs: [...new Set(participants.map(participant => participant.spec?.trim()).filter((spec): spec is string => !!spec))],
  };
}

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
  const perBoss = participants.reduce<Record<string, PlayerPerBossParticipant[]>>((acc, participant) => {
    const key = participant.encounter.boss.slug;

    (acc[key] ??= []).push(participant);

    return acc;
  }, {});

  return sortByICCOrder(Object.values(perBoss).map(rows => ({
    ...buildPlayerPerformanceSummary(rows),
    bossName: rows[0].encounter.boss.name,
    bossSlug: rows[0].encounter.boss.slug,
    kills: rows.filter(participant => participant.encounter.outcome === "KILL").length,
  })), boss => boss.bossName);
}

export function buildPlayerRecentEncounters<T extends PlayerPerBossParticipant & { encounter: { startedAt: Date | string } }>(
  participants: readonly T[],
  limit = 50,
): T[] {
  return [...participants]
    .sort((left, right) => new Date(right.encounter.startedAt).getTime() - new Date(left.encounter.startedAt).getTime())
    .slice(0, limit);
}
