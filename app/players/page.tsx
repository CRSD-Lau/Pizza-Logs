import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { WOW_CLASSES, getClassColor } from "@/lib/constants/classes";
import { getClassIconUrl } from "@/lib/class-icons";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { buildPageMetadata } from "@/lib/page-metadata";
import { parseIncludeShortPulls } from "@/lib/attempt-policy";
import { countedAttemptWhere, shortPullWhere } from "@/lib/attempt-policy.server";
import { buildDirectoryHref, getDirectoryPagination, parseDirectoryFilters, parseDirectoryPage, type DirectoryQueryValue } from "@/lib/directory-pagination";
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

const PLAYERS_PER_PAGE = 30;
const fieldClass = "min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1 rounded-sm border border-gold-dim px-4 py-2 text-sm font-semibold text-text-secondary hover:border-gold hover:text-gold-light";

async function getPlayersPageData(query: string, classFilter: string | undefined, requestedPage: number, includeShortPulls: boolean) {
  const where = {
    ...(classFilter ? { class: classFilter } : {}),
    ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
  };
  const [allPlayersForStats, totalCount, shortPulls] = await Promise.all([
    db.player.findMany({ select: { class: true } }),
    db.player.count({ where }),
    db.encounter.count({ where: { AND: [shortPullWhere(), { participants: { some: { player: where } } }] } }),
  ]);
  const pagination = getDirectoryPagination(totalCount, requestedPage, PLAYERS_PER_PAGE);
  const players = await db.player.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: pagination.startIndex,
    take: PLAYERS_PER_PAGE,
    include: {
      realm: { select: { name: true } },
      _count: { select: { participants: { where: { encounter: countedAttemptWhere({ includeShortPulls }) } } } },
    },
  });
  return { players, allPlayersForStats, totalCount, shortPulls, pagination };
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
  const pageHref = (page: number, selectedClass = classFilter) => buildDirectoryHref("/players", { query, classFilter: selectedClass, page, includeShortPulls });
  const resetHref = buildDirectoryHref("/players", { includeShortPulls });
  const visiblePlayers = data?.players ?? [];
  const classCounts = new Map<string, number>();
  for (const player of data?.allPlayersForStats ?? []) {
    const className = player.class ?? "Unknown";
    classCounts.set(className, (classCounts.get(className) ?? 0) + 1);
  }
  const classStats = [...classCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxClassCount = classStats[0]?.[1] ?? 1;

  return (
    <PageShell>
      <PageHeader title="Players" description={<p>Find a player by name or class to view their raid history.</p>} />
      {!data ? (
        <DatabaseUnavailable description="Player profiles are temporarily unavailable. Please try again shortly." />
      ) : (
        <>
          <div className="space-y-3">
            <form key={`${query}:${classFilter ?? ""}`} action="/players" method="get" role="search" aria-label="Filter player directory" className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex">
              <div className="col-span-2 min-w-0 flex-1">
                <label htmlFor="directory-player-name" className="mb-1.5 block text-sm font-semibold text-text-secondary">Player name</label>
                <input id="directory-player-name" name="q" type="search" defaultValue={query} maxLength={64} placeholder="Find a player by name" className={fieldClass} />
              </div>
              <div className="sm:hidden">
                <label htmlFor="directory-player-class" className="mb-1.5 block text-sm font-semibold text-text-secondary">Class</label>
                <select id="directory-player-class" name="class" defaultValue={classFilter ?? ""} className={fieldClass}>
                  <option value="">All classes</option>
                  {WOW_CLASSES.map(className => <option key={className} value={className}>{className}</option>)}
                </select>
              </div>
              {includeShortPulls && <input type="hidden" name="includeShortPulls" value="1" />}
              <button type="submit" className={`${actionClass} border-gold text-gold-light`}>Find players</button>
              {(query || classFilter) && <Link href={resetHref} className={`${actionClass} col-span-2`}>Clear filters</Link>}
            </form>
            <nav aria-label="Filter players by class" className="hidden flex-wrap gap-1.5 sm:flex">
              <Link href={pageHref(1, "")} aria-current={!classFilter ? "page" : undefined} className={`${actionClass} ${!classFilter ? "border-gold text-gold-light" : ""}`}>All classes</Link>
              {WOW_CLASSES.map(className => (
                <Link key={className} href={pageHref(1, className)} aria-current={classFilter === className ? "page" : undefined} className={`${actionClass} ${classFilter === className ? "border-gold text-gold-light" : ""}`}>
                  {className}
                </Link>
              ))}
            </nav>
            <p className="text-sm text-text-secondary">
              {formatCountLabel(data.totalCount, "player")}{query || classFilter ? (data.totalCount === 1 ? " matches these filters" : " match these filters") : " tracked"} · A–Z
            </p>
          </div>
          <ShortPullNotice shortPulls={data.shortPulls} includeShortPulls={includeShortPulls} basePath={pageHref(data.pagination.currentPage)} />
          {visiblePlayers.length === 0 ? (
            <EmptyState title="No players found" description={query || classFilter ? "Try another name or class, or clear the filters." : "Player profiles appear after a combat log is uploaded."}
              action={<Link href={query || classFilter ? resetHref : "/"} className={actionClass}>{query || classFilter ? "Clear filters" : "Upload a log"}</Link>} />
          ) : (
            <div className="space-y-5">
              <ul aria-label="Players" className="grid list-none gap-x-6 border-t border-gold-dim sm:grid-cols-2 lg:grid-cols-3">
                {visiblePlayers.map((player, index) => {
                  const color = getClassColor(player.class ?? player.name);
                  return (
                    <li key={player.id} className={getRevealClassName({ className: "flex min-h-20 items-center gap-3 border-b border-gold-dim px-2 py-2 hover:bg-bg-panel/55" })} style={getRevealStyle(index)}>
                      <PlayerAvatar name={player.name} realmName={player.realm?.name} characterClass={player.class} color={color} fallbackIconUrl={getClassIconUrl(player.class)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/players/${encodeURIComponent(player.name)}${includeShortPulls ? "?includeShortPulls=1" : ""}`} className="flex min-h-11 items-center text-base font-semibold hover:underline" style={{ color }}>
                          <span className="truncate">{player.name}</span>
                        </Link>
                        <p className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-text-secondary">
                          {player.class && <span>{player.class}</span>}
                          {player.realm && <span>{player.realm.name}</span>}
                          <span>{formatCountLabel(player._count.participants, "pull")}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <nav aria-label="Player directory pages" className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">{formatInteger(data.pagination.firstVisible)}–{formatInteger(data.pagination.lastVisible)} of {formatCountLabel(data.totalCount, "player")} · Page {formatInteger(data.pagination.currentPage)} of {formatInteger(data.pagination.totalPages)}</p>
                <div className="flex gap-2">
                  {data.pagination.currentPage > 1 ? <Link href={pageHref(data.pagination.currentPage - 1)} className={actionClass}><ChevronLeft aria-hidden="true" size={16} />Previous</Link> : <button type="button" disabled className={`${actionClass} opacity-40`}><ChevronLeft aria-hidden="true" size={16} />Previous</button>}
                  {data.pagination.currentPage < data.pagination.totalPages ? <Link href={pageHref(data.pagination.currentPage + 1)} className={actionClass}>Next<ChevronRight aria-hidden="true" size={16} /></Link> : <button type="button" disabled className={`${actionClass} opacity-40`}>Next<ChevronRight aria-hidden="true" size={16} /></button>}
                </div>
              </nav>
            </div>
          )}
          {classStats.length > 0 && (
            <details className="border-y border-gold-dim">
              <summary className="flex min-h-14 cursor-pointer items-center text-sm font-semibold text-gold">Class overview · all {formatCountLabel(data.allPlayersForStats.length, "player")}</summary>
              <div className="space-y-3 pb-5">
                {classStats.map(([className, count]) => (
                  <div key={className} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-text-secondary">{className}</span>
                    <div className="flex-1 h-3 bg-bg-card rounded-sm overflow-hidden"><div className="h-full" style={{ width: `${count / maxClassCount * 100}%`, background: getClassColor(className) }} /></div>
                    <span className="min-w-8 text-right tabular-nums text-text-primary">{formatInteger(count)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </PageShell>
  );
}
