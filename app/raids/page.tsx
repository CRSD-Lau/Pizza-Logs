import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { PageHeader } from "@/components/ui/PageLayout";

export const metadata: Metadata = { title: "Raids" };
export const dynamic = "force-dynamic";

async function getRaidUploads() {
  return db.upload.findMany({
    where: { encounters: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
      encounters: {
        orderBy: { startedAt: "asc" },
        select: {
          sessionIndex: true,
          outcome: true,
          startedAt: true,
          endedAt: true,
          boss: { select: { raid: true } },
        },
      },
    },
  });
}

export default async function RaidsPage() {
  let databaseAvailable = true;
  let uploads: Awaited<ReturnType<typeof getRaidUploads>> = [];

  try {
    uploads = await getRaidUploads();
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }

  type SessionCard = {
    uploadId: string;
    sessionIndex: number;
    startedAt: Date;
    endedAt: Date;
    raids: string[];
    kills: number;
    wipes: number;
    encounterCount: number;
    realmName: string | null;
    guildName: string | null;
  };

  const sessions: SessionCard[] = [];

  for (const upload of uploads) {
    const sessionMap = new Map<number, typeof upload.encounters>();
    for (const enc of upload.encounters) {
      const arr = sessionMap.get(enc.sessionIndex) ?? [];
      arr.push(enc);
      sessionMap.set(enc.sessionIndex, arr);
    }
    for (const [sessionIndex, encs] of Array.from(sessionMap.entries()).sort((a, b) => a[0] - b[0])) {
      const raids = [...new Set(encs.map(e => e.boss.raid))];
      sessions.push({
        uploadId: upload.id,
        sessionIndex,
        startedAt: encs[0].startedAt,
        endedAt: encs[encs.length - 1].endedAt,
        raids,
        kills: encs.filter(e => e.outcome === "KILL").length,
        wipes: encs.filter(e => e.outcome === "WIPE").length,
        encounterCount: encs.length,
        realmName: upload.realm?.name ?? null,
        guildName: upload.guild?.name ?? null,
      });
    }
  }

  sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const byDay = new Map<string, SessionCard[]>();
  for (const s of sessions) {
    const day = new Date(s.startedAt).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const arr = byDay.get(day) ?? [];
    arr.push(s);
    byDay.set(day, arr);
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Raids"
        description={<p>
          {databaseAvailable
            ? `${sessions.length} raid session${sessions.length !== 1 ? "s" : ""} recorded`
            : "Raid sessions are unavailable while the database is offline"}
        </p>}
      />

      {!databaseAvailable && (
        <DatabaseUnavailable description="Raid history needs the Pizza Logs database. Start local Postgres to load recorded sessions." />
      )}

      {databaseAvailable && (sessions.length === 0 ? (
        <EmptyState
          title="No raids yet"
          description="Upload a combat log to get started."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
        />
      ) : (
        <div className="space-y-10">
          {Array.from(byDay.entries()).map(([day, daySessions]) => (
            <div key={day}>
              <p className="heading-cinzel text-xs text-gold uppercase tracking-widest mb-3 pb-2 border-b border-gold-dim">
                {day}
              </p>
              <div className="space-y-3">
                {daySessions.map((s, index) => (
                  <Link
                    key={`${s.uploadId}-${s.sessionIndex}`}
                    href={`/raids/${s.uploadId}/sessions/${s.sessionIndex}`}
                    className={getRevealClassName({
                      boss: true,
                      className:
                        "block bg-bg-panel border border-gold-dim rounded-sm p-4 hover:border-gold/50 transition-colors group",
                    })}
                    style={getRevealStyle(index)}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {s.raids.map(r => (
                            <span key={r} className="heading-cinzel text-sm font-semibold text-gold-light">
                              {r}
                            </span>
                          ))}
                          {s.guildName && <span className="text-xs text-text-dim">{s.guildName}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
                          <span>
                            {new Date(s.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            {" - "}
                            {new Date(s.endedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {s.realmName && <span>{s.realmName}</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-5">
                        <Metric label="Kills" value={s.kills} valueClassName="text-success" />
                        <Metric label="Wipes" value={s.wipes} valueClassName="text-danger" />
                        <Metric label="Pulls" value={s.encounterCount} valueClassName="text-text-secondary" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName: string;
}) {
  return (
    <div className="rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-center min-w-[74px]">
      <div className={`font-bold tabular-nums ${valueClassName}`}>{value}</div>
      <div className="text-xs text-text-dim uppercase tracking-wide">{label}</div>
    </div>
  );
}
