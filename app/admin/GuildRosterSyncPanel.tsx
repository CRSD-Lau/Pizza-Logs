import Link from "next/link";
import {
  GUILD_ROSTER_USERSCRIPT_URL,
  buildGuildRosterBookmarklet,
} from "../../lib/guild-roster-client-scripts";

export function GuildRosterSyncPanel({
  rosterCount,
  latestSync,
  action,
}: {
  rosterCount: number;
  latestSync: Date | null;
  action?: React.ReactNode;
}) {
  const bookmarklet = buildGuildRosterBookmarklet();

  return (
    <div className="bg-bg-panel border border-gold-dim rounded p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-card border border-gold-dim rounded px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-dim">Roster Members</p>
          <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{rosterCount.toLocaleString()}</p>
        </div>
        <div className="bg-bg-card border border-gold-dim rounded px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-dim">Last Sync</p>
          <p className="mt-1 text-sm font-semibold text-text-secondary">
            {latestSync ? latestSync.toLocaleString() : "Never"}
          </p>
        </div>
      </div>

      <p className="text-sm text-text-secondary max-w-3xl">
        The sync runs server-side: Pizza Logs asks Warmane for the PizzaWarriors roster JSON first, falls back to the guild summary page if needed, normalizes each member, and upserts the rows into <span className="font-mono text-text-primary">guild_roster_members</span>. The public roster page reads only from our database, so it still loads even when Warmane is down or blocking requests.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        {action}
        <Link href="/guild-roster" className="text-sm text-gold hover:text-gold-light">
          View public roster &rarr;
        </Link>
      </div>

      <div className="rounded border border-gold-dim bg-bg-card p-4 space-y-3">
        <div>
          <h3 className="heading-cinzel text-sm text-gold tracking-wide">Browser Roster Import</h3>
          <p className="text-sm text-text-secondary mt-1">
            If the server-side sync is blocked by Warmane, install this userscript, open the Warmane Armory guild page, and click the floating Pizza Logs Roster Sync button. Your browser fetches the Warmane roster and imports it into Pizza Logs.
          </p>
        </div>
        <a
          href={GUILD_ROSTER_USERSCRIPT_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded border border-gold-dim px-4 py-2 text-sm text-gold transition-colors hover:border-gold hover:text-gold-light"
        >
          Install / Update Roster Userscript
        </a>
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-text-dim">
            Warmane guild page
          </label>
          <textarea
            readOnly
            rows={2}
            value="https://armory.warmane.com/guild/Pizza+Warriors/Lordaeron/summary"
            className="w-full rounded border border-gold-dim bg-bg-deep p-3 font-mono text-xs text-text-secondary"
          />
        </div>
        <details className="text-sm text-text-secondary">
          <summary className="cursor-pointer text-gold hover:text-gold-light">Bookmarklet fallback code</summary>
          <textarea
            readOnly
            rows={4}
            value={bookmarklet}
            className="mt-2 w-full rounded border border-gold-dim bg-bg-deep p-3 font-mono text-xs text-text-secondary"
          />
        </details>
      </div>
    </div>
  );
}
