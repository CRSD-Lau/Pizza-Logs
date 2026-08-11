"use client";

import Link from "next/link";
import { cn, formatDps, formatShortDateUtc } from "@/lib/utils";
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
}

export function LeaderboardBar({ entries, metric, className }: LeaderboardBarProps) {
  const maxVal = entries[0]?.value ?? 1;

  return (
    <div className={cn("space-y-2", className)}>
      {entries.map((e, index) => {
        const fillPct = maxVal > 0 ? (e.value / maxVal) * 100 : 0;
        const color = getClassColor(e.class ?? e.playerName);

        return (
          <div
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

            <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[28px_minmax(0,1fr)_80px_80px_56px] sm:items-center">
              <span
                className={cn(
                  "rank-badge text-center row-span-2 sm:row-span-1",
                  e.rank === 1 && "rank-1",
                  e.rank === 2 && "rank-2",
                  e.rank === 3 && "rank-3",
                )}
              >
                {e.rank}
              </span>

              <div className="min-w-0">
                <Link
                  href={`/players/${encodeURIComponent(e.playerName)}`}
                  className="text-sm font-semibold hover:underline truncate block"
                  style={{ color }}
                >
                  {e.playerName}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-dim">
                  <Link href={`/bosses/${e.bossSlug}`} className="hover:text-text-secondary truncate">
                    {e.bossName}
                  </Link>
                  <span className={cn("diff-badge", e.difficulty.endsWith("H") ? "heroic" : "normal")}>
                    {e.difficulty}
                  </span>
                  <span className="sm:hidden">
                    {formatShortDateUtc(e.date)}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-bold tabular-nums text-text-primary">
                  {formatDps(e.value)}
                </span>
                <span className="block text-xs text-text-dim uppercase">{metric}</span>
              </div>

              <div className="hidden text-right text-xs tabular-nums text-text-dim sm:block">
                {formatShortDateUtc(e.date)}
              </div>

              <div className="col-start-3 row-start-2 text-right sm:col-start-5 sm:row-start-1">
                {e.encounterId ? (
                  <Link
                    href={`/encounters/${e.encounterId}`}
                    className="text-[11px] text-gold hover:text-gold-light transition-colors"
                  >
                    View &rarr;
                  </Link>
                ) : (
                  <span className="text-xs text-text-dim">Week view</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
