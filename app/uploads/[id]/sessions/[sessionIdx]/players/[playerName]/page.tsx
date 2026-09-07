import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { PageLoading } from "@/components/ui/PageLoading";
import { db } from "@/lib/db";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { SectionNav } from "@/components/ui/SectionNav";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { SessionLineChart } from "@/components/charts/SessionLineChart";
import type { ChartPoint, PlayerLine } from "@/components/charts/SessionLineChart";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
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
import { cn, formatCountLabel, formatDateTimeUtc, formatDuration, getRecordedDurationSeconds } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";
import { EmptyState } from "@/components/ui/EmptyState";
import { countAttempts, isShortPull, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { buildRaidSummaryQuery, parseRaidSummaryScope } from "@/lib/raid-summary-scope";

interface Props {
  params: Promise<{ id: string; sessionIdx: string; playerName: string }>;
  searchParams: Promise<{ includeShortPulls?: string | string[]; scope?: string | string[] }>;
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

async function getSessionPlayerPageContext({ params, searchParams }: Props) {
  const { id, sessionIdx, playerName } = await params;
  const query = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(query.includeShortPulls);
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";
  const raidQuerySuffix = buildRaidSummaryQuery(parseRaidSummaryScope(query.scope), includeShortPulls);
  const name = playerName;
  const resolution = await resolveRaidSession(id, sessionIdx);

  if (!resolution) notFound();

  const { route: sessionRoute, uploadId, publicSlug } = resolution;
  const sessionPath = getRaidSessionPath(publicSlug, sessionRoute);
  if (resolution.isLegacyUploadId || resolution.isLegacyIndex) {
    permanentRedirect(`${sessionPath}/players/${encodeURIComponent(name)}${raidQuerySuffix}`);
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
        duration: getRecordedDurationSeconds(enc),
        startedAt: enc.startedAt,
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

  return { name, includeShortPulls, querySuffix, raidQuerySuffix, sessionRoute, uploadId, sessionPath, encounters, orderedEncounters, myStats, playerClass, classColor };
}

export default async function SessionPlayerPage(props: Props) {
  const data = await getSessionPlayerPageContext(props);
  return (
    <Suspense fallback={<PageLoading message="Loading player report..." />}>
      <SessionPlayerContent data={data} />
    </Suspense>
  );
}

async function SessionPlayerContent({ data }: { data: Awaited<ReturnType<typeof getSessionPlayerPageContext>> }) {
  const { name, includeShortPulls, querySuffix, raidQuerySuffix, sessionRoute, uploadId, sessionPath, encounters, orderedEncounters, myStats, playerClass, classColor } = data;
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
    : null;
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
      <div className="flex flex-wrap items-center gap-1 text-sm text-text-dim">
        <Link href={`/raids${querySuffix}`} className="inline-flex min-h-11 items-center hover:text-gold">Raids</Link>
        <span>&gt;</span>
        <Link href={`${sessionPath}${raidQuerySuffix}`} className="inline-flex min-h-11 items-center hover:text-gold">
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

      <SectionNav items={[
        ...(chartData.length > 1 ? [{ id: "performance", label: "Performance" }] : []),
        { id: "encounters", label: "Boss fights" },
      ]} />

      <section aria-label="Player performance summary" className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-text-secondary">
          <span>Pulls <span className="ml-1 font-semibold tabular-nums text-text-primary"><NumericValue value={counts.totalPulls} /></span></span>
          <span>Kills <span className="ml-1 font-semibold tabular-nums text-text-primary"><NumericValue value={kills.length} /></span></span>
        </div>
        <StatGroup columns={4}>
          <StatCard label={`Best ${metric}`} value={<NumericValue value={bestMetric} kind="rate" />} sub="single pull" />
          <StatCard label={`Avg ${metric}`} value={<NumericValue value={avgKillMetric} kind="rate" />} sub="on kills" />
          <StatCard label="Best APS" value={<NumericValue value={bestAps} kind="rate" />} sub="single pull" />
          <StatCard label="Best Healing + absorbs /s" value={<NumericValue value={bestHealAndAbsorbPs} kind="rate" />} sub="single pull" />
        </StatGroup>
        <p className="text-sm text-text-secondary">Best values use all recorded pulls in this session, including short pulls. The average gives each successful fight equal weight.</p>
        {kills.length === 0 && <p className="text-sm text-text-secondary">No successful fights were recorded for this player. The average on kills is unavailable.</p>}
      </section>

      {chartData.length > 1 && (
        <AccordionSection
          id="performance"
          title={`${metric} by Successful Boss Fight`}
          sub={
            classmateNames.size > 0
              ? `Winning boss fights, earliest first · Comparing ${name} vs ${[...classmateNames].join(", ")} (${playerClass})`
              : `Winning boss fights, earliest first · ${name}'s ${metric}`
          }
          defaultOpen
        >
          <div className="data-panel p-4">
            {counts.shortPulls > 0 && (
              <p className="mb-3 text-xs text-text-dim">This chart includes winning boss fights only, including short successful kills. Wipes are excluded.</p>
            )}
            <SessionLineChart data={chartData} players={chartPlayers} metric={metric} />
          </div>
        </AccordionSection>
      )}

      <AccordionSection id="encounters" title="Encounter Breakdown" sub="Earliest fight first · Times in UTC" count={visibleStats.length} defaultOpen>
        {visibleStats.length === 0 && <EmptyState title="No counted encounters" />}
        <div className="data-panel divide-y divide-gold-dim">
          {visibleStats.map((e, index) => (
            <Link
              key={e.encounterId}
              href={`/encounters/${e.encounterId}${raidQuerySuffix}`}
              className={getRevealClassName({
                boss: true,
                className:
                  "group grid gap-3 px-4 py-3 transition-colors hover:bg-bg-hover lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center",
              })}
              style={getRevealStyle(index)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded-sm",
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

              <div className="space-y-2 tabular-nums text-text-secondary">
                <div className="grid grid-cols-3 gap-3 text-sm lg:text-right">
                  <span><NumericValue value={e.dps} kind="rate" /> DPS</span>
                  <span><NumericValue value={e.hps} kind="rate" /> HPS</span>
                  <span><NumericValue value={e.aps} kind="rate" /> APS</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs lg:justify-end">
                  <span><NumericValue value={e.critPct} kind="percent" /> overall crit</span>
                  {e.deaths > 0 && <span className="text-danger">{formatCountLabel(e.deaths, "death")}</span>}
                  <span className="text-text-dim">{formatDuration(e.duration)} duration</span>
                  <span className="text-text-dim">{formatDateTimeUtc(e.startedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </AccordionSection>

      {totalDeaths > 0 && (
        <p className="text-xs text-text-dim">
          Total this session: <span className="text-danger font-bold">{formatCountLabel(totalDeaths, "death")}</span>
        </p>
      )}

      <div className="pt-2 border-t border-gold-dim">
        <Link
          href={`/players/${encodeURIComponent(name)}${querySuffix}`}
          className="inline-flex min-h-11 items-center text-sm text-gold transition-colors hover:text-gold-light"
        >
          View {name}&apos;s all-time profile &rarr;
        </Link>
      </div>
    </div>
  );
}
