"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/Button";
import type { UploadResponse } from "@/lib/schema";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-security";
import { BUG_REPORT_URL, SECURITY_REPORT_URL, UPLOAD_POLICY_HEADER, UPLOAD_POLICY_VERSION } from "@/lib/upload-policy";
import { cn, formatCountLabel, formatInteger, formatPercent, formatRate, formatSeconds } from "@/lib/utils";
import { requestUploadNotifications, sendUploadNotification } from "./notifications";

interface UploadZoneProps {
  onComplete?: (result: UploadResponse & { filename: string }) => void;
}

type Stage = "idle" | "uploading" | "done" | "error";

interface UploadState {
  stage: Stage;
  progress: number;
  message: string;
  elapsed: number;
  stalled: boolean;
  result?: UploadResponse & { filename: string };
  error?: string;
}

export function UploadZone({ onComplete }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>({
    stage: "idle",
    progress: 0,
    message: "",
    elapsed: 0,
    stalled: false,
  });
  const lastEventAt = useRef<number>(0);

  const [characterName, setCharacterName] = useState("");
  const [realmName, setRealmName] = useState("Lordaeron");
  const realmHost = "warmane";
  const [guildName, setGuildName] = useState("");
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  const [notificationUnavailable, setNotificationUnavailable] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!acceptedPolicy || !characterName.trim()) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({
        stage: "error",
        progress: 0,
        message: "",
        elapsed: 0,
        stalled: false,
        error: "File exceeds the 100 MiB compressed upload limit.",
      });
      return;
    }
    const startTime = Date.now();

    lastEventAt.current = Date.now();
    setState({ stage: "uploading", progress: 2, message: "Uploading file...", elapsed: 0, stalled: false });

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const stallThreshold = 150_000;
    const ticker = setInterval(() => {
      setState((current) => {
        if (current.stage !== "uploading") return current;
        const stalled = (Date.now() - lastEventAt.current) > stallThreshold;
        return {
          ...current,
          elapsed: Math.floor((Date.now() - startTime) / 1000),
          stalled,
        };
      });
    }, 1000);

    const params = new URLSearchParams({
      uploaderName: characterName.trim(),
      realmName,
      realmHost,
      filename: file.name,
      fileSize: String(file.size),
    });
    if (guildName.trim()) params.set("guildName", guildName.trim());

    const uploadId = crypto.randomUUID();

    let succeeded = false;

    try {
      const res = await fetch(`/api/upload?${params}`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-upload-id": uploadId,
          [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION,
        },
        body: file,
      });
      if (!res.ok) {
        const messages: Record<number, string> = {
          400: "The upload request is invalid. Check the file and upload rules, then try again.",
          403: "This upload could not be verified. Reload Pizza Logs and try again.",
          413: "File exceeds the 100 MiB upload limit.",
          428: "The upload rules have changed. Reload this page and review them before uploading.",
          429: "Upload capacity is busy. Wait a minute before trying again.",
        };
        throw new Error(messages[res.status] ?? "The upload service is unavailable. Please try again shortly.");
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;

            let event: {
              type: string;
              pct?: number;
              msg?: string;
              result?: UploadResponse | { encounters?: unknown[] };
              timings?: { finalByteToQuickResultMs?: number };
            };
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            const elapsed = Math.floor((Date.now() - startTime) / 1000);

            if ((event.type === "progress" || event.type === "state") && event.pct !== undefined) {
              lastEventAt.current = Date.now();
              setState((current) => current.stage === "uploading"
                ? { ...current, progress: event.pct!, message: event.msg ?? "", elapsed, stalled: false }
                : current);
            } else if (event.type === "quick-result") {
              lastEventAt.current = Date.now();
              const quickMs = event.timings?.finalByteToQuickResultMs;
              setState((current) => current.stage === "uploading"
                ? {
                    ...current,
                    progress: event.pct ?? 45,
                    message: quickMs !== undefined
                      ? `${event.msg ?? "Quick classification ready"} (${formatSeconds(quickMs / 1000)} after upload)`
                      : (event.msg ?? "Quick classification ready"),
                    elapsed,
                    stalled: false,
                  }
                : current);
            } else if (event.type === "complete" && event.result) {
              succeeded = true;
              clearInterval(ticker);
              const result = { ...(event.result as UploadResponse), filename: file.name };
              setState({ stage: "done", progress: 100, message: "Done", elapsed, stalled: false, result });
              onComplete?.(result);
              const stored = result.encountersInserted;
              sendUploadNotification(
                "Upload complete",
                stored > 0
                  ? `${formatCountLabel(stored, "encounter")} stored`
                  : "No new encounters in this log",
              );
            } else if (event.type === "error") {
              throw new Error((event as { msg?: string }).msg ?? "Upload failed");
            }
          }
        }
      }
      if (!succeeded) throw new Error("The connection ended before upload completion. Check raids before retrying; your report may have been saved.");
    } catch (err) {
      if (succeeded) return;
      clearInterval(ticker);
      const msg = String(err instanceof Error ? err.message : err);
      setState({ stage: "error", progress: 0, message: "", elapsed: 0, stalled: false, error: msg });
      sendUploadNotification("Upload failed", msg);
    } finally {
      clearInterval(ticker);
      window.removeEventListener("beforeunload", onBeforeUnload);
    }
  }, [acceptedPolicy, characterName, guildName, onComplete, realmName]);

  const isLocked = !characterName.trim() || !acceptedPolicy;

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (files) => {
      if (files[0]) processFile(files[0]);
    },
    accept: {
      "text/plain": [".txt", ".log"],
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
      "application/octet-stream": [".zip"],
    },
    multiple: false,
    maxSize: MAX_UPLOAD_BYTES,
    onDropRejected: () => setState({ stage: "error", progress: 0, message: "", elapsed: 0, stalled: false, error: "Choose one TXT, LOG or ZIP combat log, at most 100 MiB." }),
    disabled: state.stage === "uploading" || isLocked,
  });

  const lockedProps = {
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDragEnter: (event: React.DragEvent) => event.preventDefault(),
    onDrop: (event: React.DragEvent) => event.preventDefault(),
    onClick: (event: React.MouseEvent) => event.preventDefault(),
  };

  const reset = () => {
    setAcceptedPolicy(false);
    setState({ stage: "idle", progress: 0, message: "", elapsed: 0, stalled: false });
  };

  return (
    <div className="space-y-4">
      {state.stage === "idle" && (
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="upload-character" className="text-xs text-text-secondary uppercase tracking-wide">
              Character <span className="text-text-secondary">(required)</span>
            </label>
            <input
              id="upload-character"
              required
              maxLength={32}
              value={characterName}
              onChange={(event) => setCharacterName(event.target.value)}
              placeholder="Your character name"
              className="min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold"
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="upload-realm" className="text-xs text-text-secondary uppercase tracking-wide">Warmane realm</label>
            <select
              id="upload-realm"
              value={realmName}
              onChange={(event) => setRealmName(event.target.value)}
              className="min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold"
            >
              <option value="Icecrown">Icecrown</option>
              <option value="Lordaeron">Lordaeron</option>
              <option value="Onyxia">Onyxia</option>
              <option value="Blackrock">Blackrock</option>
            </select>
          </div>

        </div>
      )}

      {state.stage === "idle" && (
        <div className="rounded-sm border border-gold-dim bg-bg-panel px-3 py-2 text-sm text-text-secondary">
          <p id="upload-policy-help">Genuine combat logs only. No malware, scripts or unrelated files. <Link href="/upload-policy" target="_blank" rel="noopener noreferrer" className="text-gold underline">Read upload rules</Link>.</p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1" htmlFor="upload-policy-accept">
            <input id="upload-policy-accept" type="checkbox" required checked={acceptedPolicy} onChange={event => setAcceptedPolicy(event.target.checked)} aria-describedby="upload-policy-help" className="h-5 w-5 shrink-0 accent-gold" />
            <span>I have permission to share this log, agree to the upload rules and understand that character names and raid results will be public.</span>
          </label>
        </div>
      )}

      {state.stage === "idle" && (
        <div
          {...(isLocked ? lockedProps : getRootProps())}
          className={cn(
            "relative overflow-hidden rounded-sm border border-dashed px-4 py-5 text-center transition-[background-color,border-color,box-shadow] duration-200 sm:px-10 sm:py-8",
            isLocked
              ? "cursor-not-allowed border-gold/20 bg-gold/[0.01]"
              : isDragActive
                ? "cursor-pointer border-gold bg-gold/[0.06] shadow-gold-glow"
                : "cursor-pointer border-gold/40 bg-bg-panel hover:border-gold hover:bg-bg-card"
          )}
        >
          {!isLocked && <input {...getInputProps()} />}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,var(--color-halo)_0%,transparent_70%)] opacity-60" />
          <div className="relative">
            <UploadIcon className="mx-auto mb-3 hidden text-gold/60 sm:block" />
            <p className="heading-cinzel text-base text-heading mb-2 sm:text-lg">
              {!characterName.trim()
                ? "Enter your character name above to upload"
                : !acceptedPolicy ? "Accept the upload rules above to continue"
                : isDragActive ? "Release to upload" : "Drop your WoWCombatLog.txt"}
            </p>
            <Button variant="solid" size="md" onClick={(event) => { event.stopPropagation(); open(); }} disabled={isLocked}>
              Choose File
            </Button>
            <p className="text-xs text-text-secondary mt-3">TXT, LOG, or ZIP with one log · up to 100 MiB</p>
          </div>
        </div>
      )}

      {state.stage === "idle" && <>
        <details className="border-y border-gold-dim">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-text-secondary">Upload options and file help</summary>
          <div className="space-y-4 pb-4">
            <div className="grid gap-1.5">
              <label htmlFor="upload-guild" className="text-sm text-text-secondary">Guild (optional)</label>
              <input id="upload-guild" maxLength={64} value={guildName} onChange={event => setGuildName(event.target.value)}
                placeholder="PizzaWarriors" className="min-h-11 w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold" />
            </div>
            <p className="text-sm text-text-secondary">Start logging in WoW with <code>/combatlog</code>. After your raid, choose <code>Logs/WoWCombatLog.txt</code> from your game folder.</p>
            {notificationPermission === "default" && <Button type="button" variant="ghost" size="sm" onClick={async () => {
              const permission = await requestUploadNotifications();
              setNotificationPermission(permission);
              setNotificationUnavailable(permission === null);
            }}>Notify me when finished</Button>}
            <p role="status" className="text-sm text-text-secondary">
              {notificationPermission === "granted" ? "Browser notifications are enabled for upload results."
                : notificationPermission === "denied" ? "Notifications are blocked in this browser. Upload results will still appear here."
                  : notificationUnavailable ? "This browser could not enable notifications. Upload results will still appear here." : ""}
            </p>
          </div>
        </details>
      </>}

      {state.stage === "uploading" && (
        <div className="border border-gold/40 rounded-sm bg-bg-panel px-8 py-16 text-center space-y-6" role="progressbar" aria-label="Combat log upload" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress} aria-valuetext={state.message}>
          <Spinner className="mx-auto" />
          <div>
            <p className="heading-cinzel text-lg text-gold-light mb-1" role="status">{state.message}</p>
            {state.stalled ? (
              <p className="text-xs text-warning mt-1">
                The connection was lost. Your report may have been saved.{" "}
                <Link href="/raids" className="text-gold hover:text-gold-light underline">
                  Check raids &rarr;
                </Link>
              </p>
            ) : (
              <p className="text-xs text-text-dim">Large logs can take 1-3 minutes. Keep this tab open.</p>
            )}
          </div>

          <div className="max-w-sm mx-auto space-y-1.5">
            <div className="flex justify-between text-xs text-text-dim tabular-nums">
              <span>{formatPercent(state.progress)}</span>
              <span>
                {formatSeconds(state.elapsed)} elapsed
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-500 ease-out"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {state.stage === "done" && state.result && (
        <UploadResult result={state.result} onReset={reset} />
      )}

      {state.stage === "error" && (
        <div className="border border-danger/30 rounded-sm bg-danger/5 px-6 py-8 text-center" role="alert">
          <p className="heading-cinzel text-base text-danger-light mb-2">Upload Failed</p>
          <p className="text-sm text-text-secondary mb-6">{state.error}</p>
          <Button variant="ghost" size="sm" onClick={reset}>Try Again</Button>
          <p className="mt-4 text-sm text-text-secondary">Still having trouble? <a href={BUG_REPORT_URL} className="text-gold underline">Report a bug</a>. Send security concerns <a href={SECURITY_REPORT_URL} className="text-gold underline">privately</a>.</p>
        </div>
      )}
    </div>
  );
}

export function UploadResult({
  result,
  onReset,
}: {
  result: UploadResponse & { filename: string };
  onReset: () => void;
}) {
  const isDuplicate = result.status === "DUPLICATE";

  return (
    <div className="border border-gold-dim rounded-sm bg-bg-panel divide-y divide-gold-dim">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="heading-cinzel text-sm text-gold-light">
            {isDuplicate ? "Report Already Exists" : "Upload Complete"}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {isDuplicate
              ? "This log already has a raid report."
              : `${formatCountLabel(result.encountersInserted, "encounter")} stored`}
          </p>
        </div>
        <button type="button" onClick={onReset} className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-gold">
          Upload Another
        </button>
      </div>

      {result.publicReportSlug && result.firstSessionSlug && (
        <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
          <Link
            href={`/raids/${result.publicReportSlug}/sessions/${result.firstSessionSlug}`}
            className="inline-flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-sm border border-gold bg-gold/10 text-sm font-semibold text-gold-light hover:bg-gold/20 transition-colors focus-visible:outline-2 focus-visible:outline-gold"
          >
            View raid report <span aria-hidden="true">&rarr;</span>
          </Link>
          <span className="text-xs text-text-dim">Opens the first raid in this log</span>
        </div>
      )}

      {!isDuplicate && (
        <div className="px-5 py-3 flex flex-wrap gap-6 text-sm">
          <Stat label="Encounters found" value={result.encountersFound} />
          <Stat label="Encounters stored" value={result.encountersInserted} highlight />
          <Stat label="Duplicate encounters" value={result.encountersDuplicate} />
        </div>
      )}

      {result.milestones && result.milestones.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-3">
            Achievements recorded
          </p>
          {result.milestones.map((m, index) => (
            <div key={index} className="milestone-banner flex items-center justify-between text-sm flex-wrap gap-2">
              <span>
                <span className="text-gold font-bold">#{formatInteger(m.rank)} when achieved</span>{" "}
                <span className="text-text-secondary">{m.type === "WEEKLY_BEST" ? "weekly best" : "all-time"}</span>{" "}
                <span className="text-text-primary font-semibold">{m.playerName}</span>
                <span className="text-text-secondary"> - {m.bossName} {m.difficulty}</span>
              </span>
              <span className="font-bold tabular-nums text-gold-light">
                {formatRate(m.value)} {m.metric.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {!isDuplicate && result.warnings && result.warnings.length > 0 && (
        <div className="px-5 py-3">
          {result.warnings.map((warning, index) => (
            <p key={index} className="text-xs text-warning">{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-text-dim uppercase tracking-widest">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", highlight ? "text-gold-light" : "text-text-primary")}>
        {formatInteger(value)}
      </div>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="16" width="32" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <path d="M24 8 L24 28 M17 15 L24 8 L31 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("w-10 h-10 rounded-full border-2 border-bg-hover border-t-gold animate-spin", className)} />
  );
}
