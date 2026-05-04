import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { SessionLineChart } from "@/components/charts/SessionLineChart";
import type { ChartPoint, PlayerLine } from "@/components/charts/SessionLineChart";
import { StatCard } from "@/components/ui/StatCard";
import { getClassColor } from "@/lib/constants/classes";
import { sortByICCOrder } from "@/lib/constants/bosses";
import { getClassIconUrl } from "@/lib/warmane-portrait";
import { cn, formatDps, formatDuration } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string; sessionIdx: string; playerName: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { playerName, sessionIdx } = await params;
  const name = decodeURIComponent(playerName);
  return { title: `${name} - Session ${Number(sessionIdx) + 1}` };
}

export default async function SessionPlayerPage({ params }: Props) {
  const { id, sessionIdx, playerName } = await params;
  const sessionIndex = parseInt(sessionIdx, 10);
  const name = decodeURIComponent(playerName);

  if (isNaN(sessionIndex)) notFound();

  const encounters = await db.encounter.findMany({
    where: { uploadId: id, sessionIndex },
    orderBy: { startedAt: "asc" },
    include: {
      boss: { select: { name: true, slug: true, raid: true } },
      participants: {
        include: { player: { select: { id: true, name: true, class: true } } },
      },
    },
  });

  if (encounters.length === 0) notFound();

  const orderedEncounters = sortByICCOrder(encounters, enc => enc.boss.name);

  const firstParticipation = encounters
    .flatMap(e => e.participants)
    .find(p => p.player.name === name);
  if (!firstParticipation) notFound();

  const playerClass = firstParticipation.player.class ?? null;
  const classColor = getClassColor(playerClass ?? name);
  const upload = await db.upload.findUnique({
    where: { id },
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
        totalDamage: p.totalDamage,
        totalHealing: p.totalHealing,
        deaths: p.deaths,
        critPct: p.critPct,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (myStats.length === 0) notFound();

  const kills = myStats.filter(e => e.outcome === "KILL");
  const bestDps = Math.max(0, ...myStats.map(e => e.dps));
  const bestHps = Math.max(0, ...myStats.map(e => e.hps));
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

  const chartData: ChartPoint[] = orderedEncounters.map((enc) => {
    const point: ChartPoint = { bossName: enc.boss.name };
    for (const pName of allPlayers) {
      const p = enc.participants.find(part => part.player.name === pName);
      point[pName] = p ? (metric === "DPS" ? p.dps : p.hps) : null;
    }
    return point;
  });

  const chartPlayers: PlayerLine[] = allPlayers.map((pName) => ({
    name: pName,
    isSubject: pName === name,
    color: pName === name ? "#c8a84b" : classColor,
  }));

  const sessionCount = await db.encounter.groupBy({
    by: ["sessionIndex"],
    where: { uploadId: id },
  }).then(r => r.length);

  const sessionLabel = sessionCount === 1 ? "Raid Session" : `Session ${sessionIndex + 1} of ${sessionCount}`;
  const sessionDate = new Date(encounters[0].startedAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="pt-10 space-y-8">
      <div className="text-xs text-text-dim flex items-center gap-1 flex-wrap">
        <Link href="/raids" className="hover:text-gold">Raids</Link>
        <span>&gt;</span>
        <Link href={`/raids/${id}/sessions/${sessionIndex}`} className="hover:text-gold">
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
          portraitUrl={null}
          fallbackIconUrl={getClassIconUrl(playerClass ?? rosterMember?.className)}
          size="lg"
        />
        <div>
          <h1 className="heading-cinzel text-2xl font-bold" style={{ color: classColor }}>
            {name}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
            {playerClass && <span className="text-text-secondary">{playerClass}</span>}
            <span className="text-text-dim">-</span>
            <span className="text-text-dim">{sessionDate}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pulls" value={myStats.length} />
        <StatCard label="Kills" value={kills.length} highlight />
        <StatCard label={`Best ${metric}`} value={formatDps(bestMetric)} sub="single pull" />
        <StatCard label={`Avg ${metric}`} value={formatDps(avgKillMetric)} sub="on kills" />
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
          <div className="bg-bg-panel border border-gold-dim rounded p-4">
            <SessionLineChart data={chartData} players={chartPlayers} metric={metric} />
          </div>
        </AccordionSection>
      )}

      <AccordionSection title="Encounter Breakdown" count={myStats.length} defaultOpen>
        <div className="bg-bg-panel border border-gold-dim rounded divide-y divide-gold-dim overflow-hidden">
          {myStats.map((e) => (
            <Link
              key={e.encounterId}
              href={`/encounters/${e.encounterId}`}
              className="flex items-start justify-between px-4 py-3 hover:bg-bg-hover transition-colors group gap-3 flex-wrap"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={cn(
                    "text-[11px] font-bold px-1.5 py-0.5 rounded",
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
          href={`/players/${encodeURIComponent(name)}`}
          className="text-xs text-gold hover:text-gold-light transition-colors"
        >
          View {name}&apos;s all-time profile &rarr;
        </Link>
      </div>
    </div>
  );
}
