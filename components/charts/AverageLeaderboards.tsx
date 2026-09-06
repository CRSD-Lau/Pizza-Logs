import Link from "next/link";
import { PageSection } from "@/components/ui/PageLayout";
import { getClassColor } from "@/lib/constants/classes";
import { MIN_AVERAGE_FIGHTS, type AverageLeaderboardEntry } from "@/lib/average-leaderboards";
import { cn, formatCountLabel, formatDps, formatInteger } from "@/lib/utils";

export function AverageLeaderboards({ dps, hps }: {
  dps: AverageLeaderboardEntry[];
  hps: AverageLeaderboardEntry[];
}) {
  return (
    <PageSection id="all-time-averages" title="All-time averages" description={
      <>Every logged boss attempt in this selection, including wipes and short pulls. Each fight counts equally; at least {formatInteger(MIN_AVERAGE_FIGHTS)} fights with a valid duration per player.</>
    }>
      <div className="grid gap-6 md:grid-cols-2">
        {([{ metric: "DPS", entries: dps }, { metric: "HPS", entries: hps }] as const).map(({ metric, entries }) => (
          <section key={metric} aria-labelledby={`average-${metric.toLowerCase()}`} className="min-w-0 space-y-3">
            <h3 id={`average-${metric.toLowerCase()}`} className="text-sm font-semibold uppercase tracking-wide text-gold-light">Top 3 Average {metric}</h3>
            {entries.length === 0 ? (
              <p className="rounded-sm bg-bg-card p-4 text-sm text-text-secondary">No qualifying players yet. A player needs at least {formatInteger(MIN_AVERAGE_FIGHTS)} fights and a positive average {metric} in this selection.</p>
            ) : (
              <ol aria-label={`Average ${metric} positions`} className="space-y-2">
                {entries.map((entry, index) => (
                  <li key={entry.playerId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-sm bg-bg-card px-3 py-2">
                    <span className={cn("rank-badge", `rank-${index + 1}`)}><span className="sr-only">Position </span><span aria-hidden="true">#</span>{formatInteger(index + 1)}</span>
                    <div className="min-w-0">
                      <Link href={`/players/${encodeURIComponent(entry.playerName)}`} className="flex min-h-11 items-center text-sm font-semibold hover:underline" style={{ color: getClassColor(entry.class ?? entry.playerName) }}>
                        <span className="min-w-0 break-words">{entry.playerName}</span>
                      </Link>
                      <p className="break-words text-sm text-text-secondary">{[entry.class, entry.realm].filter(Boolean).join(" · ") || "Unknown class"}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="block text-lg font-bold text-text-primary">{formatDps(entry.value)}</span>
                      <span className="block text-sm text-text-secondary">Avg {metric}</span>
                    </div>
                    <p className="col-span-2 col-start-2 mt-1 text-sm text-text-secondary">{formatCountLabel(entry.fights, "fight")}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
      <p className="text-sm text-text-secondary">Averages include zero-output fights and role changes. HPS measures effective healing; absorbs are separate. Boss mix and healing demand affect these standings.</p>
    </PageSection>
  );
}
