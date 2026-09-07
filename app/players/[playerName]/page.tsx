import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui/PageLoading";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlayerProfileIdentity } from "@/components/players/PlayerProfileIdentity";
import { PlayerMetricControls } from "@/components/players/PlayerMetricControls";
import { PlayerRaidComparisonSection, PlayerRaidComparisonSkeleton } from "@/components/players/PlayerRaidComparisonSection";
import { PlayerGearSection, PlayerGearSectionSkeleton } from "@/components/players/PlayerGearSection";
import { getWarmaneCharacterGear } from "@/lib/warmane-armory";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM } from "@/lib/warmane-guild-roster";
import { buildPlayerPerformanceSummary, buildPlayerPerBossSummary, buildPlayerRecentEncounters, resolvePlayerProfile, type PlayerPerformanceSummary } from "@/lib/player-profile";
import { getReportDamageTakenPerSecond, getReportMetricView, getReportRoleLabel, parseShowAllMetrics, type ReportMetricView } from "@/lib/report-metric-view";
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
    metrics?: string | string[];
  }>;
}

async function PlayerGear({ name, realm, playerClass }: { name: string; realm?: string; playerClass?: string | null }) {
  const result = await getWarmaneCharacterGear(name, realm ?? "Lordaeron");
  return <PlayerGearSection result={result} playerClass={playerClass} />;
}

function PerformanceStats({ summary, view, hasAttempts, hasKills }: {
  summary: PlayerPerformanceSummary;
  view: ReportMetricView;
  hasAttempts: boolean;
  hasKills: boolean;
}) {
  const bestScope = hasAttempts ? "single encounter" : "No recorded attempts";
  const killScope = hasKills ? "on kills" : "No boss kills";
  const damage = <StatCard key="damage" label="Damage" value={<NumericValue value={summary.totalDamage} kind="number" />}
    sub={view === "tank" ? <>Best DPS: <NumericValue value={summary.bestDps} kind="rate" /> · {bestScope}</> : "latest 50 recorded encounters"} />;
  const bestDps = <StatCard key="best-dps" label="Best DPS" value={<NumericValue value={summary.bestDps} kind="rate" />} sub={bestScope} />;
  const avgDps = <StatCard key="avg-dps" label="Avg DPS" value={<NumericValue value={summary.avgDps} kind="rate" />} sub={killScope} />;
  const healing = <StatCard key="healing" label="Effective healing" value={<NumericValue value={summary.totalHealing} kind="number" />} sub={<>Best HPS: <NumericValue value={summary.bestHps} kind="rate" /> · {bestScope}<br />Avg HPS: <NumericValue value={summary.avgHps} kind="rate" /> · {killScope}</>} />;
  const absorbs = <StatCard key="absorbs" label="Absorbs" value={<NumericValue value={summary.totalAbsorbs} kind="number" />} sub={<>Best APS: <NumericValue value={summary.bestAps} kind="rate" /> · {bestScope}</>} />;
  const combined = <StatCard key="combined" label="Healing + absorbs" value={<NumericValue value={summary.totalHealingAbsorbs} kind="number" />} sub={<>Best Healing + absorbs /s: <NumericValue value={summary.bestHealingAbsorbsPerSecond} kind="rate" /> · {bestScope}</>} />;
  const taken = <StatCard key="taken" label="Damage taken" value={<NumericValue value={summary.damageTaken} kind="number" />} sub={<><NumericValue value={summary.damageTakenPerSecond} kind="rate" /> DTPS · {summary.damageTakenPerSecond === null ? "Valid duration required for every recorded encounter" : "total / recorded fight time"}</>} />;
  const deaths = <StatCard key="deaths" label="Deaths" value={<NumericValue value={summary.deaths} kind="integer" />} sub={hasAttempts ? "latest 50 recorded encounters" : "No recorded attempts"} />;
  const cards = view === "damage" ? [damage, bestDps, avgDps, deaths]
    : view === "healing" ? [healing, absorbs, combined, deaths]
      : view === "tank" ? [taken, deaths, damage, avgDps]
        : [damage, bestDps, avgDps, healing, absorbs, combined, taken, deaths];
  return <StatGroup columns={4}>{cards}</StatGroup>;
}

function BossMetricSummary({ summary, view }: { summary: PlayerPerformanceSummary; view: ReportMetricView }) {
  const damage = <div key="damage">Damage: <NumericValue value={summary.totalDamage} kind="number" /> · Best DPS: <NumericValue value={summary.bestDps} kind="rate" /></div>;
  const healing = <div key="healing">Effective healing: <NumericValue value={summary.totalHealing} kind="number" /> · Best HPS: <NumericValue value={summary.bestHps} kind="rate" /></div>;
  const absorbs = <div key="absorbs">Absorbs: <NumericValue value={summary.totalAbsorbs} kind="number" /> · Best APS: <NumericValue value={summary.bestAps} kind="rate" /></div>;
  const combined = <div key="combined">Healing + absorbs: <NumericValue value={summary.totalHealingAbsorbs} kind="number" /> · Best Healing + absorbs /s: <NumericValue value={summary.bestHealingAbsorbsPerSecond} kind="rate" /></div>;
  const taken = <div key="taken">Damage taken: <NumericValue value={summary.damageTaken} kind="number" /> · <NumericValue value={summary.damageTakenPerSecond} kind="rate" /> DTPS{summary.damageTakenPerSecond === null && <span> · valid duration required for every encounter</span>}</div>;
  const fields = view === "damage" ? [damage] : view === "healing" ? [healing, absorbs, combined] : view === "tank" ? [taken, damage] : [damage, healing, absorbs, combined, taken];
  return <div className="space-y-1 text-sm tabular-nums text-text-secondary">{fields}<div>{summary.deaths === null ? <><NumericValue value={null} /> deaths</> : formatCountLabel(summary.deaths, "death")}</div></div>;
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

async function getPlayerPageContext({ params, searchParams }: Props) {
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
  return { profile, player, includeShortPulls, querySuffix, search };
}

export default async function PlayerPage(props: Props) {
  const data = await getPlayerPageContext(props);
  return (
    <Suspense fallback={<PageLoading message="Loading player..." />}>
      <PlayerContent data={data} />
    </Suspense>
  );
}

async function PlayerContent({ data }: { data: Awaited<ReturnType<typeof getPlayerPageContext>> }) {
  const { player, includeShortPulls, querySuffix, search } = data;
  const profile = { ...data.profile };
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
  const summary = buildPlayerPerformanceSummary(participants);
  const showAll = parseShowAllMetrics(search.metrics);
  const metricView = showAll ? "all" : summary.metricView;
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
      <section aria-label="Player performance summary" className="space-y-3">
        <p className="text-sm text-text-secondary">Performance summary and per-boss bests use the latest 50 recorded encounters. Ranked achievements below are historical records.</p>
        <p className="text-sm text-text-secondary">{formatCountLabel(counts.totalPulls, "encounter")} · <span className="text-text-primary">{formatCountLabel(kills.length, "kill")}</span> · latest 50 recorded</p>
        <PlayerMetricControls showAll={showAll} defaultView={summary.metricView} />
        <PerformanceStats summary={summary} view={metricView} hasAttempts={participants.length > 0} hasKills={kills.length > 0} />
      </section>

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
        <AccordionSection id="boss-summary" title="Per-Boss Summary" sub="Totals and best output rates within the latest 50 recorded encounters · DTPS is total damage taken / recorded fight time, not a performance rank" count={perBoss.length} defaultOpen>
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
                <p className="mb-2 text-sm text-text-secondary">Recorded roles: {b.roles.join(", ")} · Specs: {b.specs.length ? b.specs.join(", ") : "Unknown"}</p>
                <BossMetricSummary summary={b} view={showAll ? "all" : b.metricView} />
              </Link>
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Recent encounters */}
      <AccordionSection id="recent-encounters" title="Recent Encounters" sub="Latest 50 recorded encounters, newest first · UTC" count={recentEncounters.length} defaultOpen={false}>
        {visibleParticipants.length > 0 ? (
          <ul aria-label="Recent encounters, newest first" className="list-none bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim">
            {recentEncounters.map((p, index) => {
              const view = showAll ? "all" : getReportMetricView([p]);
              const showDamage = view !== "healing";
              const showHealing = view === "healing" || view === "all";
              const showTaken = view === "tank" || view === "all";
              const dtps = getReportDamageTakenPerSecond(p.damageTaken, p.encounter);
              return (
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
                  <span className="text-sm text-text-secondary">Recorded role: {getReportRoleLabel(p)} · Spec: {p.spec || "Unknown"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums text-text-secondary">
                  {showTaken && <span>Damage taken: <NumericValue value={p.damageTaken} kind="number" /> · <NumericValue value={dtps} kind="rate" /> DTPS{dtps === null && " · valid duration required"}</span>}
                  {showDamage && <span>Damage: <NumericValue value={p.totalDamage} kind="number" /> · <NumericValue value={p.dps} kind="rate" /> DPS</span>}
                  {showHealing && <>
                    <span>Effective healing: <NumericValue value={p.totalHealing} kind="number" /> · <NumericValue value={p.hps} kind="rate" /> HPS</span>
                    <span>Absorbs: <NumericValue value={p.totalAbsorbs} kind="number" /> · <NumericValue value={p.aps} kind="rate" /> APS</span>
                    <span>Healing + absorbs: <NumericValue value={p.totalHealing + p.totalAbsorbs} kind="number" /> · <NumericValue value={p.hps + p.aps} kind="rate" /> Healing + absorbs /s</span>
                  </>}
                  <span className={p.deaths > 0 ? "text-danger" : undefined}>{formatCountLabel(p.deaths, "death")}</span>
                  <time dateTime={p.encounter.startedAt.toISOString()}>{formatDateTimeUtc(p.encounter.startedAt)}</time>
                </div>
              </Link>
              </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={counts.shortPulls > 0 ? "No counted encounters" : "No encounters recorded"} />
        )}
      </AccordionSection>
    </div>
  );
}
