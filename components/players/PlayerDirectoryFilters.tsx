import Link from "next/link";
import { Search } from "lucide-react";
import { WOW_CLASSES } from "@/lib/constants/classes";
import { buildDirectoryHref } from "@/lib/directory-pagination";
import { getPlayerClassMeta } from "@/lib/player-class";
import { PlayerDirectoryClassIcon } from "./PlayerDirectory";

export const playerDirectoryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-gold-dim px-4 py-2 text-sm font-semibold text-text-secondary hover:border-gold hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const fieldClass = "min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function PlayerDirectoryFilters({ query, classFilter, includeShortPulls }: {
  query: string;
  classFilter?: string;
  includeShortPulls: boolean;
}) {
  const resetHref = buildDirectoryHref("/players", { includeShortPulls });
  const classHref = (selectedClass?: string) => buildDirectoryHref("/players", {
    query, classFilter: selectedClass, includeShortPulls,
  });

  return (
    <section aria-label="Find players" className="space-y-4">
      <form key={`${query}:${classFilter ?? ""}`} action="/players" method="get" role="search" aria-label="Filter player directory" className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
        <div className="col-span-2 min-w-0 sm:min-w-60 sm:flex-1">
          <label htmlFor="directory-player-name" className="mb-2 block text-sm font-semibold text-text-secondary">Player name</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
            <input id="directory-player-name" name="q" type="search" defaultValue={query} maxLength={64} placeholder="Find a player by name" className={`${fieldClass} pl-10`} />
          </div>
        </div>
        <div className="min-w-0 sm:w-48">
          <label htmlFor="directory-player-class" className="mb-2 block text-sm font-semibold text-text-secondary">Class</label>
          <select id="directory-player-class" name="class" defaultValue={classFilter ?? ""} className={fieldClass}>
            <option value="">All classes</option>
            {WOW_CLASSES.map(className => <option key={className} value={className}>{className}</option>)}
          </select>
        </div>
        {includeShortPulls && <input type="hidden" name="includeShortPulls" value="1" />}
        <button type="submit" className={`${playerDirectoryActionClass} border-gold bg-bg-panel text-gold-light`}>Find players</button>
        {(query || classFilter) && <Link href={resetHref} className={`${playerDirectoryActionClass} col-span-2`}>Clear filters</Link>}
      </form>
      <nav aria-label="Filter players by class" className="hidden flex-wrap gap-2 sm:flex">
        <Link href={classHref()} aria-current={!classFilter ? "page" : undefined} className={`${playerDirectoryActionClass} ${!classFilter ? "border-gold bg-bg-panel text-gold-light" : ""}`}>All classes</Link>
        {WOW_CLASSES.map(className => {
          const meta = getPlayerClassMeta(className);
          const selected = classFilter === className;
          return (
            <Link key={className} href={classHref(className)} aria-current={selected ? "page" : undefined} className={`${playerDirectoryActionClass} px-3 ${selected ? "border-gold bg-bg-panel text-text-primary" : ""}`}>
              <PlayerDirectoryClassIcon characterClass={className} />
              {className}
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
