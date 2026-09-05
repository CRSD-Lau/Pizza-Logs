import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { SessionLineChart } from "@/components/charts/SessionLineChart";
import type { ChartPoint, PlayerLine } from "@/components/charts/SessionLineChart";
import { StatCard } from "@/components/ui/StatCard";
import { getClassColor } from "@/lib/constants/classes";
import { getClassIconUrl } from "@/lib/class-icons";
import {
  formatRaidDateLabel,
  formatRaidSessionTitle,
  getRaidSessionPath,
} from "@/lib/raid-session-slug";
import { resolveRaidSession } from "@/lib/raid-session-routing.server";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";
import { buildPageMetadata } from "@/lib/page-metadata";
import { getRevealClassName, getRevealStyle, orderBossDisplayEntries } from "@/lib/ui-animation";
import { buildSessionPlayerMetricChart } from "@/lib/session-player-chart";
import { cn, formatDps, formatDuration } from "@/lib/utils";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { countAttempts, isShortPull, parseIncludeShortPulls } from "@/lib/attempt-policy";

interface Props {
  params: Promise<{ id: string; sessionIdx: string; playerName: string }>;
  searchParams: Promise<{ includeShortPulls?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, playerName, sessionIdx } = await params;
  const name = playerName;
  const resolution = await resolveRaidSession(id, sessionIdx);
  if (!resolution) return { title: name };

  const raidTitle = formatRaidSessionTitle(resolution.route);
  const title = `${name} - ${raidTitle}`;
  const description = `${name}'s performance across the ${formatRaidDateLabel(resolution.route.startedAt)} raid.`;
  const canonicalPath = `${getRaidSessionPath(resolution.publicSlug, resolution.route)}/players/${encodeURIComponent(name)}`;
  const canonical = `${PIZZA_LOGS_ORIGIN}${canonicalPath}`;

  return buildPageMetadata({ title, description, path: canonical, type: "article" });
}

export default async function SessionPlayerPage({ params, searchParams }: Props) {
  const { id, sessionIdx, playerName } = await params;
  const includeShortPulls = parseIncludeShortPulls((await searchParams).includeShortPulls);
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";
  const name = playerName;
  const resolution = await resolveRaidSession(id, sessionIdx);

  if (!resolution) notFound();

  const { route: sessionRoute, uploadId, publicSlug } = resolution;
  const sessionPath = getRaidSessionPath(publicSlug, sessionRoute);
  if (resolution.isLegacyUploadId || resolution.isLegacyIndex) {
    permanentRedirect(`${sessionPath}/players/${encodeURIComponent(name)}${querySuffix}`);
  }

  const sessionIndex = sessionRoute.sessionIndex;

  const encounters = await db.encounter.findMany({
    where: { uploadId, sessionIndex },
    orderBy: { startedAt: "asc" },
    include: {
      boss: { select: { name: true, slug: true, raid: true } },
      participants: {
        include: { player: { select: { id: true, name: true, class: true } } },
      },
    },
  });

  if (encounters.length === 0) notFound();

  const orderedEncounters = orderBossDisplayEntries(
    encounters,
    enc => enc.boss.name,
    enc => enc.startedAt,
  );

  const firstParticipation = encounters
    .flatMap(e => e.participants)
    .find(p => p.player.name === name);
  if (!firstParticipation) notFound();

  const playerClass = firstParticipation.player.class ?? null;
  const classColor = getClassColor(playerClass ?? name);
  const upload = await db.upload.findUnique({
    where: { id: uploadId },
    select: {
      realm: { select: { name: true } },
      guild: { select: { name: true } },
    },
  });
  const realmName = upload?.realm?.name ?? "Lordaeron";
  const rosterMember = await db.guildRosterMember.findFirst({
    where: {
      normalizedCharacterName: name.toLowerCase(),
      realm: realmName,
    },
    select: {
      raceName: true,
      guildName: true,
      className: true,
    },
  });

  const myStats = orderedEncounters
    .map((enc) => {
      const p = enc.participants.find(part => part.player.name === name);
      if (!p) return null;
      return {
        encounterId: enc.id,
        bossName: enc.boss.name,
        bossSlug: enc.boss.slug,
        outcome: enc.outcome,
        difficulty: enc.difficulty,
        duration: enc.durationSeconds,
        dps: p.dps,
        hps: p.hps,
        aps: p.aps,
        totalDamage: p.totalDamage,
        totalHealing: p.totalHealing,
        totalAbsorbs: p.totalAbsorbs,
        spec: p.spec,
        deaths: p.deaths,
        critPct: p.critPct,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (myStats.length === 0) notFound();

  const playerEncounters = orderedEncounters.filter(encounter => encounter.participants.some(p => p.player.name === name));
  const counts = countAttempts(playerEncounters, { includeShortPulls });
  const shortPullIds = new Set(playerEncounters.filter(isShortPull).map(encounter => encounter.id));
  const visibleStats = myStats.filter(entry => includeShortPulls || !shortPullIds.has(entry.encounterId));

  const kills = myStats.filter(e => e.outcome === "KILL");
  const bestDps = Math.max(0, ...myStats.map(e => e.dps));
  const bestHps = Math.max(0, ...myStats.map(e => e.hps));
  const bestAps = Math.max(0, ...myStats.map(e => e.aps));
  const bestHealAndAbsorbPs = Math.max(0, ...myStats.map(e => e.hps + e.aps));
  const latestSpec = myStats.find((entry) => entry.spec)?.spec ?? null;
  const totalDeaths = myStats.reduce((sum, e) => sum + e.deaths, 0);

  const isHealer = bestHps > bestDps * 0.7 && bestHps > 200;
  const metric: "DPS" | "HPS" = isHealer ? "HPS" : "DPS";

  const avgKillMetric = kills.length > 0
    ? kills.reduce((sum, e) => sum + (metric === "DPS" ? e.dps : e.hps), 0) / kills.length
    : 0;
  const bestMetric = metric === "DPS" ? bestDps : bestHps;

  const classmateNames = new Set<string>();
  for (const enc of encounters) {
    for (const p of enc.participants) {
      if (p.player.name !== name && p.player.class === playerClass && playerClass !== null) {
        classmateNames.add(p.player.name);
      }
    }
  }

  const allPlayers = [name, ...Array.from(classmateNames)];

  const chartData: ChartPoint[] = buildSessionPlayerMetricChart({
    encounters: orderedEncounters,
    playerNames: allPlayers,
    metric,
  });

  const chartPlayers: PlayerLine[] = allPlayers.map((pName) => ({
    name: pName,
    isSubject: pName === name,
    color: pName === name ? "var(--color-gold-light)" : classColor,
  }));

  const sessionLabel = formatRaidSessionTitle(sessionRoute);
  const sessionDate = formatRaidDateLabel(sessionRoute.startedAt);

  return (
    <div className="page-shell">
      <div className="text-xs text-text-dim flex items-center gap-1 flex-wrap">
        <Link href={`/raids${querySuffix}`} className="hover:text-gold">Raids</Link>
        <span>&gt;</span>
        <Link href={`${sessionPath}${querySuffix}`} className="hover:text-gold">
          {sessionLabel}
        </Link>
        <span>&gt;</span>
        <span className="text-text-secondary">{name}</span>
      </div>

      <div className="flex items-center gap-4">
        <PlayerAvatar
          name={name}
          realmName={realmName}
          characterClass={playerClass ?? rosterMember?.className}
          raceName={rosterMember?.raceName}
          guildName={rosterMember?.guildName ?? upload?.guild?.name}
          color={classColor}
          fallbackIconUrl={getClassIconUrl(playerClass ?? rosterMember?.className)}
          size="lg"
        />
        <div>
          <h1 className="heading-cinzel text-2xl font-bold" style={{ color: classColor }}>
            {name}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
            {playerClass && <span className="text-text-secondary">{playerClass}</span>}
            {latestSpec && <span className="text-gold">{latestSpec}</span>}
            <span className="text-text-dim">-</span>
            <span className="text-text-dim">{sessionDate}</span>
          </div>
        </div>
      </div>

      <ShortPullNotice shortPulls={counts.shortPulls} includeShortPulls={includeShortPulls} basePath={`${sessionPath}/players/${encodeURIComponent(name)}`} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Pulls" value={counts.totalPulls} />
        <StatCard label="Kills" value={kills.length} highlight />
        <StatCard label={`Best ${metric}`} value={formatDps(bestMetric)} sub="single pull" />
        <StatCard label={`Avg ${metric}`} value={formatDps(avgKillMetric)} sub="on kills" />
        <StatCard label="Best APS" value={formatDps(bestAps)} sub="single pull" />
        <StatCard label="Best H+A PS" value={formatDps(bestHealAndAbsorbPs)} sub="single pull" />
      </div>

      {chartData.length > 1 && (
        <AccordionSection
          title={`${metric} by Encounter`}
          sub={
            classmateNames.size > 0
              ? `Comparing ${name} vs ${[...classmateNames].join(", ")} (${playerClass})`
              : `${name} - ${metric} across this session`
          }
          defaultOpen
        >
          <div className="bg-bg-panel border border-gold-dim rounded-sm p-4">
            {counts.shortPulls > 0 && (
              <p className="mb-3 text-xs text-text-dim">Performance includes all recorded encounters, including short pulls.</p>
            )}
            <SessionLineChart data={chartData} players={chartPlayers} metric={metric} />
          </div>
        </AccordionSection>
      )}

      <AccordionSection title="Encounter Breakdown" count={visibleStats.length} defaultOpen>
        {visibleStats.length === 0 && <EmptyState title="No counted encounters" />}
        <div className="bg-bg-panel border border-gold-dim rounded-sm divide-y divide-gold-dim overflow-hidden">
          {visibleStats.map((e, index) => (
            <Link
              key={e.encounterId}
              href={`/encounters/${e.encounterId}${querySuffix}`}
              className={getRevealClassName({
                boss: true,
                className:
                  "flex items-start justify-between px-4 py-3 hover:bg-bg-hover transition-colors group gap-3 flex-wrap",
              })}
              style={getRevealStyle(index)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={cn(
                    "text-[11px] font-bold px-1.5 py-0.5 rounded-sm",
                    e.outcome === "KILL"
                      ? "text-success bg-success/10"
                      : e.outcome === "WIPE"
                        ? "text-danger bg-danger/10"
                        : "text-text-dim bg-bg-hover"
                  )}
                >
                  {e.outcome}
                </span>
                <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors">
                  {e.bossName}
                </span>
                <span className={cn("diff-badge", e.difficulty.endsWith("H") ? "heroic" : "normal")}>
                  {e.difficulty}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs tabular-nums text-text-secondary flex-wrap justify-end">
                {e.dps > 0 && (
                  <span>
                    {formatDps(e.dps)}
                    <span className="text-text-dim ml-0.5">dps</span>
                  </span>
                )}
                {e.hps > 100 && (
                  <span>
                    {formatDps(e.hps)}
                    <span className="text-text-dim ml-0.5">hps</span>
                  </span>
                )}
                {e.aps > 0 && (
                  <span>
                    {formatDps(e.aps)}
                    <span className="text-text-dim ml-0.5">aps</span>
                  </span>
                )}
                {e.critPct > 0 && (
                  <span>
                    {e.critPct.toFixed(1)}%
                    <span className="text-text-dim ml-0.5">crit</span>
                  </span>
                )}
                {e.deaths > 0 && <span className="text-danger">x{e.deaths}</span>}
                <span className="text-text-dim">{formatDuration(e.duration)}</span>
              </div>
            </Link>
          ))}
        </div>
      </AccordionSection>

      {totalDeaths > 0 && (
        <p className="text-xs text-text-dim">
          Total deaths this session: <span className="text-danger font-bold">x{totalDeaths}</span>
        </p>
      )}

      <div className="pt-2 border-t border-gold-dim">
        <Link
          href={`/players/${encodeURIComponent(name)}${querySuffix}`}
          className="text-xs text-gold hover:text-gold-light transition-colors"
        >
          View {name}&apos;s all-time profile &rarr;
        </Link>
      </div>
    </div>
  );
}
