import { GuildRosterTable } from "@/components/guild-roster/GuildRosterTable";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM, readGuildRosterMembers } from "@/lib/warmane-guild-roster";
import { PageHeader } from "@/components/ui/PageLayout";

import { buildPageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { WOW_CLASSES } from "@/lib/constants/classes";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { parseDirectoryFilters, parseDirectoryPage, type DirectoryQueryValue } from "@/lib/directory-pagination";
import { formatCountLabel, formatDateTimeUtc } from "@/lib/utils";

export const metadata = buildPageMetadata({
  title: "Guild Roster",
  description: "Browse PizzaWarriors members and character profiles from the latest saved Warmane Lordaeron roster.",
  path: "/guild-roster",
});
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ page?: DirectoryQueryValue; q?: DirectoryQueryValue; class?: DirectoryQueryValue }>;
}

export default async function GuildRosterPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentPage = parseDirectoryPage(params.page);
  const { query, classFilter } = parseDirectoryFilters(params);
  let members: Awaited<ReturnType<typeof readGuildRosterMembers>> = [];
  let databaseAvailable = true;
  try {
    members = await readGuildRosterMembers(DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }
  const latestSync = members.reduce<Date | null>((latest, member) => {
    if (!latest || member.lastSyncedAt > latest) return member.lastSyncedAt;
    return latest;
  }, null);

  return (
    <div className="page-shell">
      <PageHeader
        title="Guild Roster"
        description={<p>
          {members.length > 0
            ? `${formatCountLabel(members.length, `${DEFAULT_GUILD_NAME} member`)} on ${DEFAULT_GUILD_REALM}`
            : `${DEFAULT_GUILD_NAME} members on ${DEFAULT_GUILD_REALM}`}
          {latestSync && (
            <span className="text-text-dim">
              {" "}· Last synced {formatDateTimeUtc(latestSync)}
            </span>
          )}
        </p>}
      />

      {databaseAvailable ? (
        <>
          <form key={`${query}:${classFilter ?? ""}`} action="/guild-roster" method="get" role="search" aria-label="Filter guild roster" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="guild-member-name" className="mb-1.5 block text-sm font-semibold text-text-secondary">Member name</label>
              <input id="guild-member-name" name="q" type="search" defaultValue={query} maxLength={64} placeholder="Find a guild member" className="min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary" />
            </div>
            <div>
              <label htmlFor="guild-member-class" className="mb-1.5 block text-sm font-semibold text-text-secondary">Class</label>
              <select id="guild-member-class" name="class" defaultValue={classFilter ?? ""} className="min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary">
                <option value="">All classes</option>
                {WOW_CLASSES.map(className => <option key={className} value={className}>{className}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-gold px-4 py-2 text-sm font-semibold text-gold-light">Find members</button>
              {(query || classFilter) && <Link href="/guild-roster" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-text-secondary hover:text-gold-light">Clear filters</Link>}
            </div>
          </form>
          <GuildRosterTable members={members} currentPage={currentPage} query={query} classFilter={classFilter} />
        </>
      ) : <DatabaseUnavailable description="The guild roster is temporarily unavailable. Please try again shortly." />}
    </div>
  );
}
