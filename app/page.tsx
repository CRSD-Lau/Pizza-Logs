import Link from "next/link";
import { db } from "@/lib/db";
import { UploadZoneWithRefresh } from "@/components/upload/UploadZoneWithRefresh";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { getWeekBounds } from "@/lib/utils";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { buildPageMetadata } from "@/lib/page-metadata";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";
import { countedAttemptWhere, shortPullWhere } from "@/lib/attempt-policy.server";

export const metadata = buildPageMetadata({
  title: "Pizza Logs — WotLK Raid Analytics",
  description: "Upload combat logs, analyze raid encounters, and track WotLK performance records.",
  path: "/",
  absoluteTitle: true,
});

export const dynamic = "force-dynamic";

async function getHomeStats(includeShortPulls: boolean) {
  const { start } = getWeekBounds();
  try {
    const [totalEncounters, totalKills, weekKills, shortPulls] = await Promise.all([
      db.encounter.count({ where: countedAttemptWhere({ includeShortPulls }) }),
      db.encounter.count({ where: { outcome: "KILL" } }),
      db.encounter.count({ where: { outcome: "KILL", startedAt: { gte: start } } }),
      db.encounter.count({ where: shortPullWhere() }),
    ]);

    return { databaseAvailable: true, totalEncounters, totalKills, weekKills, shortPulls };
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    return { databaseAvailable: false, totalEncounters: 0, totalKills: 0, weekKills: 0, shortPulls: 0 };
  }
}

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ includeShortPulls?: string | string[] }>;
}) {
  const includeShortPulls = parseIncludeShortPulls((await searchParams).includeShortPulls);
  const stats = await getHomeStats(includeShortPulls);

  return (
    <PageShell>
      <PageHeader
        title="Pizza Logs"
        className="text-center sm:block"
        description={
          <p className="mx-auto max-w-xl">
          WoW raid combat log analytics for PizzaWarriors. Upload a log, track your best kills,
          and claim all-time records across every WotLK boss.
          </p>
        }
      />

      <div className="grid grid-cols-2 items-stretch gap-y-2 rounded-sm bg-bg-panel/40 p-2 sm:grid-cols-6">
        <StatCard label="Boss Kills" value={stats.totalKills.toLocaleString()} highlight className="col-span-2 sm:col-span-2" />
        <StatCard label="Kills This Week" value={stats.weekKills.toLocaleString()} className="sm:col-span-1" />
        <StatCard label="Encounters" value={stats.totalEncounters.toLocaleString()} className="sm:col-span-1" />
        <StatCard label="Tracked Bosses" value="56" sub="WotLK content" className="col-span-2 sm:col-span-2" />
      </div>

      {stats.databaseAvailable && (
        <ShortPullNotice shortPulls={stats.shortPulls} includeShortPulls={includeShortPulls} basePath="/" />
      )}

      {!stats.databaseAvailable && (
        <DatabaseUnavailable description="Live stats, uploads, and leaderboard data need the Pizza Logs database. The header and navigation remain available while Postgres is offline." />
      )}

      <PageSection title="Upload Combat Log" description="Drag and drop your WoWCombatLog.txt">
        <UploadZoneWithRefresh />
      </PageSection>

      <PageSection
          title="All-Time Leaderboards"
          description="Top 10 DPS and HPS for every boss"
          action={
            <Link href="/leaderboards" className="inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-wide text-gold hover:text-gold-light">
              View all &rarr;
            </Link>
          }
        >
        <Link
          href="/leaderboards"
          className="group flex min-h-24 items-center justify-between gap-4 border-y border-gold-dim px-2 py-6 transition-colors hover:bg-bg-panel/45 sm:px-4"
        >
          <span>
            <span className="heading-cinzel block text-xl font-bold text-gold-light transition-colors group-hover:text-gold">Browse every record</span>
            <span className="mt-1 block text-sm text-text-secondary">Compare boss-specific damage and healing performances.</span>
          </span>
          <span className="text-2xl text-gold" aria-hidden="true">&rarr;</span>
        </Link>
      </PageSection>
    </PageShell>
  );
}
