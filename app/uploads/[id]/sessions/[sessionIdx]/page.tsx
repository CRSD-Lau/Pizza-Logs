import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { SectionNav } from "@/components/ui/SectionNav";
import { StatCard } from "@/components/ui/StatCard";
import { ShortPullNotice } from "@/components/reports/ShortPullNotice";
import { SessionPlayerTable } from "@/components/reports/SessionPlayerTable";
import type { SessionPlayerRow } from "@/lib/session-player-sort";
import { buildRaidKillSummary, raidMetricRate } from "@/lib/raid-kill-summary";
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
import { cn, formatDuration, formatDurationPrecise, formatNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string; sessionIdx: string }>;
  searchParams: Promise<{ includeShortPulls?: string | string[] }>;
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
  const description = `${raidLabel} raid report${guildLabel} on ${dateLabel}. ${kills} kills, ${wipes} wipes, ${totalPulls} pulls.`;
  const canonical = `${PIZZA_LOGS_ORIGIN}${getRaidSessionPath(publicSlug, route)}`;

  return buildPageMetadata({ title, description, path: canonical, type: "article" });
}

export default async function SessionDetailPage({ params, searchParams }: Props) {
  const { id, sessionIdx } = await params;
  const includeShortPulls = parseIncludeShortPulls((await searchParams).includeShortPulls);
  const resolution = await resolveRaidSession(id, sessionIdx);
  if (!resolution) notFound();

  const { route: sessionRoute, uploadId, publicSlug } = resolution;
  const sessionPath = getRaidSessionPath(publicSlug, sessionRoute);
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";
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

  const { kills, wipes, shortPulls, totalPulls } = countAttempts(orderedEncounters, { includeShortPulls });
  const visibleEncounters = includeShortPulls ? orderedEncounters : orderedEncounters.filter(enc => !isShortPull(enc));
  const sessionAnalyticsMap = (upload.sessionAnalytics ?? {}) as unknown as Record<string, SessionAnalytics>;
  const sessionAnalytics = sessionAnalyticsMap[String(sessionIndex)];
  const legacySessionDamage = ((upload.sessionDamage ?? {}) as Record<string, number>)[String(sessionIndex)];
  const killSummary = buildRaidKillSummary(orderedEncounters);
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
  const killBreakdownRows: SessionPlayerRow[] = killSummary.players.map(player => ({
    name: player.name,
    href: `${sessionPath}/players/${encodeURIComponent(player.name)}${querySuffix}`,
    color: getClassColor(player.playerClass ?? player.name),
    totalDamage: player.totalDamage,
    dps: raidMetricRate(player.totalDamage, killSummary.durationMs),
    heal: player.heal,
    healPerSecond: raidMetricRate(player.heal, killSummary.durationMs),
    damageTaken: player.damageTaken,
    dtps: raidMetricRate(player.damageTaken, killSummary.durationMs),
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

  for (const enc of killSummary.encounters) {
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
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {previousSession && (
            <Link href={`${getRaidSessionPath(publicSlug, previousSession)}${querySuffix}`} className="text-gold hover:text-gold-light">
              Previous raid
            </Link>
          )}
          {nextSession && (
            <Link href={`${getRaidSessionPath(publicSlug, nextSession)}${querySuffix}`} className="text-gold hover:text-gold-light sm:ml-auto">
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
              {new Date(startedAt).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
              })}
              {" -> "}
              {new Date(endedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
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

      <section aria-label="Boss kill summary" className="space-y-2">
        <h2 className="heading-cinzel text-sm font-bold uppercase tracking-widest text-gold">Successful Boss Fights</h2>
        <p className="text-sm text-text-secondary">
          Totals cover winning boss fights and their adds. Wipes and between-fight trash are excluded.
        </p>
        <div className="grid grid-cols-2 items-stretch gap-y-2 rounded-sm bg-bg-panel/40 p-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Kills / Wipes" value={`${kills}K / ${wipes}W`} sub="recorded attempts" highlight className="col-span-2" />
          <StatCard label="Total Damage" value={formatNumber(killSummary.totalDamage)} sub="boss kills only" />
          <StatCard label="Heal" value={formatNumber(killSummary.heal)} sub="effective healing + absorbs" />
          <StatCard label="Damage Taken" value={formatNumber(killSummary.totalDamageTaken)} sub="boss kills only" />
          <StatCard label="Kill Time" value={killSummary.durationMs === null ? "Unavailable" : formatDurationPrecise(killSummary.durationMs)} sub="combined boss kill duration" className="col-span-2 sm:col-span-1" />
        </div>
      </section>

      <ShortPullNotice shortPulls={shortPulls} includeShortPulls={includeShortPulls} basePath={sessionPath} />

      <AccordionSection id="boss-kill-breakdown" title="Boss Kill Breakdown" count={killBreakdownRows.length} defaultOpen>
        {killBreakdownRows.length > 0 ? (
          <>
            <details className="mb-3 text-sm text-text-secondary">
              <summary className="min-h-11 cursor-pointer py-3 text-gold">How totals and rates are calculated</summary>
              <p className="pb-3">
              Heal includes effective healing and attributed absorbs; H+A PS is their combined rate.
              Every player uses the same combined kill time, including fights they sat out.
              Player links open their report across all attempts.
              </p>
            </details>
            {killSummary.durationMs === null && (
              <p className="mb-3 text-sm text-text-secondary">Some kill durations are missing. Totals remain available; rates are unavailable.</p>
            )}
            <SessionPlayerTable rows={killBreakdownRows} label="Boss kill player metrics" />
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            {kills === 0 ? "No successful boss kills were recorded in this session." : "No player metrics were recorded for these boss kills."}
            {" "}Recorded attempts and any full-session data remain available below.
          </p>
        )}
      </AccordionSection>

      <AccordionSection id="encounters" title="Encounters" count={totalPulls} defaultOpen>
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
                  const durationSec = (enc.durationMs ?? 0) > 0
                    ? enc.durationMs / 1000
                    : Math.max(1, enc.durationSeconds);
                  const rdps = enc.durationSeconds > 0
                    ? Math.round(enc.totalDamage / durationSec)
                    : 0;

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
                      <div className="flex items-center gap-4 text-xs tabular-nums text-text-secondary flex-wrap justify-end">
                        <span>{formatDuration(enc.durationSeconds)}</span>
                        <span>{formatNumber(enc.totalDamage)} dmg</span>
                        <span>{rdps.toLocaleString()} rdps</span>
                        <span className="text-text-dim">
                          {new Date(enc.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
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
          title="Mob Damage - Boss Kills"
          sub="Damage to targets during successful boss fights, including encounter adds - click to drill down by player"
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Full session totals">
              <StatCard label="Total Damage" value={formatNumber(sessionAnalytics.totalDamage)} sub="full raid session" />
              <StatCard label="Heal" value={formatNumber(sessionAnalytics.heal)} sub="effective healing + absorbs" />
              <StatCard label="Damage Taken" value={formatNumber(sessionAnalytics.totalDamageTaken)} sub="full raid session" />
              <StatCard label="Duration" value={formatDurationPrecise(sessionAnalytics.durationMs)} sub="first to last log event" />
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
              Detailed full-session analytics were not stored for this older report. The boss-kill summary uses its recorded encounters;
              full-session healing, damage taken and player rates are unavailable.
            </p>
          </div>
        )}
      </AccordionSection>

      {playerSet.size > 0 && (
        <AccordionSection id="roster" title="Raid Roster" count={playerSet.size} defaultOpen={false}>
          <div className="flex flex-wrap gap-2 border-y border-gold-dim px-2 py-4">
            {Array.from(playerSet.entries()).map(([name, cls], index) => {
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
