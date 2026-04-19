"use client";

import Link from "next/link";
import { cn, formatDps } from "@/lib/utils";
import { getClassColor } from "@/lib/constants/classes";

interface LeaderboardEntry {
  rank:        number;
  playerName:  string;
  class?:      string | null;
  value:       number;
  bossName:    string;
  bossSlug:    string;
  difficulty:  string;
  encounterId: string;
  date:        string;
}

interface LeaderboardBarProps {
  entries:    LeaderboardEntry[];
  metric:     "dps" | "hps";
  className?: string;
}

export function LeaderboardBar({ entries, metric, className }: LeaderboardBarProps) {
  const maxVal = entries[0]?.value ?? 1;

  return (
    <div className={cn("space-y-0.5", className)}>
      {entries.map((e) => {
        const fillPct = maxVal > 0 ? (e.value / maxVal) * 100 : 0;
        const color   = getClassColor(e.class ?? e.playerName);

        return (
          <div
            key={`${e.rank}-${e.playerName}`}
            className="relative grid items-center gap-3 px-3 py-2.5 rounded bg-bg-card border border-transparent hover:border-gold-dim transition-colors group overflow-hidden"
            style={{ gridTemplateColumns: "28px 1fr 80px 90px 50px" }}
          >
            {/* bar fill */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: color, opacity: 0.1, width: `${fillPct}%` }}
            />

            {/* rank */}
            <span className={cn(
              "rank-badge relative z-10 text-center",
              e.rank === 1 && "rank-1",
              e.rank === 2 && "rank-2",
              e.rank === 3 && "rank-3",
            )}>
              {e.rank}
            </span>

            {/* player */}
            <div className="relative z-10 min-w-0">
              <Link
                href={`/players/${encodeURIComponent(e.playerName)}`}
                className="text-sm font-semibold hover:underline truncate block"
                style={{ color }}
              >
                {e.playerName}
              </Link>
              <span className="text-[11px] text-text-dim truncate block">
                <Link href={`/bosses/${e.bossSlug}`} className="hover:text-text-secondary">
                  {e.bossName}
                </Link>
                {" "}
                <span className={cn(
                  "diff-badge",
                  e.difficulty.endsWith("H") ? "heroic" : "normal"
                )}>
                  {e.difficulty}
                </span>
              </span>
            </div>

            {/* value */}
            <div className="relative z-10 text-right">
              <span className="text-base font-bold tabular-nums text-text-primary">
                {formatDps(e.value)}
              </span>
              <span className="block text-[10px] text-text-dim uppercase">{metric}</span>
            </div>

            {/* date */}
            <div className="relative z-10 text-right text-[11px] text-text-dim tabular-nums">
              {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>

            {/* link */}
            <div className="relative z-10 text-right">
              <Link
                href={`/encounters/${e.encounterId}`}
                className="text-[11px] text-text-dim hover:text-gold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
