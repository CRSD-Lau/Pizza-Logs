import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { LeaderboardBar } from "@/components/charts/LeaderboardBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWeekBounds, formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "This Week" };
export const dynamic = "force-dynamic";

async function getWeeklyData() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/weekly`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function WeeklyPage() {
  const data = await getWeeklyData();
  const { start, end } = getWeekBounds();

  const weekLabel = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="pt-10 space-y-10">
      <div>
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">Weekly Summary</h1>
        <p className="text-text-secondary text-sm mt-1">{weekLabel}</p>
      </div>

      {data ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Boss Kills"   value={data.totalKills}   highlight />
            <StatCard label="Wipes"        value={data.totalWipes} />
            <StatCard label="Uploads"      value={data.totalUploads} />
            <StatCard label="Kill Rate"
              value={data.totalKills + data.totalWipes > 0
                ? `${Math.round(data.totalKills / (data.totalKills + data.totalWipes) * 100)}%`
                : "—"}
            />
          </div>

          {/* Top DPS */}
          <section>
            <SectionHeader title="Top DPS This Week" sub="Best single-encounter DPS, kills only" />
            {data.topDps.length > 0 ? (
              <LeaderboardBar entries={data.topDps.map((e: typeof data.topDps[0], i: number) => ({
                rank:        i + 1,
                playerName:  e.playerName,
                class:       e.class,
                value:       e.dps,
                bossName:    e.bossName,
                bossSlug:    e.bossSlug,
                difficulty:  e.difficulty,
                encounterId: "",
                date:        data.weekStart,
              }))} metric="dps" />
            ) : (
              <EmptyState title="No kills recorded this week" description="Upload a combat log to start tracking." />
            )}
          </section>

          {/* Top HPS */}
          <section>
            <SectionHeader title="Top HPS This Week" sub="Best single-encounter HPS, kills only" />
            {data.topHps.length > 0 ? (
              <LeaderboardBar entries={data.topHps.map((e: typeof data.topHps[0], i: number) => ({
                rank:        i + 1,
                playerName:  e.playerName,
                class:       e.class,
                value:       e.hps,
                bossName:    e.bossName,
                bossSlug:    e.bossSlug,
                difficulty:  e.difficulty,
                encounterId: "",
                date:        data.weekStart,
              }))} metric="hps" />
            ) : (
              <EmptyState title="No healing data this week" />
            )}
          </section>

          {/* Boss kills */}
          {data.bossKills.length > 0 && (
            <section>
              <SectionHeader title="Boss Kills This Week" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.bossKills.map((b: { name: string; slug: string; raid: string; kills: number }) => (
                  <Link
                    key={b.slug}
                    href={`/bosses/${b.slug}`}
                    className="flex items-center justify-between bg-bg-card border border-gold-dim rounded px-4 py-3 hover:border-gold/40 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{b.name}</p>
                      <p className="text-xs text-text-dim">{b.raid}</p>
                    </div>
                    <span className="text-xl font-bold text-gold tabular-nums">{b.kills}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyState
          title="No data yet"
          description="Upload a combat log to see your weekly summary."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      )}
    </div>
  );
}
