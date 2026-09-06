"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ShieldQuestion } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerClassMeta, normalizePlayerClass } from "@/lib/player-class";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { formatCountLabel } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

export type PlayerDirectoryEntry = {
  id: string;
  name: string;
  class: string | null;
  classSource?: "armory" | "roster" | "combat-log" | "unknown";
  realm: { name: string } | null;
  raceName?: string | null;
  guildName?: string | null;
  _count: { participants: number };
};

export function PlayerDirectoryClassIcon({ characterClass }: { characterClass: string }) {
  const meta = getPlayerClassMeta(characterClass);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-gold-dim bg-bg-deep" aria-hidden="true">
      {meta.iconUrl && meta.iconUrl !== failedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Known Warmane class icon; the swatch fallback preserves its identity if the CDN is unavailable.
        <img src={meta.iconUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(meta.iconUrl)} />
      ) : (
        <ShieldQuestion size={16} style={{ color: meta.color }} />
      )}
    </span>
  );
}

export function PlayerDirectoryRow({
  player,
  index = 0,
  includeShortPulls = false,
  onIdentityChange,
}: {
  player: PlayerDirectoryEntry;
  index?: number;
  includeShortPulls?: boolean;
  onIdentityChange?: () => void;
}) {
  const serverClass = normalizePlayerClass(player.class);
  const [correction, setCorrection] = useState<{ serverClass: typeof serverClass; className: typeof serverClass } | null>(null);
  const lastCorrection = useRef<string | null>(null);
  // Keep the same row and focused Avatar while refreshed server props confirm
  // a correction. A later server identity supersedes only an older override.
  const hasCurrentCorrection = correction?.serverClass === serverClass;
  const meta = getPlayerClassMeta(hasCurrentCorrection ? correction?.className : serverClass);
  const realm = player.realm?.name ?? "Lordaeron";
  const source = !meta.className ? "Class not yet known"
    : hasCurrentCorrection || player.classSource === "armory" || player.classSource === "roster"
    ? "Armory class"
    : "Combat-log class";
  const profileParams = new URLSearchParams({ realm });
  if (includeShortPulls) profileParams.set("includeShortPulls", "1");
  const profileHref = `/players/${encodeURIComponent(player.name)}?${profileParams}`;
  const armoryHref = `https://armory.warmane.com/character/${encodeURIComponent(player.name)}/${encodeURIComponent(realm)}/summary`;

  const handleClassResolved = useCallback((className: string | null) => {
    const canonicalClass = normalizePlayerClass(className);
    // The Avatar emits null only for a validated, authoritative Unknown result;
    // invalid or unavailable upstream evidence never emits a correction.
    if (className !== null && !canonicalClass) return;
    setCorrection({ serverClass, className: canonicalClass });
    const correctionKey = `${serverClass}:${canonicalClass}`;
    if (canonicalClass !== serverClass && lastCorrection.current !== correctionKey) {
      lastCorrection.current = correctionKey;
      onIdentityChange?.();
    }
  }, [onIdentityChange, serverClass]);

  return (
    <li
      className={getRevealClassName({ className: "group min-w-0 border-b border-gold-dim px-1 py-4 transition-colors hover:bg-bg-panel/55 sm:px-2" })}
      style={getRevealStyle(index)}
      data-player-class={meta.className ?? "Unknown"}
      data-player-row={player.name}
      data-player-realm={realm}
    >
      <div className="flex items-start gap-3">
        <PlayerAvatar
          name={player.name}
          realmName={realm}
          characterClass={meta.className}
          raceName={player.raceName}
          guildName={player.guildName}
          color={meta.color}
          fallbackIconUrl={meta.iconUrl}
          size="sm"
          className="mt-1"
          onClassResolved={handleClassResolved}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href={profileHref}
              className="flex min-h-11 min-w-0 flex-1 items-center rounded-xs text-xl font-bold hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              style={{ color: meta.textColor }}
            >
              <span className="truncate">{player.name}</span>
            </Link>
            <a
              href={armoryHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${player.name} on ${realm} in Warmane Armory (opens in a new tab)`}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xs text-text-secondary hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
              {meta.className ?? "Unknown class"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{realm}</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
            <span className="tabular-nums">{formatCountLabel(player._count.participants, "pull")}</span>
            <span aria-hidden="true">·</span>
            <span>{source}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

function DirectoryRefresh({ revision }: { revision: number }) {
  const router = useRouter();
  const refreshedRevision = useRef(0);
  useEffect(() => {
    if (refreshedRevision.current === revision) return;
    refreshedRevision.current = revision;
    router.refresh();
  }, [revision, router]);
  return null;
}

export function PlayerDirectory({ players, includeShortPulls }: {
  players: PlayerDirectoryEntry[];
  includeShortPulls: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const refreshIdentity = useCallback(() => setRevision(value => value + 1), []);

  return (
    <>
      <ul aria-label="Players" className="grid list-none gap-x-6 border-t border-gold-dim sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player, index) => (
          <PlayerDirectoryRow
            key={`${player.id}:${player.realm?.name ?? "Lordaeron"}`}
            player={player}
            index={index}
            includeShortPulls={includeShortPulls}
            onIdentityChange={refreshIdentity}
          />
        ))}
      </ul>
      {/* Mount only after a browser interaction; the static directory needs no router context. */}
      {revision > 0 && <DirectoryRefresh revision={revision} />}
    </>
  );
}
