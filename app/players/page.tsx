import Link from "next/link";
import { db } from "@/lib/db";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { WOW_CLASSES } from "@/lib/constants/classes";
import { getClassColor } from "@/lib/constants/classes";
import { getClassIconUrl } from "@/lib/class-icons";
import { formatDps } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buildPageMetadata } from "@/lib/page-metadata";

export const metadata = buildPageMetadata({
  title: "Players",
  description: "Find PizzaWarriors players, raid history, records, and cached Warmane gear.",
  path: "/players",
});
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ class?: string; page?: string }>;
}

const PLAYERS_PER_PAGE = 30;

type PlayerStatsRow = {
  class: string | null;
  milestones: Array<{ value: number }>;
};

type PlayerListRow = {
  id: string;
  name: string;
  class: string | null;
  realm: { name: string } | null;
  _count: { participants: number };
  milestones: Array<{
    value: number;
    metric: string;
    rank: number;
    difficulty: string;
  }>;
};

type PlayersPageData = {
  databaseAvailable: boolean;
  allPlayersForStats: PlayerStatsRow[];
  players: PlayerListRow[];
  totalCount: number;
};

async function getPlayersPageData(classFilter?: string): Promise<PlayersPageData> {
  try {
    const [allPlayersForStats, players, totalCount] = await Promise.all([
      db.player.findMany({
        select: {
          class:     true,
          milestones: {
            where:   { supersededAt: null, metric: "DPS" },
            orderBy: { value: "desc" },
            take:    1,
            select:  { value: true },
          },
        },
      }),
      db.player.findMany({
        where:   classFilter ? { class: classFilter } : undefined,
        orderBy: { name: "asc" },
        include: {
          realm:  { select: { name: true } },
          _count: { select: { participants: true } },
          milestones: {
            where:   { supersededAt: null },
            orderBy: { value: "desc" },
            take:    3,
            select:  { value: true, metric: true, rank: true, difficulty: true },
          },
        },
      }),
      db.player.count(),
    ]);

    return { databaseAvailable: true, allPlayersForStats, players, totalCount };
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    return { databaseAvailable: false, allPlayersForStats: [], players: [], totalCount: 0 };
  }
}

export default async function PlayersPage({ searchParams }: Props) {
  const { class: classFilter, page: requestedPage } = await searchParams;

  // Class stats — always unfiltered, used for the visualization panel
  const { databaseAvailable, allPlayersForStats, players, totalCount } = await getPlayersPageData(classFilter);

  // Aggregate per class: player count + sum of best DPS (for avg)
  const classMap = new Map<string, { count: number; dpsTotal: number; dpsCount: number }>();
  for (const p of allPlayersForStats) {
    const cls = p.class ?? "Unknown";
    const entry = classMap.get(cls) ?? { count: 0, dpsTotal: 0, dpsCount: 0 };
    entry.count++;
    if (p.milestones[0]) {
      entry.dpsTotal += p.milestones[0].value;
      entry.dpsCount++;
    }
    classMap.set(cls, entry);
  }

  // Sort by player count desc for distribution bar
  const classStats = Array.from(classMap.entries())
    .filter(([cls]) => cls !== "Unknown")
    .sort((a, b) => b[1].count - a[1].count);

  const totalPlayersWithClass = classStats.reduce((s, [, v]) => s + v.count, 0);

  // Sort by avg DPS desc for the bar chart
  const classAvgDps = classStats
    .filter(([, v]) => v.dpsCount > 0)
    .map(([cls, v]) => ({ cls, avg: v.dpsTotal / v.dpsCount }))
    .sort((a, b) => b.avg - a.avg);

  const maxAvgDps = classAvgDps[0]?.avg ?? 1;

  // Derive quick stats per player
  const enriched = players.map(p => {
    const dpsMilestone = p.milestones.find(m => m.metric === "DPS");
    const hpsMilestone = p.milestones.find(m => m.metric === "HPS");
    return {
      ...p,
      bestDps: dpsMilestone?.value ?? null,
      bestHps: hpsMilestone?.value ?? null,
      topRank: p.milestones.length > 0 ? Math.min(...p.milestones.map(m => m.rank)) : null,
    };
  });

  // Sort: milestones holders first, then by encounter count
  enriched.sort((a, b) => {
    if (a.topRank !== null && b.topRank === null) return -1;
    if (a.topRank === null && b.topRank !== null) return 1;
    if (a.topRank !== null && b.topRank !== null) return a.topRank - b.topRank;
    return b._count.participants - a._count.participants;
  });

  const totalPages = Math.max(1, Math.ceil(enriched.length / PLAYERS_PER_PAGE));
  const parsedPage = Number.parseInt(requestedPage ?? "1", 10);
  const currentPage = Math.min(Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1), totalPages);
  const pageStart = (currentPage - 1) * PLAYERS_PER_PAGE;
  const visiblePlayers = enriched.slice(pageStart, pageStart + PLAYERS_PER_PAGE);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (classFilter) params.set("class", classFilter);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/players?${query}` : "/players";
  };

  return (
    <PageShell>
      <PageHeader
        title="Players"
        description={
          <p>
          {!databaseAvailable
            ? "Player data is unavailable while the database is offline"
            : classFilter
            ? `${players.length} ${classFilter}${players.length !== 1 ? "s" : ""} · ${totalCount} total`
            : `${totalCount} players tracked across logs and the guild roster`}
          </p>
        }
      />

      {!databaseAvailable && (
        <DatabaseUnavailable description="The player list and profile search need the Pizza Logs database. Start local Postgres to load players." />
      )}

      {/* Class stats */}
      {databaseAvailable && classStats.length > 0 && (
        <details className="group border-y border-gold-dim">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-sm px-2 py-3 text-sm font-semibold uppercase tracking-widest text-gold hover:bg-bg-panel/45 [&::-webkit-details-marker]:hidden">
            Class overview
            <span className="text-text-dim transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-5 px-2 pb-5 pt-2">
          {/* Distribution bar */}
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-text-dim">
              Class Distribution
            </p>
            <div className="flex h-5 rounded-sm overflow-hidden gap-px">
              {classStats.map(([cls, { count }]) => (
                <div
                  key={cls}
                  style={{
                    width:      `${(count / totalPlayersWithClass) * 100}%`,
                    background: getClassColor(cls),
                    opacity:    0.8,
                    minWidth:   count > 0 ? 2 : 0,
                  }}
                  title={`${cls}: ${count} player${count !== 1 ? "s" : ""}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {classStats.map(([cls, { count }]) => (
                <span key={cls} className="flex items-center gap-1 text-sm text-text-dim">
                  <span
                    className="inline-block w-2 h-2 rounded-xs"
                    style={{ background: getClassColor(cls) }}
                  />
                  {cls} <span className="text-text-secondary">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Avg best DPS by class */}
          {classAvgDps.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-text-dim">
                Avg Best DPS by Class
              </p>
              <div className="space-y-1.5">
                {classAvgDps.map(({ cls, avg }) => (
                  <div key={cls} className="flex items-center gap-2">
                    <span
                      className="w-24 shrink-0 truncate text-sm font-semibold"
                      style={{ color: getClassColor(cls) }}
                    >
                      {cls}
                    </span>
                    <div className="flex-1 h-3 bg-bg-card rounded-sm overflow-hidden">
                      <div
                        style={{
                          width:      `${(avg / maxAvgDps) * 100}%`,
                          background: getClassColor(cls),
                          opacity:    0.75,
                        }}
                        className="h-full rounded-sm"
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-sm tabular-nums text-text-secondary">
                      {formatDps(avg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </details>
      )}

      {/* Class filter */}
      {databaseAvailable && (
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/players"
          className={cn(
            "inline-flex min-h-11 items-center rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
            !classFilter
              ? "border-gold bg-gold/10 text-gold-light"
              : "border-gold-dim text-text-dim hover:border-gold/40 hover:text-text-secondary"
          )}
        >
          All
        </Link>
        {WOW_CLASSES.map(cls => {
          const color = getClassColor(cls);
          const active = classFilter === cls;
          return (
            <Link
              key={cls}
              href={`/players?class=${encodeURIComponent(cls)}`}
              className={cn(
                "inline-flex min-h-11 items-center rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                active ? "opacity-100" : "opacity-60 hover:opacity-90"
              )}
              style={{
                color,
                borderColor: active ? color : `${color}44`,
                background:  active ? `${color}18` : "transparent",
              }}
            >
              {cls}
            </Link>
          );
        })}
      </div>
      )}

      {/* Player grid */}
      {databaseAvailable && (enriched.length === 0 ? (
        <EmptyState
          title="No players found"
          description={classFilter ? `No ${classFilter}s recorded yet.` : "Upload a combat log to get started."}
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log →</Link>}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid border-y border-gold-dim sm:grid-cols-2 lg:grid-cols-3">
          {visiblePlayers.map((p, index) => {
            const color = getClassColor(p.class ?? p.name);
            return (
              <article
                key={p.id}
                className={getRevealClassName({
                  className:
                    "group flex min-h-20 items-center gap-3 border-b border-gold-dim px-3 py-3 transition-colors hover:bg-bg-panel/55 sm:border-r",
                })}
                style={getRevealStyle(index)}
              >
                {/* Avatar */}
                <PlayerAvatar
                  name={p.name}
                  realmName={p.realm?.name}
                  characterClass={p.class}
                  color={color}
                  fallbackIconUrl={getClassIconUrl(p.class)}
                  size="sm"
                />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/players/${encodeURIComponent(p.name)}`}
                      className="text-sm font-semibold truncate group-hover:text-gold-light transition-colors"
                      style={{ color }}
                    >
                      {p.name}
                    </Link>
                    {p.topRank === 1 && (
                      <span className="text-[10px] text-gold font-bold shrink-0">👑 #1</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-text-dim">
                    {p.class && <span>{p.class}</span>}
                    {p.realm && <span>· {p.realm.name}</span>}
                    <span>· {p._count.participants} pulls</span>
                  </div>
                  {/* Best DPS/HPS */}
                  {(p.bestDps !== null || p.bestHps !== null) && (
                    <div className="mt-1 flex items-center gap-3 text-xs tabular-nums">
                      {p.bestDps !== null && (
                        <span className="text-text-secondary">
                          <span className="text-text-dim">Best </span>
                          <span className="font-semibold text-text-primary">{formatDps(p.bestDps)}</span>
                          <span className="text-text-dim"> dps</span>
                        </span>
                      )}
                      {p.bestHps !== null && p.bestHps > 200 && (
                        <span className="text-text-secondary">
                          <span className="text-text-dim">Best </span>
                          <span className="font-semibold text-text-primary">{formatDps(p.bestHps)}</span>
                          <span className="text-text-dim"> hps</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          </div>
          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Player directory pages">
              <Link
                href={pageHref(currentPage - 1)}
                aria-disabled={currentPage === 1}
                className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-gold-dim px-3 text-sm text-text-secondary", currentPage === 1 && "pointer-events-none opacity-40")}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> <span className="ml-1 hidden sm:inline">Previous</span>
              </Link>
              <p className="text-sm tabular-nums text-text-dim">
                {pageStart + 1}–{Math.min(pageStart + PLAYERS_PER_PAGE, enriched.length)} of {enriched.length}
              </p>
              <Link
                href={pageHref(currentPage + 1)}
                aria-disabled={currentPage === totalPages}
                className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-gold-dim px-3 text-sm text-text-secondary", currentPage === totalPages && "pointer-events-none opacity-40")}
              >
                <span className="mr-1 hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </nav>
          )}
        </div>
      ))}
    </PageShell>
  );
}
