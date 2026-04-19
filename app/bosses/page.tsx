import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDps, formatDuration } from "@/lib/utils";
import { RAIDS } from "@/lib/constants/bosses";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Boss Rankings" };
export const dynamic = "force-dynamic";

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
            take: 1,
            select: { dps: true, player: { select: { name: true } } },
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
      id:          b.id,
      name:        b.name,
      slug:        b.slug,
      raid:        b.raid,
      raidSlug:    b.raidSlug,
      killCount:   kills.length,
      wipeCount:   b.encounters.length - kills.length,
      totalPulls:  b.encounters.length,
      bestKill,
      fastestKill,
    };
  });
}

export default async function BossesPage() {
  const bosses = await getBossStats();
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
          All-time records across {activeBosses.length} bosses
        </p>
      </div>

      {byRaid.length === 0 ? (
        <EmptyState
          title="No encounters yet"
          description="Upload a combat log to start building your leaderboards."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      ) : (
        byRaid.map(raid => (
          <section key={raid.slug}>
            <SectionHeader title={raid.name} />
            <div className="space-y-0.5">
              {/* Table header */}
              <div className="grid gap-3 px-4 py-2 text-[11px] font-semibold text-text-dim uppercase tracking-widest"
                style={{ gridTemplateColumns: "2fr 60px 60px 60px 120px 100px" }}>
                <span>Boss</span>
                <span className="text-right">Kills</span>
                <span className="text-right">Wipes</span>
                <span className="text-right">Best</span>
                <span className="text-right">Top DPS</span>
                <span className="text-right">Fastest Kill</span>
              </div>
              {raid.bosses.map(b => (
                <Link
                  key={b.slug}
                  href={`/bosses/${b.slug}`}
                  className="grid gap-3 items-center px-4 py-3 bg-bg-card rounded border border-transparent hover:border-gold-dim transition-colors"
                  style={{ gridTemplateColumns: "2fr 60px 60px 60px 120px 100px" }}
                >
                  <span className="text-sm font-semibold text-text-primary group-hover:text-gold-light">
                    {b.name}
                  </span>
                  <span className="text-right font-bold text-success tabular-nums text-sm">
                    {b.killCount || "—"}
                  </span>
                  <span className="text-right text-text-dim tabular-nums text-sm">
                    {b.wipeCount || "—"}
                  </span>
                  <span className={cn(
                    "text-right text-xs font-semibold",
                    b.totalPulls > 0
                      ? b.killCount > 0 ? "text-success" : "text-danger"
                      : "text-text-dim"
                  )}>
                    {b.totalPulls > 0
                      ? b.killCount > 0 ? "Kill" : "Wipe"
                      : "—"}
                  </span>
                  <span className="text-right text-sm">
                    {b.bestKill ? (
                      <span className="tabular-nums text-text-primary font-medium">
                        {formatDps(b.bestKill.dps)}{" "}
                        <span className="text-text-dim text-xs">{b.bestKill.playerName}</span>
                      </span>
                    ) : "—"}
                  </span>
                  <span className="text-right text-sm tabular-nums text-text-secondary">
                    {b.fastestKill !== null ? formatDuration(b.fastestKill) : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
