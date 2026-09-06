import { db } from "@/lib/db";
import { getPlayerRaidComparison } from "@/lib/player-raid-comparison.server";
import type { RaidComparisonData } from "@/lib/player-raid-comparison";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerRaidComparison } from "@/components/players/PlayerRaidComparison";

type Search = {
  comparisonRaid?: string | string[];
  comparisonDifficulty?: string | string[];
  comparisonFirst?: string | string[];
  comparisonSecond?: string | string[];
};

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function PlayerRaidComparisonSkeleton() {
  return (
    <AccordionSection id="raid-progress" title="Raid-over-raid performance" sub="Compare your successful boss fights across recorded raids" defaultOpen>
      <p role="status" className="rounded-sm border border-gold-dim bg-bg-panel p-4 text-sm text-text-secondary">Loading raid history…</p>
    </AccordionSection>
  );
}

export async function PlayerRaidComparisonSection({ playerId, playerName, search }: {
  playerId?: string;
  playerName: string;
  search: Search;
}) {
  let data: RaidComparisonData | null = null;
  if (playerId) {
    try {
      data = await getPlayerRaidComparison(db, playerId, {
        raid: first(search.comparisonRaid),
        difficulty: first(search.comparisonDifficulty),
        first: first(search.comparisonFirst),
        second: first(search.comparisonSecond),
      });
    } catch {
      // Keep the profile usable when its independent history query is unavailable.
    }
  }
  return (
    <AccordionSection id="raid-progress" title="Raid-over-raid performance" sub="Compare your successful boss fights across recorded raids" defaultOpen>
      {!playerId ? <EmptyState title="No recorded raid comparisons" description="Your successful boss fights will appear here after a raid log includes this character." />
        : data ? <PlayerRaidComparison key={JSON.stringify([data.raidSlug, data.difficulty, data.runs.map(run => run.key)])} data={data} playerName={playerName} />
          : <EmptyState title="Raid comparison is temporarily unavailable" description="Refresh this page to try loading your raid history again." />}
    </AccordionSection>
  );
}
