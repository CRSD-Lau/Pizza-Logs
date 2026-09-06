import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerDirectory, PlayerDirectoryClassIcon } from "@/components/players/PlayerDirectory";
import { PlayerDirectoryFilters, playerDirectoryActionClass } from "@/components/players/PlayerDirectoryFilters";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { getPlayerClassMeta } from "@/lib/player-class";
import { getPlayersPageData } from "@/lib/player-directory";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { buildPageMetadata } from "@/lib/page-metadata";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";
import { buildDirectoryHref, parseDirectoryFilters, parseDirectoryPage, type DirectoryQueryValue } from "@/lib/directory-pagination";
import { formatCountLabel, formatInteger } from "@/lib/utils";

export const metadata = buildPageMetadata({
  title: "Players",
  description: "Find players by name or class. View their raid history, records and Warmane gear.",
  path: "/players",
});
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: DirectoryQueryValue; class?: DirectoryQueryValue; page?: DirectoryQueryValue; includeShortPulls?: DirectoryQueryValue }>;
}

export default async function PlayersPage({ searchParams }: Props) {
  const params = await searchParams;
  const { query, classFilter } = parseDirectoryFilters(params);
  const includeShortPulls = parseIncludeShortPulls(params.includeShortPulls);
  let data: Awaited<ReturnType<typeof getPlayersPageData>> | null = null;
  try {
    data = await getPlayersPageData(query, classFilter, parseDirectoryPage(params.page), includeShortPulls);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
  }
  const pageHref = (page: number) => buildDirectoryHref("/players", { query, classFilter, page, includeShortPulls });
  const resetHref = buildDirectoryHref("/players", { includeShortPulls });
  const classCounts = new Map<string, number>();
  for (const player of data?.allPlayersForStats ?? []) {
    const className = getPlayerClassMeta(player.class).className ?? "Unknown";
    classCounts.set(className, (classCounts.get(className) ?? 0) + 1);
  }
  const classStats = [...classCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxClassCount = classStats[0]?.[1] ?? 1;

  return (
    <PageShell>
      <PageHeader
        title="Players"
        eyebrow="The raid directory"
        description={<p>Find a player, explore their raid history, and open a class icon for Warmane gear.</p>}
      />
      {!data ? (
        <DatabaseUnavailable description="Player profiles are temporarily unavailable. Please try again shortly." />
      ) : (
        <>
          <PlayerDirectoryFilters query={query} classFilter={classFilter} includeShortPulls={includeShortPulls} />
          <section aria-labelledby="player-directory-results" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="player-directory-results" className="text-base font-semibold text-text-primary">
                  {formatCountLabel(data.totalCount, "player")}{query || classFilter ? (data.totalCount === 1 ? " matches these filters" : " match these filters") : " tracked"}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">Armory class when available; combat-log class otherwise.</p>
              </div>
              <p className="text-sm text-text-secondary">A–Z</p>
            </div>
            <ShortPullNotice shortPulls={data.shortPulls} includeShortPulls={includeShortPulls} basePath={pageHref(data.pagination.currentPage)} />
            {data.players.length === 0 ? (
              <EmptyState
                title="No players found"
                description={query || classFilter ? "Try another name or class, or clear the filters." : "Player profiles appear after a combat log is uploaded."}
                action={<Link href={query || classFilter ? resetHref : "/"} className={playerDirectoryActionClass}>{query || classFilter ? "Clear filters" : "Upload a log"}</Link>}
              />
            ) : (
              <>
                <PlayerDirectory players={data.players} includeShortPulls={includeShortPulls} />
                <nav aria-label="Player directory pages" className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-sm text-text-secondary">{formatInteger(data.pagination.firstVisible)}–{formatInteger(data.pagination.lastVisible)} of {formatCountLabel(data.totalCount, "player")} · Page {formatInteger(data.pagination.currentPage)} of {formatInteger(data.pagination.totalPages)}</p>
                  <div className="flex gap-2">
                    {data.pagination.currentPage > 1 ? <Link href={pageHref(data.pagination.currentPage - 1)} className={playerDirectoryActionClass}><ChevronLeft aria-hidden="true" size={16} />Previous</Link> : <button type="button" disabled className={`${playerDirectoryActionClass} opacity-40`}><ChevronLeft aria-hidden="true" size={16} />Previous</button>}
                    {data.pagination.currentPage < data.pagination.totalPages ? <Link href={pageHref(data.pagination.currentPage + 1)} className={playerDirectoryActionClass}>Next<ChevronRight aria-hidden="true" size={16} /></Link> : <button type="button" disabled className={`${playerDirectoryActionClass} opacity-40`}>Next<ChevronRight aria-hidden="true" size={16} /></button>}
                  </div>
                </nav>
              </>
            )}
          </section>
          {classStats.length > 0 && (
            <details className="group border-y border-gold-dim">
              <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
                <h2 className="text-sm font-semibold text-gold">Class overview</h2>
                <span className="text-sm text-text-secondary">All {formatCountLabel(data.allPlayersForStats.length, "player")}</span>
                <ChevronDown size={16} className="ml-auto text-text-secondary transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-x-10 gap-y-3 pb-5 sm:grid-cols-2">
                {classStats.map(([className, count]) => {
                  const meta = getPlayerClassMeta(className);
                  return (
                    <div key={className} className="flex min-w-0 items-center gap-3 text-sm">
                      <PlayerDirectoryClassIcon characterClass={className} />
                      <span className="w-24 shrink-0 text-text-secondary">{meta.className ?? "Unknown class"}</span>
                      <div className="h-2 min-w-4 flex-1 overflow-hidden rounded-full bg-bg-card" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${count / maxClassCount * 100}%`, backgroundColor: meta.color }} />
                      </div>
                      <span className="min-w-8 text-right tabular-nums text-text-primary">{formatInteger(count)}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}
    </PageShell>
  );
}
