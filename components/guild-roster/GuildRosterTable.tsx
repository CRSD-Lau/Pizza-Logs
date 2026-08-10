import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { getClassColor } from "../../lib/constants/classes";
import { getRevealClassName, getRevealStyle } from "../../lib/ui-animation";
import { getClassIconUrl } from "../../lib/class-icons";

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

function getPageHref(page: number): string {
  return page <= 1 ? "/guild-roster" : `/guild-roster?page=${page}`;
}

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), totalPages);
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
    "inline-flex h-8 w-8 items-center justify-center rounded-xs border border-gold-dim text-text-secondary transition-colors";

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-not-allowed opacity-40`}
        title={label}
      >
        {children}
      </span>
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

export function GuildRosterTable({ members, currentPage = 1 }: GuildRosterTableProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="heading-cinzel text-base text-text-secondary mb-2">No guild roster data yet</p>
        <p className="text-sm text-text-dim max-w-xs">
          Use Admin Guild Roster Sync to import PizzaWarriors members from Warmane.
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(members.length / GUILD_ROSTER_PAGE_SIZE));
  const page = clampPage(currentPage, totalPages);
  const startIndex = (page - 1) * GUILD_ROSTER_PAGE_SIZE;
  const visibleMembers = members.slice(startIndex, startIndex + GUILD_ROSTER_PAGE_SIZE);
  const firstVisible = startIndex + 1;
  const lastVisible = startIndex + visibleMembers.length;
  const previousPage = page - 1;
  const nextPage = page + 1;

  return (
    <div className="overflow-hidden border border-gold-dim bg-bg-panel rounded-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-card text-text-dim">
            <tr className="text-left text-[11px] uppercase tracking-widest">
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
                        className="font-semibold hover:text-gold-light transition-colors"
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
                      className="text-xs font-semibold uppercase tracking-wide text-gold hover:text-gold-light"
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
          {firstVisible}-{lastVisible} of {members.length} members
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
