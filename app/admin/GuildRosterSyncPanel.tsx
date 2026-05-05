import Link from "next/link";
import {
  GUILD_ROSTER_USERSCRIPT_URL,
  LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
} from "../../lib/guild-roster-client-scripts";

export function GuildRosterSyncPanel({
  rosterCount,
  latestSync,
}: {
  rosterCount: number;
  latestSync: Date | null;
}) {
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
        Warmane blocks server-side requests from Railway, so the roster is synced via a
        browser userscript. Install the userscript below, open the Warmane guild page, and
        click the floating Pizza Logs Roster Sync button. Your browser fetches the roster
        and posts it to Pizza Logs. The public roster page reads only from our database, so
        it loads even when Warmane is unavailable.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Link href="/guild-roster" className="text-sm text-gold hover:text-gold-light">
          View public roster &rarr;
        </Link>
      </div>

      <div className="rounded border border-gold-dim bg-bg-card p-4 space-y-3">
        <div>
          <h3 className="heading-cinzel text-sm text-gold tracking-wide">Browser Roster Import</h3>
          <p className="text-sm text-text-secondary mt-1">
            Install this userscript with Tampermonkey, then open the Warmane guild page below.
            The floating Pizza Logs Roster Sync button will import the full roster into Pizza Logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={GUILD_ROSTER_USERSCRIPT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded border border-gold-dim px-4 py-2 text-sm text-gold transition-colors hover:border-gold hover:text-gold-light"
          >
            Install / Update Roster Userscript
          </a>
          <a
            href={LOCAL_GUILD_ROSTER_USERSCRIPT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded border border-gold-dim px-4 py-2 text-sm text-gold transition-colors hover:border-gold hover:text-gold-light"
          >
            Install Local Roster Userscript
          </a>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-text-dim">
            Roster local install URL
          </label>
          <textarea
            readOnly
            rows={2}
            value={LOCAL_GUILD_ROSTER_USERSCRIPT_URL}
            className="w-full rounded border border-gold-dim bg-bg-deep p-3 font-mono text-xs text-text-secondary"
          />
        </div>
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
      </div>
    </div>
  );
}
