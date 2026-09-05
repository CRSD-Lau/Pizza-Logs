"use client";

import Link from "next/link";
import { cn, formatDps, formatInteger, formatShortDateUtc } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  class?: string | null;
  value: number;
  bossName: string;
  bossSlug: string;
  difficulty: string;
  encounterId: string;
  date: string;
}

interface LeaderboardBarProps {
  entries: LeaderboardEntry[];
  metric: "dps" | "hps";
  className?: string;
  querySuffix?: string;
}

export function LeaderboardBar({ entries, metric, className, querySuffix = "" }: LeaderboardBarProps) {
  const maxVal = entries[0]?.value ?? 1;

  return (
    <ol aria-label={`${metric.toUpperCase()} positions`} className={cn("@container list-none space-y-2", className)}>
      {entries.map((e, index) => {
        const fillPct = maxVal > 0 ? (e.value / maxVal) * 100 : 0;
        const color = getClassColor(e.class ?? e.playerName);

        return (
          <li
            key={`${e.rank}-${e.playerName}`}
            className={cn(
              getRevealClassName(),
              "relative overflow-hidden rounded-sm bg-bg-card border border-transparent hover:border-gold-dim transition-colors group"
            )}
            style={getRevealStyle(index)}
          >
            <div
              className="absolute inset-y-0 left-0 pointer-events-none"
              style={{ background: color, opacity: 0.1, width: `${fillPct}%` }}
            />

            <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 @2xl:grid-cols-[40px_minmax(0,1fr)_max-content_104px_56px] @2xl:items-center">
              <span
                className={cn(
                  "rank-badge whitespace-nowrap text-center row-span-2 @2xl:row-span-1",
                  e.rank === 1 && "rank-1",
                  e.rank === 2 && "rank-2",
                  e.rank === 3 && "rank-3",
                )}
              >
                <span className="sr-only">Position </span><span aria-hidden="true">#</span>{formatInteger(e.rank)}
              </span>

              <div className="min-w-0">
                <Link
                  href={`/players/${encodeURIComponent(e.playerName)}`}
                  className="flex min-h-11 items-center text-sm font-semibold hover:underline"
                  style={{ color }}
                >
                  <span className="break-words">{e.playerName}</span>
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
                  <Link href={`/bosses/${e.bossSlug}${querySuffix}`} className="inline-flex min-h-11 items-center hover:text-text-primary">
                    {e.bossName}
                  </Link>
                  <span className={cn("diff-badge", e.difficulty.endsWith("H") ? "heroic" : "normal")} style={{ color: "var(--color-text-secondary)" }}>
                    {e.difficulty}
                  </span>
                  <span className="@2xl:hidden">
                    {formatShortDateUtc(e.date)}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-bold tabular-nums text-text-primary">
                  {formatDps(e.value)}
                </span>
                <span className="block text-sm text-text-secondary">{metric.toUpperCase()}</span>
              </div>

              <div className="hidden text-right text-sm tabular-nums text-text-secondary @2xl:block">
                {formatShortDateUtc(e.date)}
              </div>

              <div className="col-start-3 row-start-2 text-right @2xl:col-start-5 @2xl:row-start-1">
                {e.encounterId ? (
                  <Link
                    href={`/encounters/${e.encounterId}${querySuffix}`}
                    aria-label={`View ${e.playerName}'s ${e.bossName} ${e.difficulty} attempt`}
                    className="inline-flex min-h-11 min-w-11 items-center text-sm text-gold hover:text-gold-light transition-colors"
                  >
                    View &rarr;
                  </Link>
                ) : (
                  <span className="text-sm text-text-secondary">Report unavailable</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
