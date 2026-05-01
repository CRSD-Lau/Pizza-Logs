import Link from "next/link";
import { getClassColor } from "../../lib/constants/classes";

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
  armoryUrl: string;
  gearSnapshotJson: unknown | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function formatSyncedAt(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function GuildRosterTable({ members }: { members: GuildRosterTableMember[] }) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="heading-cinzel text-base text-text-secondary mb-2">No guild roster data yet</p>
        <p className="text-sm text-text-dim max-w-xs">
          Use the roster sync endpoint to import PizzaWarriors members from Warmane.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gold-dim bg-bg-panel rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-bg-card text-text-dim">
          <tr className="text-left text-[11px] uppercase tracking-widest">
            <th className="px-4 py-3 font-semibold">Character</th>
            <th className="px-4 py-3 font-semibold">Class</th>
            <th className="px-4 py-3 font-semibold">Race</th>
            <th className="px-4 py-3 font-semibold">Level</th>
            <th className="px-4 py-3 font-semibold">Rank</th>
            <th className="px-4 py-3 font-semibold">Guild</th>
            <th className="px-4 py-3 font-semibold">Realm</th>
            <th className="px-4 py-3 font-semibold">Last Synced</th>
            <th className="px-4 py-3 font-semibold text-right">Profile</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const classColor = getClassColor(member.className ?? member.characterName);

            return (
              <tr key={member.id} className="border-t border-gold-dim/70 hover:bg-bg-card/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-xs font-bold"
                      style={{ background: `${classColor}22`, color: classColor, border: `1px solid ${classColor}44` }}
                    >
                      {member.characterName.slice(0, 2).toUpperCase()}
                    </div>
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
  );
}
