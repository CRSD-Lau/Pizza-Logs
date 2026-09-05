import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { getClassColor } from "../../lib/constants/classes";
import { getRevealClassName, getRevealStyle } from "../../lib/ui-animation";
import { getClassIconUrl } from "../../lib/class-icons";
import { buildDirectoryHref, directoryNameMatches, getDirectoryPagination } from "../../lib/directory-pagination";

const GUILD_ROSTER_PAGE_SIZE = 20;

export type GuildRosterTableMember = {
  id: string;
  characterName: string;
  normalizedCharacterName: string;
  guildName: string;
  realm: string;
  className: string | null;
  raceName: string | null;
  level: number | null;
  rankName: string | null;
  rankOrder?: number | null;
  professionsJson?: unknown | null;
  gearScore?: number | null;
  armoryUrl: string;
  gearSnapshotJson: unknown | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type GuildRosterTableProps = {
  members: GuildRosterTableMember[];
  currentPage?: number;
  query?: string;
  classFilter?: string;
};

function formatSyncedAt(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatProfession(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const profession = value as Record<string, unknown>;
  const name = typeof profession.name === "string" ? profession.name : null;
  const skill = typeof profession.skill === "number" ? profession.skill : Number(profession.skill);
  if (!name) return null;
  return Number.isFinite(skill) && skill > 0 ? `${name} ${skill}` : name;
}

function formatProfessions(value: unknown): string {
  if (!Array.isArray(value)) return "-";
  const professions = value.map(formatProfession).filter((profession): profession is string => Boolean(profession));
  return professions.length > 0 ? professions.join(", ") : "-";
}

function PageNavButton({
  href,
  label,
  disabled,
  children,
}: {
  href: string;
  label: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const className =
    "inline-flex h-11 w-11 items-center justify-center rounded-sm border border-gold-dim text-text-secondary transition-colors";

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className={`${className} cursor-not-allowed opacity-40`}
        title={label}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${className} hover:border-gold/60 hover:text-gold-light`}
      title={label}
    >
      {children}
    </Link>
  );
}

export function GuildRosterTable({ members, currentPage = 1, query = "", classFilter }: GuildRosterTableProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="heading-cinzel text-base text-text-secondary mb-2">No guild roster data yet</p>
        <p className="text-sm text-text-dim max-w-xs">
          Guild members will appear after the next roster update. Please check back shortly.
        </p>
      </div>
    );
  }

  const filteredMembers = members.filter(member => directoryNameMatches(member.characterName, query)
    && (!classFilter || member.className === classFilter));
  if (filteredMembers.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-base font-semibold text-text-primary">No guild members match these filters</p>
        <p className="mt-2 text-sm text-text-secondary">Try another name or class.</p>
        <Link href="/guild-roster" className="mt-3 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-gold hover:text-gold-light">Clear filters</Link>
      </div>
    );
  }
  const { currentPage: page, totalPages, startIndex } = getDirectoryPagination(filteredMembers.length, currentPage, GUILD_ROSTER_PAGE_SIZE);
  const visibleMembers = filteredMembers.slice(startIndex, startIndex + GUILD_ROSTER_PAGE_SIZE);
  const getPageHref = (nextPage: number) => buildDirectoryHref("/guild-roster", { query, classFilter, page: nextPage });
  const firstVisible = startIndex + 1;
  const lastVisible = startIndex + visibleMembers.length;
  const previousPage = page - 1;
  const nextPage = page + 1;

  return (
    <div className="overflow-hidden border border-gold-dim bg-bg-panel rounded-sm">
      <ul aria-label="Guild roster members" className="divide-y divide-gold-dim xl:hidden">
        {visibleMembers.map((member, index) => {
          const classColor = getClassColor(member.className ?? member.characterName);

          return (
            <li
              key={member.id}
              className={getRevealClassName({ className: "px-4 py-4" })}
              style={getRevealStyle(index)}
            >
              <div className="flex items-start gap-3">
                <PlayerAvatar
                  name={member.characterName}
                  realmName={member.realm}
                  characterClass={member.className}
                  raceName={member.raceName}
                  guildName={member.guildName}
                  color={classColor}
                  fallbackIconUrl={getClassIconUrl(member.className)}
                  size="xs"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/players/${encodeURIComponent(member.characterName)}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold transition-colors hover:text-gold-light"
                    style={{ color: classColor }}
                  >
                    {member.characterName}
                  </Link>
                  <p className="text-sm text-text-secondary">
                    {member.className ?? "Unknown"} · {member.raceName ?? "Unknown"}
                    {member.level ? ` · Level ${member.level}` : ""}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-text-dim">Rank</dt>
                  <dd className="mt-1 text-sm text-text-primary">{member.rankName ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-text-dim">Gear Score</dt>
                  <dd className="mt-1 text-sm text-text-primary tabular-nums">
                    {member.gearScore ? member.gearScore.toLocaleString() : "-"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-text-dim">Professions</dt>
                  <dd className="mt-1 text-sm text-text-secondary">{formatProfessions(member.professionsJson)}</dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between gap-4 border-t border-gold-dim/70 pt-3">
                <dl>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-text-dim">Last Synced</dt>
                    <dd className="mt-1 text-sm text-text-secondary tabular-nums">{formatSyncedAt(member.lastSyncedAt)}</dd>
                  </div>
                </dl>
                <Link
                  href={`/players/${encodeURIComponent(member.characterName)}`}
                  className="inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-wide text-gold transition-colors hover:text-gold-light"
                >
                  View profile
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto xl:block">
        <table aria-label="Guild roster members" className="min-w-full text-sm">
          <thead className="bg-bg-card text-text-dim">
            <tr className="text-left text-xs uppercase tracking-widest">
              <th className="px-4 py-3 font-semibold">Character</th>
              <th className="px-4 py-3 font-semibold">Class</th>
              <th className="px-4 py-3 font-semibold">Race</th>
              <th className="px-4 py-3 font-semibold">Level</th>
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">GS</th>
              <th className="px-4 py-3 font-semibold">Professions</th>
              <th className="px-4 py-3 font-semibold">Guild</th>
              <th className="px-4 py-3 font-semibold">Realm</th>
              <th className="px-4 py-3 font-semibold">Last Synced</th>
              <th className="px-4 py-3 font-semibold text-right">Profile</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member, index) => {
              const classColor = getClassColor(member.className ?? member.characterName);

              return (
                <tr
                  key={member.id}
                  className={getRevealClassName({
                    className: "border-t border-gold-dim/70 hover:bg-bg-card/60 transition-colors",
                  })}
                  style={getRevealStyle(index)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        name={member.characterName}
                        realmName={member.realm}
                        characterClass={member.className}
                        raceName={member.raceName}
                        guildName={member.guildName}
                        color={classColor}
                        fallbackIconUrl={getClassIconUrl(member.className)}
                        size="xs"
                      />
                      <Link
                        href={`/players/${encodeURIComponent(member.characterName)}`}
                        className="inline-flex min-h-11 items-center font-semibold hover:text-gold-light transition-colors"
                        style={{ color: classColor }}
                      >
                        {member.characterName}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{member.className ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-text-secondary">{member.raceName ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-text-secondary tabular-nums">{member.level ?? "-"}</td>
                  <td className="px-4 py-3 text-text-secondary">{member.rankName ?? "-"}</td>
                  <td className="px-4 py-3 text-text-secondary tabular-nums">
                    {member.gearScore ? member.gearScore.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{formatProfessions(member.professionsJson)}</td>
                  <td className="px-4 py-3 text-text-secondary">{member.guildName}</td>
                  <td className="px-4 py-3 text-text-secondary">{member.realm}</td>
                  <td className="px-4 py-3 text-text-dim whitespace-nowrap">{formatSyncedAt(member.lastSyncedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/players/${encodeURIComponent(member.characterName)}`}
                      className="inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-wide text-gold hover:text-gold-light"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-gold-dim bg-bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-dim tabular-nums">
          {firstVisible}-{lastVisible} of {filteredMembers.length} members{query || classFilter ? " matching these filters" : ""}
        </p>
        <nav className="flex items-center justify-end gap-2" aria-label="Guild roster pages">
          <PageNavButton
            href={getPageHref(previousPage)}
            label="Previous roster page"
            disabled={page <= 1}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Previous</span>
          </PageNavButton>
          <span className="min-w-20 text-center text-xs text-text-secondary tabular-nums">
            Page {page} / {totalPages}
          </span>
          <PageNavButton
            href={getPageHref(nextPage)}
            label="Next roster page"
            disabled={page >= totalPages}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Next</span>
          </PageNavButton>
        </nav>
      </div>
    </div>
  );
}
