import Link from "next/link";
import { db } from "@/lib/db";
import { UploadZoneWithRefresh } from "@/components/upload/UploadZoneWithRefresh";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { getWeekBounds } from "@/lib/utils";
import { isDatabaseConnectionError } from "@/lib/database-errors";

export const dynamic = "force-dynamic";

async function getHomeStats() {
  const { start } = getWeekBounds();
  try {
    const [totalEncounters, totalKills, weekKills] = await Promise.all([
      db.encounter.count(),
      db.encounter.count({ where: { outcome: "KILL" } }),
      db.encounter.count({ where: { outcome: "KILL", startedAt: { gte: start } } }),
    ]);

    return { databaseAvailable: true, totalEncounters, totalKills, weekKills };
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    return { databaseAvailable: false, totalEncounters: 0, totalKills: 0, weekKills: 0 };
  }
}

export default async function HomePage() {
  const stats = await getHomeStats();

  return (
    <div className="pt-10 space-y-12">
      <div className="text-center space-y-3">
        <h1 className="heading-cinzel text-3xl sm:text-4xl font-bold text-gold-light text-glow-gold">
          Pizza Logs
        </h1>
        <p className="text-text-secondary text-base max-w-xl mx-auto">
          WoW raid combat log analytics for PizzaWarriors. Upload a log, track your best kills,
          and claim all-time records across every WotLK boss.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Encounters" value={stats.totalEncounters.toLocaleString()} />
        <StatCard label="Boss Kills" value={stats.totalKills.toLocaleString()} highlight />
        <StatCard label="Kills This Week" value={stats.weekKills.toLocaleString()} />
        <StatCard label="Active Bosses" value="56" sub="WotLK content" />
      </div>

      {!stats.databaseAvailable && (
        <DatabaseUnavailable description="Live stats, uploads, and leaderboard data need the Pizza Logs database. The header and navigation remain available while Postgres is offline." />
      )}

      <section>
        <SectionHeader title="Upload Combat Log" sub="Drag and drop your WoWCombatLog.txt" />
        <UploadZoneWithRefresh />
      </section>

      <section>
        <SectionHeader
          title="All-Time Leaderboards"
          sub="Top 10 DPS and HPS for every boss"
          action={
            <Link href="/leaderboards" className="text-xs text-gold hover:text-gold-light uppercase tracking-wide">
              View all &rarr;
            </Link>
          }
        />
        <Link
          href="/leaderboards"
          className="block bg-bg-panel border border-gold-dim rounded-sm px-6 py-10 text-center hover:border-gold/50 transition-colors group"
        >
          <p className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold group-hover:text-gold transition-colors">
            Leaderboards
          </p>
          <p className="text-text-secondary text-sm mt-2">
            All-time top 10 DPS and HPS for every WotLK boss
          </p>
        </Link>
      </section>
    </div>
  );
}
