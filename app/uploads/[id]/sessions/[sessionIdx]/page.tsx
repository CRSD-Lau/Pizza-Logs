import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { MobBreakdown, type MobEntry } from "@/components/meter/MobBreakdown";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { StatCard } from "@/components/ui/StatCard";
import { getClassColor } from "@/lib/constants/classes";
import { getClassIconUrl } from "@/lib/class-icons";
import {
  formatRaidDateLabel,
  formatRaidSessionTitle,
  getRaidSessionPath,
} from "@/lib/raid-session-slug";
import { getRaidSessionRoutes, resolveRaidSession } from "@/lib/raid-session-routing.server";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";
import { getRevealClassName, getRevealStyle, orderBossDisplayEntries } from "@/lib/ui-animation";
import { cn, formatDuration, formatDurationPrecise, formatNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string; sessionIdx: string }>;
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, sessionIdx } = await params;
  const resolution = await resolveRaidSession(id, sessionIdx);
  if (!resolution) return { title: "Raid" };

  const { route } = resolution;
  const [upload, encounters] = await Promise.all([
    db.upload.findUnique({
      where: { id },
      select: { guild: { select: { name: true } } },
    }),
    db.encounter.findMany({
      where: { uploadId: id, sessionIndex: route.sessionIndex },
      select: {
        outcome: true,
        boss: { select: { raid: true } },
      },
    }),
  ]);

  const title = formatRaidSessionTitle(route);
  const socialTitle = `${title} | Pizza Logs`;
  const dateLabel = formatRaidDateLabel(route.startedAt);
  const raidNames = [...new Set(encounters.map(encounter => encounter.boss.raid))];
  const raidLabel = raidNames.length > 0 ? raidNames.join(" + ") : "Raid";
  const guildLabel = upload?.guild?.name ? ` for ${upload.guild.name}` : "";
  const kills = encounters.filter(encounter => encounter.outcome === "KILL").length;
  const wipes = encounters.filter(encounter => encounter.outcome === "WIPE").length;
  const description = `${raidLabel} raid report${guildLabel} on ${dateLabel}. ${kills} kills, ${wipes} wipes, ${encounters.length} pulls.`;
  const canonical = `${PIZZA_LOGS_ORIGIN}${getRaidSessionPath(id, route)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      type: "article",
      siteName: "Pizza Logs",
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description,
    },
  };
}

export default async function SessionDetailPage({ params }: Props) {
  const { id, sessionIdx } = await params;
  const resolution = await resolveRaidSession(id, sessionIdx);
  if (!resolution) notFound();

  const { route: sessionRoute } = resolution;
  const sessionPath = getRaidSessionPath(id, sessionRoute);
  if (resolution.isLegacyIndex) permanentRedirect(sessionPath);

  const sessionIndex = sessionRoute.sessionIndex;
  const sessionRoutes = await getRaidSessionRoutes(id);
  const sessionPosition = sessionRoutes.findIndex(route => route.sessionIndex === sessionIndex);
  const previousSession = sessionPosition > 0 ? sessionRoutes[sessionPosition - 1] : null;
  const nextSession = sessionPosition >= 0 && sessionPosition < sessionRoutes.length - 1
    ? sessionRoutes[sessionPosition + 1]
    : null;

  const upload = await db.upload.findUnique({
    where: { id },
    select: {
      id: true,
      sessionDamage: true,
      sessionAnalytics: true,
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
    },
  });
  if (!upload) notFound();

  const encounters = await db.encounter.findMany({
    where: { uploadId: id, sessionIndex },
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

  const kills = orderedEncounters.filter(e => e.outcome === "KILL").length;
  const wipes = orderedEncounters.filter(e => e.outcome === "WIPE").length;
  const sessionDmgMap = (upload.sessionDamage ?? {}) as Record<string, number>;
  const sessionAnalyticsMap = (upload.sessionAnalytics ?? {}) as unknown as Record<string, SessionAnalytics>;
  const sessionAnalytics = sessionAnalyticsMap[String(sessionIndex)];
  const encounterDmg = orderedEncounters.reduce((sum, e) => sum + e.totalDamage, 0);
  const fallbackHealing = orderedEncounters.reduce((sum, e) => sum + e.totalHealing, 0);
  const fallbackAbsorbs = orderedEncounters.reduce((sum, e) => sum + e.totalAbsorbs, 0);
  const fallbackDamageTaken = orderedEncounters.reduce((sum, e) => sum + e.totalDamageTaken, 0);
  const startedAt = sessionAnalytics?.startedAt ?? encounters[0].startedAt;
  const endedAt = sessionAnalytics?.endedAt ?? encounters[encounters.length - 1].endedAt;
  const fallbackDurationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const durationMs = sessionAnalytics?.durationMs ?? fallbackDurationMs;
  const durationSeconds = Math.max(0.001, durationMs / 1000);
  const fullSessionDmg = sessionAnalytics?.totalDamage ?? sessionDmgMap[String(sessionIndex)] ?? encounterDmg;
  const fullSessionHeal = sessionAnalytics?.heal ?? fallbackHealing + fallbackAbsorbs;
  const fullSessionDamageTaken = sessionAnalytics?.totalDamageTaken ?? fallbackDamageTaken;
  const sessionPlayers = Object.entries(sessionAnalytics?.players ?? {})
    .sort(([, left], [, right]) =>
      right.totalDamage - left.totalDamage
      || right.heal - left.heal
      || right.damageTaken - left.damageTaken
    );

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

  for (const enc of orderedEncounters) {
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
  for (const enc of orderedEncounters) {
    const arr = raidGroups.get(enc.boss.raid) ?? [];
    arr.push(enc);
    raidGroups.set(enc.boss.raid, arr);
  }

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-center gap-1 text-sm text-text-dim">
        <Link href="/raids" className="inline-flex min-h-11 items-center hover:text-gold">Raids</Link>
        <span>&gt;</span>
        <span className="text-text-secondary">{sessionTitle}</span>
      </div>

      {sessionCount > 1 && (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {previousSession && (
            <Link href={getRaidSessionPath(id, previousSession)} className="text-gold hover:text-gold-light">
              Previous raid
            </Link>
          )}
          {nextSession && (
            <Link href={getRaidSessionPath(id, nextSession)} className="text-gold hover:text-gold-light sm:ml-auto">
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
            <span>{[...raidGroups.keys()].join(" - ")}</span>
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

      <div className="grid grid-cols-2 items-stretch gap-y-2 rounded-sm bg-bg-panel/40 p-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Kills / Wipes" value={`${kills}K / ${wipes}W`} highlight className="col-span-2" />
        <StatCard label="Total Damage" value={formatNumber(fullSessionDmg)} sub="full raid session" />
        <StatCard label="Heal" value={formatNumber(fullSessionHeal)} sub="effective healing + absorbs" />
        <StatCard label="Damage Taken" value={formatNumber(fullSessionDamageTaken)} sub="full raid session" />
        <StatCard label="Duration" value={formatDurationPrecise(durationMs)} sub="first to last log event" className="col-span-2 sm:col-span-1" />
      </div>

      {sessionPlayers.length > 0 && (
        <AccordionSection title="Full Session Breakdown" count={sessionPlayers.length} defaultOpen={false}>
          <div className="data-panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs tabular-nums">
              <thead className="bg-bg-card text-text-dim uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="px-4 py-3 text-right">Total Damage</th>
                  <th className="px-4 py-3 text-right">DPS</th>
                  <th className="px-4 py-3 text-right">Heal</th>
                  <th className="px-4 py-3 text-right">HPS</th>
                  <th className="px-4 py-3 text-right">Damage Taken</th>
                  <th className="px-4 py-3 text-right">DTPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-dim">
                {sessionPlayers.map(([name, metrics]) => {
                  const cls = playerSet.get(name) ?? null;
                  const color = getClassColor(cls ?? name);
                  return (
                    <tr key={name} className="hover:bg-bg-hover transition-colors">
                      <td className="px-4 py-2.5 text-left">
                        {encounterPlayerNames.has(name) ? (
                          <Link
                            href={`${sessionPath}/players/${encodeURIComponent(name)}`}
                            className="font-semibold hover:text-gold transition-colors"
                            style={{ color }}
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="font-semibold" style={{ color }}>{name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-primary">{Math.round(metrics.totalDamage).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">{(metrics.totalDamage / durationSeconds).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-4 py-2.5 text-right text-text-primary">{Math.round(metrics.heal).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">{(metrics.heal / durationSeconds).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-4 py-2.5 text-right text-text-primary">{Math.round(metrics.damageTaken).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">{(metrics.damageTaken / durationSeconds).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AccordionSection>
      )}

      <AccordionSection title="Encounters" count={encounters.length} defaultOpen>
        <div className="space-y-4">
          {Array.from(raidGroups.entries()).map(([raidName, encs]) => (
            <div key={raidName} className="space-y-1">
              <p className="text-xs font-semibold text-text-dim uppercase tracking-widest px-1">{raidName}</p>
              <div className="data-panel divide-y divide-gold-dim">
                {encs.map((enc) => {
                  const durationSec = (enc.durationMs ?? 0) > 0
                    ? enc.durationMs / 1000
                    : Math.max(1, enc.durationSeconds);
                  const rdps = enc.durationSeconds > 0
                    ? Math.round(enc.totalDamage / durationSec)
                    : 0;

                  return (
                    <Link
                      key={enc.id}
                      href={`/encounters/${enc.id}`}
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
                            "text-[11px] font-bold px-1.5 py-0.5 rounded-sm",
                            enc.outcome === "KILL" ? "text-success bg-success/10"
                              : enc.outcome === "WIPE" ? "text-danger bg-danger/10"
                                : "text-text-dim bg-bg-hover"
                          )}
                        >
                          {enc.outcome}
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
          title="Mob Damage - Boss Pulls"
          sub="Aggregate damage to every target inside detected pulls - click to drill down by player"
          count={mobEntries.length}
          defaultOpen={false}
        >
          <div className="data-panel">
            <MobBreakdown mobs={mobEntries} />
          </div>
        </AccordionSection>
      )}

      {playerSet.size > 0 && (
        <AccordionSection title="Raid Roster" count={playerSet.size} defaultOpen={false}>
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
                    href={`${sessionPath}/players/${encodeURIComponent(name)}`}
                    className="font-medium text-text-primary hover:text-gold-light"
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
