interface CombatTotals {
  totalDamage: number;
  totalHealing: number;
  totalAbsorbs: number;
}

interface RaidParticipant extends CombatTotals {
  player: { name: string; class?: string | null };
  damageTaken: number;
}

export interface RaidSummaryEncounter extends CombatTotals {
  outcome: string;
  durationMs?: number | null;
  durationSeconds?: number | null;
  totalDamageTaken: number;
  participants: readonly RaidParticipant[];
}

export interface RaidSummaryPlayer extends CombatTotals {
  name: string;
  playerClass: string | null;
  heal: number;
  damageTaken: number;
}

/** Zero milliseconds is the legacy database default, not a measured duration. */
function encounterDurationMs(encounter: RaidSummaryEncounter): number | null {
  const { durationMs, durationSeconds } = encounter;
  if (durationMs != null && durationMs !== 0) {
    return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null;
  }
  return durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds * 1000
    : null;
}

/** Roll up stored successful encounter windows, including their adds and mechanics. */
export function buildRaidKillSummary<T extends RaidSummaryEncounter>(encounters: readonly T[]) {
  const kills = encounters.filter(encounter => encounter.outcome === "KILL");
  const players = new Map<string, RaidSummaryPlayer>();
  let durationMs: number | null = 0;
  let totalDamage = 0;
  let totalHealing = 0;
  let totalAbsorbs = 0;
  let totalDamageTaken = 0;

  for (const encounter of kills) {
    const duration = encounterDurationMs(encounter);
    durationMs = durationMs === null || duration === null ? null : durationMs + duration;
    totalDamage += encounter.totalDamage;
    totalHealing += encounter.totalHealing;
    totalAbsorbs += encounter.totalAbsorbs;
    totalDamageTaken += encounter.totalDamageTaken;

    for (const participant of encounter.participants) {
      const { name } = participant.player;
      const player = players.get(name) ?? {
        name, playerClass: participant.player.class ?? null,
        totalDamage: 0, totalHealing: 0, totalAbsorbs: 0, heal: 0, damageTaken: 0,
      };
      player.playerClass ??= participant.player.class ?? null;
      player.totalDamage += participant.totalDamage;
      player.totalHealing += participant.totalHealing;
      player.totalAbsorbs += participant.totalAbsorbs;
      player.heal += participant.totalHealing + participant.totalAbsorbs;
      player.damageTaken += participant.damageTaken;
      players.set(name, player);
    }
  }

  return {
    encounters: kills,
    durationMs,
    totalDamage,
    totalHealing,
    totalAbsorbs,
    heal: totalHealing + totalAbsorbs,
    totalDamageTaken,
    players: Array.from(players.values()),
  };
}

/** All players in an aggregate use its same duration; unavailable evidence stays unavailable. */
export function raidMetricRate(amount: number, durationMs: number | null): number | null {
  return durationMs !== null && Number.isFinite(durationMs) && durationMs > 0
    ? amount / (durationMs / 1000)
    : null;
}
