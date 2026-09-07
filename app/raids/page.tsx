import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui/PageLoading";
import { db } from "@/lib/db";
import { DatabaseUnavailable } from "@/components/ui/DatabaseUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { buildRaidSessionRoutesWithAnalytics } from "@/lib/raid-session-slug";
import { getRevealClassName, getRevealStyle } from "@/lib/ui-animation";
import { PageHeader } from "@/components/ui/PageLayout";
import { countAttempts, parseIncludeShortPulls } from "@/lib/attempt-policy";

import { buildPageMetadata } from "@/lib/page-metadata";
import { buildDirectoryHref, getDirectoryPagination, parseDirectoryPage, type DirectoryQueryValue } from "@/lib/directory-pagination";
import { formatCountLabel, formatDateUtc, formatDateTimeRangeUtc, formatInteger } from "@/lib/utils";

export const metadata = buildPageMetadata({
  title: "Raids",
  description: "Browse public PizzaWarriors raid reports by date, instance, and result.",
  path: "/raids",
});
export const dynamic = "force-dynamic";

const RAID_UPLOADS_PER_PAGE = 20;

async function getRaidUploads(requestedPage: number) {
  const where = { encounters: { some: {} } };
  const totalUploads = await db.upload.count({ where });
  const pagination = getDirectoryPagination(totalUploads, requestedPage, RAID_UPLOADS_PER_PAGE);
  const uploads = await db.upload.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: pagination.startIndex,
    take: RAID_UPLOADS_PER_PAGE,
    select: {
      publicSlug: true,
      sessionAnalytics: true,
      realm: { select: { name: true, host: true } },
      guild: { select: { name: true } },
      encounters: {
        orderBy: { startedAt: "asc" },
        select: {
          sessionIndex: true,
          outcome: true,
          durationMs: true,
          durationSeconds: true,
          participants: { select: { deaths: true } },
          startedAt: true,
          endedAt: true,
          boss: { select: { raid: true } },
        },
      },
    },
  });
  return { uploads, totalUploads, pagination };
}

interface Props {
  searchParams: Promise<{ page?: DirectoryQueryValue; includeShortPulls?: DirectoryQueryValue }>;
}

export default function RaidsPage(props: Props) {
  return (
    <Suspense fallback={<PageLoading message="Loading raids..." />}>
      <RaidsPageContent {...props} />
    </Suspense>
  );
}

async function RaidsPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const includeShortPulls = parseIncludeShortPulls(params.includeShortPulls);
  const querySuffix = includeShortPulls ? "?includeShortPulls=1" : "";
  let databaseAvailable = true;
  let data: Awaited<ReturnType<typeof getRaidUploads>> | null = null;

  try {
    data = await getRaidUploads(parseDirectoryPage(params.page));
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    databaseAvailable = false;
  }
  const uploads = data?.uploads ?? [];
  const pageHref = (page: number) => buildDirectoryHref("/raids", { page, includeShortPulls });

  type SessionCard = {
    publicReportSlug: string;
    sessionIndex: number;
    routeSlug: string;
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
    const routeBySessionIndex = new Map(
      buildRaidSessionRoutesWithAnalytics(
        upload.encounters.map(encounter => ({
          sessionIndex: encounter.sessionIndex,
          startedAt: encounter.startedAt,
        })),
        upload.sessionAnalytics,
      ).map(route => [route.sessionIndex, route]),
    );

    const sessionMap = new Map<number, typeof upload.encounters>();
    for (const enc of upload.encounters) {
      const arr = sessionMap.get(enc.sessionIndex) ?? [];
      arr.push(enc);
      sessionMap.set(enc.sessionIndex, arr);
    }
    for (const [sessionIndex, encs] of Array.from(sessionMap.entries()).sort((a, b) => a[0] - b[0])) {
      const route = routeBySessionIndex.get(sessionIndex);
      if (!route) continue;
      const raids = [...new Set(encs.map(e => e.boss.raid))];
      const counts = countAttempts(encs, { includeShortPulls });
      sessions.push({
        publicReportSlug: upload.publicSlug,
        sessionIndex,
        routeSlug: route.slug,
        startedAt: route.startedAt,
        endedAt: encs[encs.length - 1].endedAt,
        raids,
        kills: counts.kills,
        wipes: counts.wipes,
        encounterCount: counts.totalPulls,
        realmName: upload.realm?.name ?? null,
        guildName: upload.guild?.name ?? null,
      });
    }
  }

  sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const byDay = new Map<string, SessionCard[]>();
  for (const s of sessions) {
    const day = formatDateUtc(s.startedAt);
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
            ? `${formatCountLabel(sessions.length, "raid session")} from ${formatCountLabel(uploads.length, "upload")} on this page`
            : "Raid reports are temporarily unavailable"}
        </p>}
      />

      {data && data.totalUploads > 0 && (
        <p className="text-sm text-text-secondary">
          Uploads {formatInteger(data.pagination.firstVisible)}–{formatInteger(data.pagination.lastVisible)} of {formatInteger(data.totalUploads)} · Newest uploads first.
          {" "}All sessions in an upload stay together.
        </p>
      )}

      {!databaseAvailable && (
        <DatabaseUnavailable description="Raid reports are temporarily unavailable. Please try again shortly." />
      )}

      {databaseAvailable && (sessions.length === 0 ? (
        <EmptyState
          title="No raids yet"
          description="Upload a combat log to get started."
          action={<Link href="/" className="text-gold hover:text-gold-light text-sm">Upload a log &rarr;</Link>}
        />
      ) : (
        <div className="space-y-6">
          {Array.from(byDay.entries()).map(([day, daySessions]) => (
            <div key={day}>
              <p className="heading-cinzel mb-2 text-xs uppercase tracking-widest text-text-secondary">
                {day}
              </p>
              <div className="space-y-3">
                {daySessions.map((s, index) => (
                  <Link
                    key={`${s.publicReportSlug}-${s.sessionIndex}`}
                    href={`/raids/${s.publicReportSlug}/sessions/${s.routeSlug}${querySuffix}`}
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
                            {formatDateTimeRangeUtc(s.startedAt, s.endedAt)}
                          </span>
                          {s.realmName && <span>{s.realmName}</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 border-t border-gold-dim/50 pt-3 sm:min-w-56 sm:shrink-0 sm:border-0 sm:pt-0">
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
      {data && data.totalUploads > 0 && (
        <nav aria-label="Raid history pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gold-dim pt-4">
          <p className="text-sm text-text-secondary">Page {formatInteger(data.pagination.currentPage)} of {formatInteger(data.pagination.totalPages)}</p>
          <div className="flex gap-2">
            {data.pagination.currentPage > 1 ? (
              <Link href={pageHref(data.pagination.currentPage - 1)} className="inline-flex min-h-11 items-center rounded-sm border border-gold-dim px-4 text-sm font-semibold text-gold hover:border-gold">Previous uploads</Link>
            ) : <button type="button" disabled className="min-h-11 rounded-sm border border-gold-dim px-4 text-sm text-text-secondary opacity-40">Previous uploads</button>}
            {data.pagination.currentPage < data.pagination.totalPages ? (
              <Link href={pageHref(data.pagination.currentPage + 1)} className="inline-flex min-h-11 items-center rounded-sm border border-gold-dim px-4 text-sm font-semibold text-gold hover:border-gold">Next uploads</Link>
            ) : <button type="button" disabled className="min-h-11 rounded-sm border border-gold-dim px-4 text-sm text-text-secondary opacity-40">Next uploads</button>}
          </div>
        </nav>
      )}
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
    <div className="min-w-0 text-center">
      <div className={`font-bold tabular-nums ${valueClassName}`}>{formatInteger(value)}</div>
      <div className="text-xs text-text-dim uppercase tracking-wide">{label}</div>
    </div>
  );
}
