import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { SectionNav } from "@/components/ui/SectionNav";
import { StatCard, StatGroup } from "@/components/ui/StatCard";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { SessionPlayerTable } from "@/components/reports/SessionPlayerTable";
import type { SessionPlayerRow } from "@/lib/session-player-sort";
import { buildRaidSummary, raidMetricRate } from "@/lib/raid-kill-summary";
import { buildRaidSummaryQuery, parseRaidSummaryScope } from "@/lib/raid-summary-scope";
import { countAttempts, isShortPull, parseIncludeShortPulls } from "@/lib/attempt-policy";
import { getClassColor } from "@/lib/constants/classes";
import { getClassIconUrl } from "@/lib/class-icons";
import {
  formatRaidDateLabel,
  formatRaidSessionTitle,
  getRaidSessionPath,
} from "@/lib/raid-session-slug";
import { getRaidSessionRoutes, resolveRaidSession } from "@/lib/raid-session-routing.server";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";
import { buildPageMetadata } from "@/lib/page-metadata";
import { getRevealClassName, getRevealStyle, orderBossDisplayEntries } from "@/lib/ui-animation";
import { cn, formatCountLabel, formatDateTimeRangeUtc, formatDateTimeUtc, formatDuration, formatNumber, getRecordedDurationSeconds } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";

interface Props {
  params: Promise<{ id: string; sessionIdx: string }>;
  searchParams: Promise<{ includeShortPulls?: string | string[]; scope?: string | string[] }>;
}

interface SessionPlayerAnalytics {
  totalDamage: number;
  totalHealing: number;
  totalAbsorbs: number;
  heal: number;
  damageTaken: number;
}

interface SessionAnalytics {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  totalDamage: number;
  totalHealing: number;
  totalAbsorbs: number;
  heal: number;
  totalDamageTaken: number;
  unattributedAbsorbs: number;
  players: Record<string, SessionPlayerAnalytics>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id, sessionIdx } = await params;
  const includeShortPulls = parseIncludeShortPulls((await searchParams).includeShortPulls);
  const resolution = await resolveRaidSession(id, sessionIdx);
  if (!resolution) return { title: "Raid" };

  const { route, uploadId, publicSlug } = resolution;
  const [upload, encounters] = await Promise.all([
    db.upload.findUnique({
      where: { id: uploadId },
      select: { guild: { select: { name: true } } },
    }),
    db.encounter.findMany({
      where: { uploadId, sessionIndex: route.sessionIndex },
      select: {
        outcome: true,
        durationMs: true,
        durationSeconds: true,
        participants: { select: { deaths: true } },
        boss: { select: { raid: true } },
      },
    }),
  ]);

  const title = formatRaidSessionTitle(route);
  const dateLabel = formatRaidDateLabel(route.startedAt);
  const raidNames = [...new Set(encounters.map(encounter => encounter.boss.raid))];
  const raidLabel = raidNames.length > 0 ? raidNames.join(" + ") : "Raid";
  const guildLabel = upload?.guild?.name ? ` for ${upload.guild.name}` : "";
  const { kills, wipes, totalPulls } = countAttempts(encounters, { includeShortPulls });
  const description = `${raidLabel} raid report${guildLabel} on ${dateLabel}. ${formatCountLabel(kills, "kill")}, ${formatCountLabel(wipes, "wipe")}, ${formatCountLabel(totalPulls, "pull")}.`;
  const canonical = `${PIZZA_LOGS_ORIGIN}${getRaidSessionPath(publicSlug, route)}`;

  return buildPageMetadata({ title, description, path: canonical, type: "article" });
}

export default async function SessionDetailPage({ params, searchParams }: Props) {
  const { id, sessionIdx } = await params;
  const query = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(query.includeShortPulls);
  const scope = parseRaidSummaryScope(query.scope);
  const isKills = scope === "kills";
  const resolution = await resolveRaidSession(id, sessionIdx);
  if (!resolution) notFound();

  const { route: sessionRoute, uploadId, publicSlug } = resolution;
  const sessionPath = getRaidSessionPath(publicSlug, sessionRoute);
  const querySuffix = buildRaidSummaryQuery(scope, includeShortPulls);
  const viewPath = `${sessionPath}${querySuffix}`;
  if (resolution.isLegacyUploadId || resolution.isLegacyIndex) permanentRedirect(viewPath);

  const sessionIndex = sessionRoute.sessionIndex;
  const sessionRoutes = await getRaidSessionRoutes(uploadId);
  const sessionPosition = sessionRoutes.findIndex(route => route.sessionIndex === sessionIndex);
  const previousSession = sessionPosition > 0 ? sessionRoutes[sessionPosition - 1] : null;
  const nextSession = sessionPosition >= 0 && sessionPosition < sessionRoutes.length - 1
    ? sessionRoutes[sessionPosition + 1]
    : null;

  const upload = await db.upload.findUnique({
    where: { id: uploadId },
    select: {
      sessionDamage: true,
      sessionAnalytics: true,
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
    },
  });
  if (!upload) notFound();

  const encounters = await db.encounter.findMany({
    where: { uploadId, sessionIndex },
    orderBy: { startedAt: "asc" },
    include: {
      boss: { select: { name: true, slug: true, raid: true } },
      participants: {
        include: { player: { select: { name: true, class: true } } },
      },
    },
  });

  if (encounters.length === 0) notFound();

  const orderedEncounters = orderBossDisplayEntries(
    encounters,
    enc => enc.boss.name,
    enc => enc.startedAt,
  );
  const encounterRevealIndex = new Map(orderedEncounters.map((enc, index) => [enc.id, index]));

  const { kills, wipes, unknown, shortPulls, totalPulls } = countAttempts(orderedEncounters, { includeShortPulls });
  const visibleEncounters = includeShortPulls ? orderedEncounters : orderedEncounters.filter(enc => !isShortPull(enc));
  const sessionAnalyticsMap = (upload.sessionAnalytics ?? {}) as unknown as Record<string, SessionAnalytics>;
  const sessionAnalytics = sessionAnalyticsMap[String(sessionIndex)];
  const legacySessionDamage = ((upload.sessionDamage ?? {}) as Record<string, number>)[String(sessionIndex)];
  const raidSummary = buildRaidSummary(orderedEncounters, scope);
  const recordedResults = countAttempts(raidSummary.encounters, { includeShortPulls: true });
  const summaryResults = isKills ? formatCountLabel(recordedResults.kills, "kill")
    : [formatCountLabel(recordedResults.kills, "kill"), formatCountLabel(recordedResults.wipes, "wipe"),
      ...(recordedResults.unknown > 0 ? [formatCountLabel(recordedResults.unknown, "unknown outcome")] : [])].join(" / ");
  const listedResults = [formatCountLabel(kills, "kill"), formatCountLabel(wipes, "wipe"),
    ...(unknown > 0 ? [formatCountLabel(unknown, "unknown outcome")] : [])].join(" / ");
  const startedAt = sessionAnalytics?.startedAt ?? encounters[0].startedAt;
  const endedAt = sessionAnalytics?.endedAt ?? encounters[encounters.length - 1].endedAt;
  const sessionPlayers = Object.entries(sessionAnalytics?.players ?? {});

  const sessionCount = sessionRoutes.length;
  const sessionTitle = formatRaidSessionTitle(sessionRoute);

  const playerSet = new Map<string, string | null>();
  for (const enc of orderedEncounters) {
    for (const p of enc.participants) {
      if (!playerSet.has(p.player.name)) playerSet.set(p.player.name, p.player.class ?? null);
    }
  }
  const encounterPlayerNames = new Set(playerSet.keys());
  for (const [name] of sessionPlayers) {
    if (!playerSet.has(name)) playerSet.set(name, null);
  }
  const sessionBreakdownRows: SessionPlayerRow[] = sessionPlayers.map(([name, metrics]) => ({
    name,
    href: encounterPlayerNames.has(name)
      ? `${sessionPath}/players/${encodeURIComponent(name)}${querySuffix}`
      : null,
    color: getClassColor(playerSet.get(name) ?? name),
    totalDamage: metrics.totalDamage,
    dps: raidMetricRate(metrics.totalDamage, sessionAnalytics?.durationMs ?? null),
    heal: metrics.heal,
    healPerSecond: raidMetricRate(metrics.heal, sessionAnalytics?.durationMs ?? null),
    damageTaken: metrics.damageTaken,
    dtps: raidMetricRate(metrics.damageTaken, sessionAnalytics?.durationMs ?? null),
  }));
  const raidBreakdownRows: SessionPlayerRow[] = raidSummary.players.map(player => ({
    name: player.name,
    href: `${sessionPath}/players/${encodeURIComponent(player.name)}${querySuffix}`,
    color: getClassColor(player.playerClass ?? player.name),
    totalDamage: player.totalDamage,
    dps: raidMetricRate(player.totalDamage, raidSummary.durationMs),
    heal: player.heal,
    healPerSecond: raidMetricRate(player.heal, raidSummary.durationMs),
    damageTaken: player.damageTaken,
    dtps: raidMetricRate(player.damageTaken, raidSummary.durationMs),
  }));
  const realmName = upload.realm?.name ?? "Lordaeron";
  const guildName = upload.guild?.name ?? null;
  const rosterMembers = playerSet.size > 0
    ? await db.guildRosterMember.findMany({
      where: {
        normalizedCharacterName: { in: Array.from(playerSet.keys()).map(playerName => playerName.toLowerCase()) },
        realm: realmName,
      },
      select: {
        normalizedCharacterName: true,
        guildName: true,
        className: true,
        raceName: true,
      },
    })
    : [];
  const rosterMemberMap = new Map(rosterMembers.map(member => [member.normalizedCharacterName, member]));

  const mobMap = new Map<string, {
    totalDamage: number;
    hits: number;
    crits: number;
    byPlayer: Map<string, { damage: number; hits: number; crits: number; playerClass: string | null }>;
  }>();

  for (const enc of raidSummary.encounters) {
    for (const p of enc.participants) {
      if (!p.targetBreakdown) continue;
      const td = p.targetBreakdown as Record<string, { damage: number; hits: number; crits: number }>;
      for (const [mob, stats] of Object.entries(td)) {
        if (!stats || stats.damage <= 0) continue;
        const entry = mobMap.get(mob) ?? { totalDamage: 0, hits: 0, crits: 0, byPlayer: new Map() };
        entry.totalDamage += stats.damage;
        entry.hits += stats.hits;
        entry.crits += stats.crits;
        const prev = entry.byPlayer.get(p.player.name) ?? {
          damage: 0,
          hits: 0,
          crits: 0,
          playerClass: p.player.class ?? null,
        };
        prev.damage += stats.damage;
        prev.hits += stats.hits;
        prev.crits += stats.crits;
        entry.byPlayer.set(p.player.name, prev);
        mobMap.set(mob, entry);
      }
    }
  }

  const mobEntries: MobEntry[] = Array.from(mobMap.entries())
    .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
    .map(([name, data]) => ({
      name,
      totalDamage: data.totalDamage,
      hits: data.hits,
      crits: data.crits,
      byPlayer: Array.from(data.byPlayer.entries()).map(([pName, pd]) => ({
        name: pName,
        playerClass: pd.playerClass,
        damage: pd.damage,
        hits: pd.hits,
        crits: pd.crits,
      })),
    }));

  const raidGroups = new Map<string, typeof encounters>();
  for (const enc of visibleEncounters) {
    const arr = raidGroups.get(enc.boss.raid) ?? [];
    arr.push(enc);
    raidGroups.set(enc.boss.raid, arr);
  }

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-center gap-1 text-sm text-text-dim">
        <Link href={includeShortPulls ? "/raids?includeShortPulls=1" : "/raids"} className="inline-flex min-h-11 items-center hover:text-gold">Raids</Link>
        <span>&gt;</span>
        <span className="text-text-secondary">{sessionTitle}</span>
      </div>

      {sessionCount > 1 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {previousSession && (
            <Link href={`${getRaidSessionPath(publicSlug, previousSession)}${querySuffix}`} className="inline-flex min-h-11 items-center text-gold hover:text-gold-light">
              Previous raid
            </Link>
          )}
          {nextSession && (
            <Link href={`${getRaidSessionPath(publicSlug, nextSession)}${querySuffix}`} className="inline-flex min-h-11 items-center text-gold hover:text-gold-light sm:ml-auto">
              Next raid
            </Link>
          )}
        </div>
      )}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light text-glow-gold">
            {sessionTitle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-dim">
            <span>{[...new Set(orderedEncounters.map(enc => enc.boss.raid))].join(" - ")}</span>
            {upload.guild?.name && <span>- {upload.guild.name}</span>}
            {upload.realm?.name && <span>- {upload.realm.name}</span>}
            {upload.realm?.host && <span>- {upload.realm.host}</span>}
            <span>-</span>
            <span>
              {formatDateTimeRangeUtc(startedAt, endedAt)}
            </span>
          </div>
        </div>
      </div>

      <SectionNav items={[
        { id: "boss-kill-breakdown", label: "Player totals" },
        { id: "encounters", label: "Boss fights" },
        ...(mobEntries.length > 0 ? [{ id: "targets", label: "Targets" }] : []),
        { id: "full-session", label: "Full session" },
        ...(playerSet.size > 0 ? [{ id: "roster", label: "Roster" }] : []),
      ]} />

      <section aria-label={isKills ? "Boss kill summary" : "All boss attempt summary"} className="space-y-4">
        <nav aria-label="Boss fight scope" className="flex flex-wrap gap-2">
          {(["all", "kills"] as const).map(value => (
            <Link
              key={value}
              href={`${sessionPath}${buildRaidSummaryQuery(value, includeShortPulls)}`}
              scroll={false}
              aria-current={scope === value ? "page" : undefined}
              className={cn("inline-flex min-h-11 items-center rounded-sm border px-4 py-2 text-sm font-semibold transition-colors",
                scope === value ? "border-gold bg-gold/10 text-gold-light" : "border-gold-dim text-text-secondary hover:border-gold hover:text-gold-light")}
            >
              {value === "all" ? "All Boss Attempts" : "Successful Boss Fights"}
            </Link>
          ))}
        </nav>

        <div className="space-y-2">
          <h2 className="heading-cinzel text-sm font-bold uppercase tracking-widest text-gold">{isKills ? "Successful Boss Fights" : "All Boss Attempts"}</h2>
          <p className="text-sm text-text-secondary">
            {isKills
              ? "Totals cover winning boss fights and their adds. Wipes and between-fight trash are excluded."
              : "Totals cover every recorded boss attempt and its adds, including wipes, unknown outcomes and short pulls. Between-fight trash is excluded."}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="text-text-secondary">{isKills ? "Fight results" : "Recorded results"}</span>
            <span className="font-semibold tabular-nums text-text-primary">{summaryResults}</span>
            <span className="text-text-secondary">· {formatCountLabel(raidSummary.encounters.length, isKills ? "successful fight" : "recorded attempt")}</span>
          </div>
        </div>
        <StatGroup columns={4}>
          <StatCard label="Total Damage" value={formatNumber(raidSummary.totalDamage)} sub={isKills ? "boss kills only" : "all recorded boss attempts"} />
          <StatCard label="Healing + absorbs" value={formatNumber(raidSummary.heal)} sub="effective healing + absorbs" />
          <StatCard label="Damage Taken" value={formatNumber(raidSummary.totalDamageTaken)} sub={isKills ? "boss kills only" : "all recorded boss attempts"} />
          <StatCard label={isKills ? "Kill Time" : "Fight Time"} value={formatDuration(raidSummary.durationMs === null ? null : raidSummary.durationMs / 1000)} sub={isKills ? "combined boss kill duration" : "combined boss attempt duration"} />
        </StatGroup>
      </section>

      <ShortPullNotice shortPulls={shortPulls} includeShortPulls={includeShortPulls} basePath={viewPath} listOnly />

      <AccordionSection id="boss-kill-breakdown" title={isKills ? "Boss Kill Breakdown" : "All Boss Attempt Breakdown"} count={raidBreakdownRows.length} defaultOpen>
        {raidBreakdownRows.length > 0 ? (
          <>
            <details className="mb-3 text-sm text-text-secondary">
              <summary className="min-h-11 cursor-pointer py-3 text-gold">How totals and rates are calculated</summary>
              <p className="pb-3">
              Healing + absorbs includes effective healing and attributed shields; Healing + absorbs /s is their combined rate.
              Every player uses the same combined {isKills ? "kill" : "attempt"} time, including fights they sat out.
              Player links open their report across all attempts.
              </p>
            </details>
            {raidSummary.durationMs === null && (
              <p className="mb-3 text-sm text-text-secondary">Some {isKills ? "kill" : "attempt"} durations are missing. Totals remain available; rates are unavailable.</p>
            )}
            <SessionPlayerTable key={scope} rows={raidBreakdownRows} label={isKills ? "Boss kill player metrics" : "All boss attempt player metrics"} />
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            {isKills && recordedResults.kills === 0 ? "No successful boss kills were recorded in this session." : "No player metrics were recorded for these boss fights."}
            {" "}Recorded attempts and any full-session data remain available below.
          </p>
        )}
      </AccordionSection>

      <AccordionSection id="encounters" title="Encounters" sub={`${listedResults} listed · Grouped by raid · Earliest fight first · Times in UTC`} count={totalPulls} defaultOpen>
        {visibleEncounters.length === 0 && (
          <p className="text-sm text-text-secondary">Only short pulls were recorded. Include short pulls to inspect them.</p>
        )}
        <div className="space-y-4">
          {Array.from(raidGroups.entries()).map(([raidName, encs]) => (
            <div key={raidName} className="space-y-1">
              <p className="text-xs font-semibold text-text-dim uppercase tracking-widest px-1">{raidName}</p>
              <div className="data-panel divide-y divide-gold-dim">
                {encs.map((enc) => {
                  const shortPull = isShortPull(enc);
                  const durationSec = getRecordedDurationSeconds(enc);
                  const rdps = durationSec === null ? null : enc.totalDamage / durationSec;

                  return (
                    <Link
                      key={enc.id}
                      href={`/encounters/${enc.id}${querySuffix}`}
                      className={getRevealClassName({
                        boss: true,
                        className:
                          "flex items-start justify-between gap-3 px-4 py-3 hover:bg-bg-hover transition-colors group flex-wrap",
                      })}
                      style={getRevealStyle(encounterRevealIndex.get(enc.id) ?? 0)}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded-sm",
                            shortPull ? "text-text-secondary bg-bg-hover"
                              : enc.outcome === "KILL" ? "text-success bg-success/10"
                              : enc.outcome === "WIPE" ? "text-danger-light bg-danger/10"
                                : "text-text-dim bg-bg-hover"
                          )}
                        >
                          {shortPull ? "SHORT PULL" : enc.outcome}
                        </span>
                        <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors">
                          {enc.boss.name}
                        </span>
                        <span className={`diff-badge ${enc.difficulty.endsWith("H") ? "heroic" : "normal"}`}>
                          {enc.difficulty}
                        </span>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums text-text-secondary lg:w-auto lg:justify-end">
                        <span>{formatDuration(durationSec)} duration</span>
                        <span>{formatNumber(enc.totalDamage)} damage</span>
                        <span><NumericValue value={rdps} kind="rate" /> raid DPS</span>
                        <span className="w-full text-xs text-text-dim sm:w-auto">
                          {formatDateTimeUtc(enc.startedAt)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </AccordionSection>

      {mobEntries.length > 0 && (
        <AccordionSection
          id="targets"
          title={isKills ? "Mob Damage - Boss Kills" : "Mob Damage - All Boss Attempts"}
          sub={`Damage to targets during ${isKills ? "successful boss fights" : "all recorded boss attempts"}, including encounter adds - click to drill down by player`}
          count={mobEntries.length}
          defaultOpen={false}
        >
          <div className="data-panel">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </AccordionSection>
      )}

      <AccordionSection
        id="full-session"
        title="Full Session Breakdown"
        sub="Optional totals including wipes, trash and downtime"
        count={sessionPlayers.length}
        defaultOpen={false}
      >
        {sessionAnalytics ? (
          <div className="space-y-4">
            <div aria-label="Full session totals">
              <StatGroup columns={4}>
                <StatCard label="Total Damage" value={formatNumber(sessionAnalytics.totalDamage)} sub="full raid session" />
                <StatCard label="Healing + absorbs" value={formatNumber(sessionAnalytics.heal)} sub="effective healing + absorbs" />
                <StatCard label="Damage Taken" value={formatNumber(sessionAnalytics.totalDamageTaken)} sub="full raid session" />
                <StatCard label="Duration" value={formatDuration(sessionAnalytics.durationMs / 1000)} sub="first to last log event" />
              </StatGroup>
            </div>
            <p className="text-sm text-text-secondary">
              These rates use the entire session duration, including downtime. Player links open their recorded boss attempts;
              separate trash spell and target breakdowns are not stored.
            </p>
            {sessionBreakdownRows.length > 0 ? (
              <SessionPlayerTable rows={sessionBreakdownRows} label="Full session player metrics" />
            ) : (
              <p className="text-sm text-text-secondary">Full-session player metrics are unavailable for this report.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Number.isFinite(legacySessionDamage) && legacySessionDamage >= 0 && (
              <StatCard label="Total Damage" value={formatNumber(legacySessionDamage)} sub="stored full raid session total" />
            )}
            <p className="text-sm text-text-secondary">
              Detailed full-session analytics were not stored for this older report. The boss summary uses its recorded encounters;
              full-session healing, damage taken and player rates are unavailable.
            </p>
          </div>
        )}
      </AccordionSection>

      {playerSet.size > 0 && (
        <AccordionSection id="roster" title="Raid Roster" sub="Player names A–Z" count={playerSet.size} defaultOpen={false}>
          <div className="flex flex-wrap gap-2 border-y border-gold-dim px-2 py-4">
            {Array.from(playerSet.entries()).sort(([left], [right]) => left.localeCompare(right, "en", { sensitivity: "base" })).map(([name, cls], index) => {
              const rosterMember = rosterMemberMap.get(name.toLowerCase());
              const characterClass = cls ?? rosterMember?.className ?? null;
              const classColor = getClassColor(characterClass ?? name);

              return (
                <div
                  key={name}
                  className={getRevealClassName({
                    className:
                      "inline-flex min-h-11 items-center gap-2 rounded-sm px-2 py-1 text-sm transition-colors hover:bg-bg-card",
                  })}
                  style={getRevealStyle(index)}
                >
                  <PlayerAvatar
                    name={name}
                    realmName={realmName}
                    characterClass={characterClass}
                    raceName={rosterMember?.raceName}
                    guildName={rosterMember?.guildName ?? guildName}
                    color={classColor}
                    fallbackIconUrl={getClassIconUrl(characterClass)}
                    size="xs"
                  />
                  <Link
                    href={`${sessionPath}/players/${encodeURIComponent(name)}${querySuffix}`}
                    className="inline-flex min-h-11 items-center font-medium text-text-primary hover:text-gold-light"
                  >
                    {name}
                  </Link>
                  {characterClass && <span className="text-text-dim">{characterClass}</span>}
                </div>
              );
            })}
          </div>
        </AccordionSection>
      )}
    </div>
  );
}
