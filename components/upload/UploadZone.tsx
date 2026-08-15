"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/Button";
import type { UploadResponse } from "@/lib/schema";
import { cn } from "@/lib/utils";

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

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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
  const [realmHost, setRealmHost] = useState("warmane");
  const [guildName, setGuildName] = useState("");

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const notification = new Notification(title, { body, icon: "/favicon.ico" });
    setTimeout(() => notification.close(), 8000);
  }, []);

  const processFile = useCallback(async (file: File) => {
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
    void requestNotificationPermission();
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
          "x-filename": file.name,
        },
        body: file,
      });
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
                      ? `${event.msg ?? "Quick classification ready"} (${(quickMs / 1000).toFixed(2)}s after upload)`
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
              sendNotification(
                "Upload complete",
                stored > 0
                  ? `${stored} encounter${stored !== 1 ? "s" : ""} stored`
                  : "No new encounters were found",
              );
            } else if (event.type === "error") {
              throw new Error((event as { msg?: string }).msg ?? "Upload failed");
            }
          }
        }
      }
    } catch (err) {
      if (succeeded) return;
      clearInterval(ticker);
      const msg = String(err instanceof Error ? err.message : err);
      setState({ stage: "error", progress: 0, message: "", elapsed: 0, stalled: false, error: msg });
      sendNotification("Upload failed", msg);
    } finally {
      clearInterval(ticker);
      window.removeEventListener("beforeunload", onBeforeUnload);
    }
  }, [characterName, guildName, onComplete, realmHost, realmName, requestNotificationPermission, sendNotification]);

  const isLocked = !characterName.trim();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
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
    disabled: state.stage === "uploading" || isLocked,
  });

  const lockedProps = {
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDragEnter: (event: React.DragEvent) => event.preventDefault(),
    onDrop: (event: React.DragEvent) => event.preventDefault(),
    onClick: (event: React.MouseEvent) => event.preventDefault(),
  };

  const reset = () => setState({ stage: "idle", progress: 0, message: "", elapsed: 0, stalled: false });

  return (
    <div className="space-y-4">
      {state.stage === "idle" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr]">
          <div className="grid gap-1.5">
            <label className="text-xs text-text-secondary uppercase tracking-wide">
              Character <span className="text-danger">*</span>
            </label>
            <input
              value={characterName}
              onChange={(event) => setCharacterName(event.target.value)}
              placeholder="Your character name"
              className="w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Realm</label>
            <select
              value={realmName}
              onChange={(event) => setRealmName(event.target.value)}
              className="w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold"
            >
              <option value="Icecrown">Icecrown</option>
              <option value="Lordaeron">Lordaeron</option>
              <option value="Onyxia">Onyxia</option>
              <option value="Blackrock">Blackrock</option>
            </select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Server</label>
            <select
              value={realmHost}
              onChange={(event) => setRealmHost(event.target.value)}
              className="w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold"
            >
              <option value="warmane">Warmane</option>
            </select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Guild</label>
            <input
              value={guildName}
              onChange={(event) => setGuildName(event.target.value)}
              placeholder="PizzaWarriors (optional)"
              className="w-full rounded-sm border border-gold-dim bg-bg-card px-3 py-2 text-sm text-text-primary outline-hidden transition-colors focus:border-gold"
            />
          </div>
        </div>
      )}

      {state.stage === "idle" && (
        <div
          {...(isLocked ? lockedProps : getRootProps())}
          className={cn(
            "relative overflow-hidden rounded-sm border border-dashed px-4 py-12 text-center transition-[background-color,border-color,box-shadow] duration-200 sm:px-10 sm:py-16",
            isLocked
              ? "cursor-not-allowed border-gold/20 bg-gold/[0.01] opacity-40"
              : isDragActive
                ? "cursor-pointer border-gold bg-gold/[0.06] shadow-gold-glow"
                : "cursor-pointer border-gold/40 bg-gold/[0.02] hover:border-gold hover:bg-gold/[0.04]"
          )}
        >
          {!isLocked && <input {...getInputProps()} />}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(180,140,60,0.05)_0%,transparent_70%)]" />
          <div className="relative">
            <UploadIcon className="mx-auto mb-4 text-gold/60" />
            <p className="heading-cinzel text-lg text-gold-light mb-2">
              {!characterName.trim()
                ? "Enter your character name above to upload"
                : isDragActive ? "Release to upload" : "Drop your WoWCombatLog.txt"}
            </p>
            <p className="text-sm text-text-secondary mb-6">
              WotLK - Naxxramas through Ruby Sanctum - All processing server-side
            </p>
            <Button variant="gold" size="md" onClick={(event) => event.stopPropagation()} disabled={!characterName.trim()}>
              Choose File
            </Button>
            <p className="text-xs text-text-dim mt-3">TXT, LOG, or ZIP up to 100 MiB compressed</p>
          </div>
        </div>
      )}

      {state.stage === "uploading" && (
        <div className="border border-gold/40 rounded-sm bg-bg-panel px-8 py-16 text-center space-y-6">
          <Spinner className="mx-auto" />
          <div>
            <p className="heading-cinzel text-lg text-gold-light mb-1">{state.message}</p>
            {state.stalled ? (
              <p className="text-xs text-warning mt-1">
                Stream connection lost - your data may have saved successfully.{" "}
                <Link href="/raids" className="text-gold hover:text-gold-light underline">
                  Check raids &rarr;
                </Link>
              </p>
            ) : (
              <p className="text-xs text-text-dim">Large logs can take 1-3 minutes - do not close this tab</p>
            )}
          </div>

          <div className="max-w-sm mx-auto space-y-1.5">
            <div className="flex justify-between text-xs text-text-dim tabular-nums">
              <span>{state.progress}%</span>
              <span>
                {state.elapsed < 60
                  ? `${state.elapsed}s elapsed`
                  : `${Math.floor(state.elapsed / 60)}m ${state.elapsed % 60}s elapsed`}
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
        <div className="border border-danger/30 rounded-sm bg-danger/5 px-6 py-8 text-center">
          <p className="heading-cinzel text-base text-danger mb-2">Upload Failed</p>
          <p className="text-sm text-text-secondary mb-6">{state.error}</p>
          <Button variant="ghost" size="sm" onClick={reset}>Try Again</Button>
        </div>
      )}
    </div>
  );
}

function UploadResult({
  result,
  onReset,
}: {
  result: UploadResponse & { filename: string };
  onReset: () => void;
}) {
  const isDuplicate = result.status === "DUPLICATE";

  return (
    <div className="border border-gold-dim rounded-sm bg-bg-panel divide-y divide-gold-dim">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="heading-cinzel text-sm text-gold-light">
            {isDuplicate ? "Already Parsed" : "Upload Complete"}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {isDuplicate
              ? "This log was already parsed and the raid data is ready"
              : `${result.encountersInserted} encounter${result.encountersInserted !== 1 ? "s" : ""} stored`}
          </p>
        </div>
        <button onClick={onReset} className="text-xs text-text-dim hover:text-text-secondary uppercase tracking-wide">
          Upload Another
        </button>
      </div>

      {isDuplicate && result.publicReportSlug && result.firstSessionSlug && (
        <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
          <Link
            href={`/raids/${result.publicReportSlug}/sessions/${result.firstSessionSlug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm border border-gold/60 bg-gold/5 text-sm text-gold-light hover:border-gold hover:bg-gold/10 transition-colors"
          >
            View your raid report &rarr;
          </Link>
          <span className="text-xs text-text-dim">Opens the first raid in this log</span>
        </div>
      )}

      {!isDuplicate && (
        <div className="px-5 py-3 flex flex-wrap gap-6 text-sm">
          <Stat label="Found" value={result.encountersFound} />
          <Stat label="Stored" value={result.encountersInserted} highlight />
          <Stat label="Duplicate" value={result.encountersDuplicate} />
        </div>
      )}

      {result.milestones && result.milestones.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-3">
            Milestones Achieved
          </p>
          {result.milestones.map((m, index) => (
            <div key={index} className="milestone-banner flex items-center justify-between text-sm flex-wrap gap-2">
              <span>
                <span className="text-gold font-bold">#{m.rank}</span>{" "}
                <span className="text-text-primary font-semibold">{m.playerName}</span>
                <span className="text-text-secondary"> - {m.bossName} {m.difficulty}</span>
              </span>
              <span className="font-bold tabular-nums text-gold-light">
                {m.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {m.metric}
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
        {value}
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
