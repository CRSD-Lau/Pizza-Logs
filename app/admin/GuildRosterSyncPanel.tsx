import Link from "next/link";
import { GuildRosterRefreshButton } from "./GuildRosterRefreshButton";

export function GuildRosterSyncPanel({
  rosterCount,
  latestSync,
}: {
  rosterCount: number;
  latestSync: Date | null;
}) {
  return (
    <div className="bg-bg-panel border border-gold-dim rounded-sm p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-card border border-gold-dim rounded-sm px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-text-dim">Roster Members</p>
          <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{rosterCount.toLocaleString()}</p>
        </div>
        <div className="bg-bg-card border border-gold-dim rounded-sm px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-text-dim">Last Sync</p>
          <p className="mt-1 text-sm font-semibold text-text-secondary">
            {latestSync ? latestSync.toLocaleString() : "Never"}
          </p>
        </div>
      </div>

      <p className="text-sm text-text-secondary max-w-3xl">
        Refreshing runs entirely on the Pizza Logs server and writes a durable roster snapshot.
        The public roster continues to load from that snapshot if Warmane is temporarily
        unavailable. No Tampermonkey install, open Warmane tab, or browser-stored admin secret
        is required.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <GuildRosterRefreshButton />
        <Link href="/guild-roster" className="text-sm text-gold hover:text-gold-light">
          View public roster &rarr;
        </Link>
      </div>
    </div>
  );
}
