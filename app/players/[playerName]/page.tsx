import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerProfileIdentity } from "@/components/players/PlayerProfileIdentity";
import { PlayerRaidComparisonSection, PlayerRaidComparisonSkeleton } from "@/components/players/PlayerRaidComparisonSection";
import { PlayerGearSection, PlayerGearSectionSkeleton } from "@/components/players/PlayerGearSection";
import { getWarmaneCharacterGear } from "@/lib/warmane-armory";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM } from "@/lib/warmane-guild-roster";
import { buildPlayerPerBossSummary, buildPlayerRecentEncounters, resolvePlayerProfile } from "@/lib/player-profile";
import { formatDps, formatCountLabel, formatDateUtc, formatDateTimeUtc, formatInteger } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { getStoredPlayerIdentity } from "@/lib/player-directory";
import { DEFAULT_PLAYER_REALM } from "@/lib/player-identity";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { cn } from "@/lib/utils";
import { buildPageMetadata } from "@/lib/page-metadata";
import { countAttempts, isShortPull, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { SectionNav } from "@/components/ui/SectionNav";
import { reportQueryString } from "@/lib/difficulty-filter";

interface Props {
  params: Promise<{ playerName: string }>;
  searchParams: Promise<{
    includeShortPulls?: string | string[];
    realm?: string | string[];
    comparisonRaid?: string | string[];
    comparisonDifficulty?: string | string[];
    comparisonMetric?: string | string[];
  }>;
}

async function PlayerGear({ name, realm, playerClass }: { name: string; realm?: string; playerClass?: string | null }) {
  const result = await getWarmaneCharacterGear(name, realm ?? "Lordaeron");
  return <PlayerGearSection result={result} playerClass={playerClass} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { playerName } = await params;
  const name = playerName;
  return buildPageMetadata({
    title: name,
    description: `${name}'s WotLK raid history, damage and healing records, and latest saved Warmane gear.`,
    path: `/players/${encodeURIComponent(name)}`,
  });
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { playerName } = await params;
  const name = playerName;
  const search = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(search.includeShortPulls);
  const rawRealm = Array.isArray(search.realm) ? search.realm[0] : search.realm;
  const requestedRealm = rawRealm?.trim();
  if (requestedRealm && !/^[A-Za-z]{2,24}$/.test(requestedRealm)) notFound();
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";

  const player = await db.player.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(requestedRealm ? {
        OR: [
          { realm: { is: { name: { equals: requestedRealm, mode: "insensitive" } } } },
          ...(requestedRealm.toLowerCase() === DEFAULT_PLAYER_REALM.toLowerCase() ? [{ realmId: null }] : []),
        ],
      } : {}),
    },
    orderBy: [{ realm: { name: "asc" } }, { id: "asc" }],
    include: {
      realm: { select: { name: true } },
      milestones: {
        where:   { supersededAt: null, type: "ALL_TIME_RANK" },
        orderBy: [{ rank: "asc" }, { metric: "asc" }],
        include: {
          encounter: { include: { boss: { select: { name: true, slug: true } } } },
        },
      },
    },
  });

  const rosterMember = await db.guildRosterMember.findFirst({
    where: {
      normalizedCharacterName: name.toLowerCase(),
      guildName: DEFAULT_GUILD_NAME,
      realm: { equals: player?.realm?.name ?? requestedRealm ?? DEFAULT_GUILD_REALM, mode: "insensitive" },
    },
    select: {
      characterName: true,
      realm: true,
      guildName: true,
      className: true,
      raceName: true,
      level: true,
      rankName: true,
    },
  });

  const profile = resolvePlayerProfile({ player, rosterMember });
  if (!profile) notFound();
  const identity = await getStoredPlayerIdentity(profile.name, profile.realmName, profile.className);
  profile.className = identity.className;
  profile.raceName = identity.raceName ?? profile.raceName;
  profile.guildName = identity.guildName ?? profile.guildName;

  const participants = player
    ? await db.participant.findMany({
      where: { playerId: player.id },
      orderBy: { encounter: { startedAt: "desc" } },
      take: 50,
      include: {
        encounter: {
          include: {
            boss: { select: { name: true, slug: true, raid: true } },
            participants: { select: { deaths: true } },
          },
        },
      },
    })
    : [];

  // Retain the original latest-50 window for performance calculations. The
  // count/list policy uses every raid participant's death evidence.
  const counts = countAttempts(participants.map(p => p.encounter), { includeShortPulls });
  const visibleParticipants = participants.filter(p => includeShortPulls || !isShortPull(p.encounter));

  const kills       = participants.filter(p => p.encounter.outcome === "KILL");
  const avgDps      = kills.length > 0
    ? kills.reduce((a, p) => a + p.dps, 0) / kills.length : null;
  const bestDps     = participants.length > 0 ? Math.max(0, ...participants.map(p => p.dps)) : null;
  const bestAps     = participants.length > 0 ? Math.max(0, ...participants.map(p => p.aps)) : null;
  const latestSpec  = participants.find((participant) => participant.spec)?.spec ?? null;

  const milestones = player?.milestones ?? [];

  const perBoss = buildPlayerPerBossSummary(participants);
  const recentEncounters = buildPlayerRecentEncounters(visibleParticipants, 50);

  return (
    <div className="page-shell">
      <Link href={`/players${querySuffix}`} className="inline-flex min-h-11 items-center text-sm text-text-dim hover:text-gold">
        Players
      </Link>
      <PlayerProfileIdentity key={`${profile.name}@${profile.realmName}`} profile={{
        name: profile.name, realmName: profile.realmName, className: profile.className,
        raceName: profile.raceName, guildName: profile.guildName, level: profile.level,
        rankName: profile.rankName, isRosterOnly: profile.isRosterOnly,
      }} latestSpec={latestSpec} />

      <SectionNav items={[
        { id: "raid-progress", label: "Raid progress" },
        { id: "gear", label: "Gear" },
        ...(milestones.length > 0 ? [{ id: "achievements", label: "Achievements" }] : []),
        ...(perBoss.length > 0 ? [{ id: "boss-summary", label: "Boss summary" }] : []),
        { id: "recent-encounters", label: "Recent encounters" },
      ]} />

      {/* Stats */}
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Performance summary and per-boss bests use the latest 50 recorded encounters. Ranked achievements below are historical records.</p>
        <StatGroup columns={4}>
          <StatCard label="Encounters" value={formatInteger(counts.totalPulls)} sub={<><span className="text-text-primary">{formatCountLabel(kills.length, "kill")}</span> · latest 50 recorded</>} />
          <StatCard label="Best DPS" value={<NumericValue value={bestDps} kind="rate" />} sub={participants.length ? "single encounter" : "No recorded attempts"} />
          <StatCard label="Avg DPS" value={<NumericValue value={avgDps} kind="rate" />} sub={kills.length ? "on kills" : "No boss kills"} />
          <StatCard label="Best APS" value={<NumericValue value={bestAps} kind="rate" />} sub={participants.length ? "single encounter" : "No recorded attempts"} />
        </StatGroup>
      </div>

      <Suspense fallback={<PlayerRaidComparisonSkeleton />}>
        <PlayerRaidComparisonSection playerId={player?.id} playerName={profile.name} search={search} />
      </Suspense>

      {/* Gear */}
      <Suspense fallback={<PlayerGearSectionSkeleton />}>
        <PlayerGear name={profile.name} realm={profile.realmName} playerClass={profile.className} />
      </Suspense>

      {/* Milestones */}
      {milestones.length > 0 && (
        <AccordionSection id="achievements" title="Ranked Achievements" sub="Historical all-time ranks when achieved, not current standings. Boss kills only." count={milestones.length} defaultOpen>
          <div className="grid sm:grid-cols-2 gap-2">
            {milestones.map((m, index) => (
              <div
                key={m.id}
                className={getRevealClassName({
                  className: "milestone-banner flex flex-col gap-3 text-sm",
                })}
                style={getRevealStyle(index)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-text-secondary">Rank when achieved: <strong className="text-gold-light">#{formatInteger(m.rank)}</strong></p>
                  <span className="tabular-nums font-bold text-text-primary">
                    {formatDps(m.value)} {m.metric}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/bosses/${m.encounter.boss.slug}${querySuffix}`} className="inline-flex min-h-11 items-center font-semibold text-text-primary hover:text-gold">
                      {m.encounter.boss.name}
                    </Link>
                    <span className={cn(
                      "ml-1 diff-badge",
                      m.difficulty?.endsWith("H") ? "heroic" : "normal"
                    )}>
                      {m.difficulty}
                    </span>
                  </div>
                  <p className="text-text-secondary">Recorded <time dateTime={m.achievedAt.toISOString()}>{formatDateUtc(m.achievedAt)}</time></p>
                  <Link href={`/bosses/${m.encounter.boss.slug}${reportQueryString({ difficulty: m.difficulty ?? "UNKNOWN", includeShortPulls: includeShortPulls ? "1" : undefined })}#boss-${m.metric === "HPS" ? "hps" : "dps"}`} className="mt-1 inline-flex min-h-11 items-center text-gold hover:text-gold-light">View current rankings →</Link>
                </div>
              </div>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Per-boss bests */}
      {perBoss.length > 0 && (
        <AccordionSection id="boss-summary" title="Per-Boss Summary" sub="Best values within the latest 50 recorded encounters" count={perBoss.length} defaultOpen>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {perBoss.map((b, index) => (
              <Link
                key={b.bossSlug}
                href={`/bosses/${b.bossSlug}${querySuffix}`}
                className={getRevealClassName({
                  boss: true,
                  className: "bg-bg-card border border-gold-dim rounded-sm px-4 py-3 hover:border-gold/40 transition-colors block",
                })}
                style={getRevealStyle(index)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-text-primary">{b.bossName}</span>
                  <span className="text-xs text-success font-bold">{formatCountLabel(b.kills, "kill")}</span>
                </div>
                <div className="text-xs text-text-secondary">
                  Best DPS: <NumericValue value={b.bestDps} kind="rate" className="font-bold text-text-primary" />
                </div>
                <div className="text-xs text-text-secondary">
                  Best HPS: <NumericValue value={b.bestHps} kind="rate" className="font-bold text-text-primary" />
                </div>
              </Link>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Recent encounters */}
      <AccordionSection id="recent-encounters" title="Recent Encounters" sub="Latest 50 recorded encounters, newest first · UTC" count={recentEncounters.length} defaultOpen={false}>
        {visibleParticipants.length > 0 ? (
          <ul aria-label="Recent encounters, newest first" className="list-none bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {recentEncounters.map((p, index) => (
              <li key={p.id}>
              <Link
                href={`/encounters/${p.encounter.id}${querySuffix}`}
                className={getRevealClassName({
                  boss: true,
                  className: "flex flex-col gap-3 px-4 py-3 hover:bg-bg-hover transition-colors lg:flex-row lg:items-center lg:justify-between",
                })}
                style={getRevealStyle(index)}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className={p.encounter.outcome === "KILL" ? "outcome-kill" : p.encounter.outcome === "WIPE" ? "outcome-wipe" : "outcome-unknown"}>
                    {p.encounter.outcome}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{p.encounter.boss.name}</span>
                  <span className={cn("diff-badge", p.encounter.difficulty.endsWith("H") ? "heroic" : "normal")}>
                    {p.encounter.difficulty}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums text-text-secondary">
                  <span><NumericValue value={p.dps} kind="rate" /> DPS</span>
                  <span><NumericValue value={p.hps} kind="rate" /> HPS</span>
                  <span><NumericValue value={p.aps} kind="rate" /> APS</span>
                  {p.deaths > 0 && <span className="text-danger">{formatCountLabel(p.deaths, "death")}</span>}
                  <time dateTime={p.encounter.startedAt.toISOString()}>{formatDateTimeUtc(p.encounter.startedAt)}</time>
                </div>
              </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={counts.shortPulls > 0 ? "No counted encounters" : "No encounters recorded"} />
        )}
      </AccordionSection>
    </div>
  );
}
