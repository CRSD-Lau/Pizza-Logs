import Link from "next/link";
import { GuildRosterRefreshButton } from "./GuildRosterRefreshButton";
import { formatDateTimeUtc } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { StatCard, StatGroup } from "@/components/ui/StatCard";

export function GuildRosterSyncPanel({
  rosterCount,
  latestSync,
  available = true,
}: {
  rosterCount: number | null;
  latestSync: Date | null;
  available?: boolean;
}) {
  return (
    <div className="space-y-4">
      <StatGroup columns={2}>
        <StatCard label="Roster Members" value={<NumericValue value={rosterCount} />} />
        <StatCard label="Last Sync" value={
          <span className="block text-base font-medium leading-relaxed">
            {!available ? "Unavailable" : latestSync ? formatDateTimeUtc(latestSync) : "Never"}
          </span>
        } />
      </StatGroup>

      <p className="text-sm text-text-secondary max-w-3xl">
        Refreshing runs entirely on the Pizza Logs server and writes a durable roster snapshot.
        The public roster continues to load from that snapshot if Warmane is temporarily
        unavailable. No Tampermonkey install, open Warmane tab, or browser-stored admin secret
        is required.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <GuildRosterRefreshButton />
        <Link href="/guild-roster" className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">
          View public roster &rarr;
        </Link>
      </div>
    </div>
  );
}
