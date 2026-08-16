import { GuildRosterTable } from "@/components/guild-roster/GuildRosterTable";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM, readGuildRosterMembers } from "@/lib/warmane-guild-roster";
import { PageHeader } from "@/components/ui/PageLayout";

import { buildPageMetadata } from "@/lib/page-metadata";

export const metadata = buildPageMetadata({
  title: "Guild Roster",
  description: "Browse the cached PizzaWarriors roster and character profiles on Warmane Lordaeron.",
  path: "/guild-roster",
});
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ page?: string | string[] }>;
}

function parseRosterPage(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function GuildRosterPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const currentPage = parseRosterPage(page);
  const members = await readGuildRosterMembers(DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM);
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
            ? `${members.length} ${DEFAULT_GUILD_NAME} members on ${DEFAULT_GUILD_REALM}`
            : `${DEFAULT_GUILD_NAME} members on ${DEFAULT_GUILD_REALM}`}
          {latestSync && (
            <span className="text-text-dim">
              {" "}· Last synced {latestSync.toLocaleString()}
            </span>
          )}
        </p>}
      />

      <GuildRosterTable members={members} currentPage={currentPage} />
    </div>
  );
}
