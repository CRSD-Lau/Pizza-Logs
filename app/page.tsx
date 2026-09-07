import Link from "next/link";
import { db } from "@/lib/db";
import { UploadZoneWithRefresh } from "@/components/upload/UploadZoneWithRefresh";
import { FrozenLogbookIntro } from "@/components/intro/FrozenLogbookIntro";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { getWeekBounds } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { buildPageMetadata } from "@/lib/page-metadata";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";
import { countedAttemptWhere } from "@/lib/attempt-policy.server";
import { GuildCrest } from "@/components/brand/GuildCrest";

export const metadata = buildPageMetadata({
  title: "Pizza Logs | WotLK Raid Analytics",
  description: "Upload a Warmane combat log to review boss fights, damage and healing.",
  path: "/",
  absoluteTitle: true,
});

export const dynamic = "force-dynamic";

async function getHomeStats(includeShortPulls: boolean) {
  const { start } = getWeekBounds();
  try {
    const [totalEncounters, totalKills, weekKills] = await Promise.all([
      db.encounter.count({ where: countedAttemptWhere({ includeShortPulls }) }),
      db.encounter.count({ where: { outcome: "KILL" } }),
      db.encounter.count({ where: { outcome: "KILL", startedAt: { gte: start } } }),
    ]);

    return { databaseAvailable: true, totalEncounters, totalKills, weekKills };
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    return { databaseAvailable: false, totalEncounters: 0, totalKills: 0, weekKills: 0 };
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
        eyebrow="Pizza Warriors · Warmane"
        title="Upload a raid log"
        description={
          <p>See boss kills, damage and healing from your Warmane combat log.</p>
        }
        actions={
          <div className="flex items-center gap-5">
            <Link href="/raids" className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-gold hover:text-gold-light">Browse raids &rarr;</Link>
            <GuildCrest size={96} className="hidden sm:block" />
          </div>
        }
      />

      {!stats.databaseAvailable && (
        <DatabaseUnavailable description="Uploads and raid data are temporarily unavailable. Please try again shortly." />
      )}

      <section aria-label="Upload combat log">
        <UploadZoneWithRefresh />
      </section>

      <PageSection title="Raid activity" action={<FrozenLogbookIntro />}>
        <StatGroup columns={3}>
          <StatCard label="Boss Kills" value={<NumericValue value={stats.databaseAvailable ? stats.totalKills : null} />} highlight />
          <StatCard label="Kills This Week" value={<NumericValue value={stats.databaseAvailable ? stats.weekKills : null} />} />
          <StatCard label="Encounters" value={<NumericValue value={stats.databaseAvailable ? stats.totalEncounters : null} />} />
        </StatGroup>
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
            <span className="heading-cinzel block text-xl font-bold text-gold-light transition-colors group-hover:text-gold">Compare boss records</span>
            <span className="mt-1 block text-sm text-text-secondary">See each boss&apos;s top damage and healing records.</span>
          </span>
          <span className="text-2xl text-gold" aria-hidden="true">&rarr;</span>
        </Link>
      </PageSection>
    </PageShell>
  );
}
