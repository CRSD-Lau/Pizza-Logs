"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { triggerSync } from "@/app/admin/actions";

type SyncJobSummary = {
  status: "DONE" | "FAILED";
  completedAt: string | null;
  error: string | null;
  result: Record<string, number> | null;
  agentId: string | null;
} | null;

type SyncStatus = {
  ok: boolean;
  roster: SyncJobSummary;
  gear: SyncJobSummary;
  pendingCount: number;
  inProgress: { type: string; startedAt: string; agentId: string | null } | null;
};

function ago(dateStr: string | null | undefined): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SyncHealthPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeType, setActiveType] = useState<"ROSTER" | "GEAR" | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/status");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, [poll]);

  const trigger = (type: "ROSTER" | "GEAR") => {
    setActiveType(type);
    setMessage(null);
    startTransition(async () => {
      const result = await triggerSync(type);
      if (result.ok) {
        setMessage(`${type} sync queued — bridge will pick it up shortly`);
        await poll();
      } else {
        setMessage(`Error: ${result.error}`);
      }
      setActiveType(null);
    });
  };

  const running = (type: "ROSTER" | "GEAR") => status?.inProgress?.type === type;
  const hasPending = (status?.pendingCount ?? 0) > 0;

  return (
    <div className="bg-bg-panel border border-gold-dim rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          Warmane Auto-Sync
        </span>
        {status?.inProgress && (
          <span className="text-xs text-warning animate-pulse">
            {status.inProgress.type} syncing
            {status.inProgress.agentId ? ` on ${status.inProgress.agentId}` : ""}…
          </span>
        )}
        {hasPending && !status?.inProgress && (
          <span className="text-xs text-text-dim">
            {status?.pendingCount} job{(status?.pendingCount ?? 0) > 1 ? "s" : ""} queued —
            waiting for bridge
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SyncCard
          label="Guild Roster"
          job={status?.roster ?? null}
          running={running("ROSTER")}
          triggering={isPending && activeType === "ROSTER"}
          onTrigger={() => trigger("ROSTER")}
          resultKey="membersImported"
          resultLabel="members"
        />
        <SyncCard
          label="Gear Cache"
          job={status?.gear ?? null}
          running={running("GEAR")}
          triggering={isPending && activeType === "GEAR"}
          onTrigger={() => trigger("GEAR")}
          resultKey="synced"
          resultLabel="synced"
        />
      </div>

      {message && <p className="text-xs text-text-secondary">{message}</p>}

      <p className="text-xs text-text-dim">
        Desktop bridge must be running to process queued jobs.
      </p>
    </div>
  );
}

function SyncCard({
  label,
  job,
  running,
  triggering,
  onTrigger,
  resultKey,
  resultLabel,
}: {
  label: string;
  job: SyncJobSummary;
  running: boolean;
  triggering: boolean;
  onTrigger: () => void;
  resultKey: string;
  resultLabel: string;
}) {
  const isOk = job?.status === "DONE";
  return (
    <div className="rounded border border-gold-dim bg-bg-card p-3 space-y-2">
      <div className="text-xs font-medium text-text-secondary">{label}</div>
      {job ? (
        <>
          <div className={`text-xs font-semibold ${isOk ? "text-success" : "text-danger"}`}>
            {isOk ? "✓" : "✗"} {ago(job.completedAt)}
          </div>
          {job.error && (
            <div className="text-xs text-danger truncate" title={job.error}>
              {job.error}
            </div>
          )}
          {job.result && typeof job.result[resultKey] === "number" && (
            <div className="text-xs text-text-dim">
              {job.result[resultKey]} {resultLabel}
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-text-dim">No sync yet</div>
      )}
      <button
        onClick={onTrigger}
        disabled={running || triggering}
        className="w-full rounded bg-gold/10 border border-gold-dim px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {running ? "Running…" : triggering ? "Queuing…" : `Sync ${label}`}
      </button>
    </div>
  );
}
