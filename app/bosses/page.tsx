import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDps, formatDuration } from "@/lib/utils";
import { RAIDS } from "@/lib/constants/bosses";
import { cn } from "@/lib/utils";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";

export const metadata: Metadata = { title: "Boss Rankings" };
export const dynamic = "force-dynamic";

const BOSS_GRID_COLUMNS = "2fr 60px 60px 60px 120px 100px";
const EMPTY_VALUE = "\u2014";

async function getBossStats() {
  const bosses = await db.boss.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      encounters: {
        select: {
          id:              true,
          outcome:         true,
          difficulty:      true,
          durationSeconds: true,
          participants: {
            orderBy: { dps: "desc" },
            take:    1,
            select:  { dps: true, player: { select: { name: true } } },
          },
        },
      },
    },
  });

  return bosses.map(b => {
    const kills = b.encounters.filter(e => e.outcome === "KILL");
    const bestKill = kills.reduce<{ dps: number; playerName: string } | null>((best, enc) => {
      const top = enc.participants[0];
      if (!top) return best;
      if (!best || top.dps > best.dps) return { dps: top.dps, playerName: top.player.name };
      return best;
    }, null);
    const fastestKill = kills.reduce<number | null>(
      (m, e) => m === null ? e.durationSeconds : Math.min(m, e.durationSeconds),
      null
    );
    return {
      id:         b.id,
      name:       b.name,
      slug:       b.slug,
      raid:       b.raid,
      raidSlug:   b.raidSlug,
      killCount:  kills.length,
      wipeCount:  b.encounters.length - kills.length,
      totalPulls: b.encounters.length,
      bestKill,
      fastestKill,
    };
  });
}

export default async function BossesPage() {
  let databaseAvailable = true;
  let bosses: Awaited<ReturnType<typeof getBossStats>> = [];

  try {
    bosses = await getBossStats();
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }
  const byRaid = RAIDS.map(r => ({
    ...r,
    bosses: bosses.filter(b => b.raidSlug === r.slug),
  })).filter(r => r.bosses.length > 0);

  const activeBosses = bosses.filter(b => b.totalPulls > 0);

  return (
    <div className="pt-10 space-y-10">
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">Boss Rankings</h1>
        <p className="text-text-secondary text-sm mt-1">
          {databaseAvailable
            ? `All-time records across ${activeBosses.length} bosses`
            : "Boss rankings are unavailable while the database is offline"}
        </p>
      </div>

      {!databaseAvailable && (
        <DatabaseUnavailable description="Boss rankings need the Pizza Logs database. Start local Postgres to load encounters and records." />
      )}

      {databaseAvailable && (byRaid.length === 0 ? (
        <EmptyState
          title="No encounters yet"
          description="Upload a combat log to start building your leaderboards."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
        />
      ) : (
        byRaid.map(raid => (
          <section key={raid.slug}>
            <SectionHeader title={raid.name} />
            <div className="space-y-2 md:space-y-0.5">
              <div
                className="hidden md:grid gap-3 px-4 py-2 text-[11px] font-semibold text-text-dim uppercase tracking-widest"
                style={{ gridTemplateColumns: BOSS_GRID_COLUMNS }}
              >
                <span>Boss</span>
                <span className="text-right">Kills</span>
                <span className="text-right">Wipes</span>
                <span className="text-right">Best</span>
                <span className="text-right">Top DPS</span>
                <span className="text-right">Fastest Kill</span>
              </div>
              {raid.bosses.map((b, index) => {
                const statusLabel = b.totalPulls > 0
                  ? b.killCount > 0 ? "Kill" : "Wipe"
                  : EMPTY_VALUE;
                const statusClassName = cn(
                  "text-xs font-semibold",
                  b.totalPulls > 0
                    ? b.killCount > 0 ? "text-success" : "text-danger"
                    : "text-text-dim"
                );
                const topDps = b.bestKill
                  ? `${formatDps(b.bestKill.dps)} ${b.bestKill.playerName}`
                  : EMPTY_VALUE;

                return (
                  <Link
                    key={b.slug}
                    href={`/bosses/${b.slug}`}
                    aria-label={`${b.name} boss summary`}
                    className={getRevealClassName({
                      boss: true,
                      className:
                        "group block overflow-hidden bg-bg-card rounded border border-transparent px-4 py-4 hover:border-gold-dim transition-colors md:grid md:gap-3 md:items-center md:py-3",
                    })}
                    style={getRevealStyle(index, { gridTemplateColumns: BOSS_GRID_COLUMNS })}
                  >
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 text-sm font-semibold text-text-primary group-hover:text-gold-light transition-colors">
                          {b.name}
                        </span>
                        <span className={statusClassName}>{statusLabel}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <BossMobileMetric label="Kills" value={b.killCount || EMPTY_VALUE} valueClassName="text-success" />
                        <BossMobileMetric label="Wipes" value={b.wipeCount || EMPTY_VALUE} valueClassName="text-danger" />
                        <BossMobileMetric
                          label="Fastest"
                          value={b.fastestKill !== null ? formatDuration(b.fastestKill) : EMPTY_VALUE}
                          valueClassName="text-text-secondary"
                        />
                      </div>

                      <div className="rounded border border-gold-dim/70 bg-bg-panel/70 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
                          Top DPS
                        </div>
                        <div className="mt-0.5 truncate text-sm text-text-primary tabular-nums">
                          {topDps}
                        </div>
                      </div>
                    </div>

                    <span className="hidden md:block text-sm font-semibold text-text-primary group-hover:text-gold-light transition-colors">
                      {b.name}
                    </span>
                    <span className="hidden md:block text-right font-bold text-success tabular-nums text-sm">
                      {b.killCount || EMPTY_VALUE}
                    </span>
                    <span className="hidden md:block text-right text-text-dim tabular-nums text-sm">
                      {b.wipeCount || EMPTY_VALUE}
                    </span>
                    <span className={cn("hidden md:block text-right", statusClassName)}>
                      {statusLabel}
                    </span>
                    <span className="hidden md:block text-right text-sm">
                      {b.bestKill ? (
                        <span className="tabular-nums text-text-primary font-medium">
                          {formatDps(b.bestKill.dps)}{" "}
                          <span className="text-text-dim text-xs">{b.bestKill.playerName}</span>
                        </span>
                      ) : EMPTY_VALUE}
                    </span>
                    <span className="hidden md:block text-right text-sm tabular-nums text-text-secondary">
                      {b.fastestKill !== null ? formatDuration(b.fastestKill) : EMPTY_VALUE}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      ))}
    </div>
  );
}

function BossMobileMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName: string;
}) {
  return (
    <div className="min-w-0 rounded border border-gold-dim bg-bg-panel px-2 py-2 text-center">
      <div className={cn("truncate text-sm font-bold tabular-nums", valueClassName)}>{value}</div>
      <div className="text-[10px] text-text-dim uppercase tracking-wide">{label}</div>
    </div>
  );
}
