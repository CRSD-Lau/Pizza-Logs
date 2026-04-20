"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { UploadResponse } from "@/lib/schema";

interface UploadZoneProps {
  onComplete?: (result: UploadResponse & { filename: string }) => void;
}

type Stage = "idle" | "uploading" | "done" | "error";

interface UploadState {
  stage:    Stage;
  progress: number; // 0-100
  message:  string;
  elapsed:  number; // seconds
  stalled:  boolean; // true if no SSE event for >90s (stream likely dropped)
  result?:  UploadResponse & { filename: string };
  error?:   string;
}

export function UploadZone({ onComplete }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>({
    stage:    "idle",
    progress: 0,
    message:  "",
    elapsed:  0,
    stalled:  false,
  });
  const lastEventAt = useRef<number>(Date.now());

  // Form metadata state
  const [characterName, setCharacterName] = useState("");
  const [realmName, setRealmName]         = useState("Lordaeron");
  const [realmHost, setRealmHost]         = useState("warmane");
  const [guildName, setGuildName]         = useState("");

  // Request notification permission once when the user first drops a file
  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    // Auto-close after 8s
    setTimeout(() => n.close(), 8000);
  }, []);

  const processFile = useCallback(async (file: File) => {
    void requestNotificationPermission();
    const startTime = Date.now();

    lastEventAt.current = Date.now();
    setState({ stage: "uploading", progress: 2, message: "Uploading file…", elapsed: 0, stalled: false });

    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);

    // Ticker: update elapsed + detect stalled stream (no event for >90s)
    const STALL_THRESHOLD = 90_000;
    const ticker = setInterval(() => {
      setState(s => {
        if (s.stage !== "uploading") return s;
        const stalled = (Date.now() - lastEventAt.current) > STALL_THRESHOLD;
        return { ...s, elapsed: Math.floor((Date.now() - startTime) / 1000), stalled };
      });
    }, 1000);

    const params = new URLSearchParams({
      uploaderName: characterName.trim(),
      realmName, realmHost, filename: file.name, fileSize: String(file.size),
    });
    if (guildName.trim()) params.set("guildName", guildName.trim());

    const form = new FormData();
    form.append("file", file);

    let succeeded = false;

    try {
      const res = await fetch(`/api/upload?${params}`, { method: "POST", body: form });
      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let event: { type: string; pct?: number; msg?: string; result?: UploadResponse; };
            try { event = JSON.parse(line.slice(6)); }
            catch { continue; }

            const elapsed = Math.floor((Date.now() - startTime) / 1000);

            if (event.type === "progress" && event.pct !== undefined) {
              lastEventAt.current = Date.now();
              setState(s => s.stage === "uploading"
                ? { ...s, progress: event.pct!, message: event.msg ?? "", elapsed, stalled: false }
                : s);

            } else if (event.type === "complete" && event.result) {
              succeeded = true;
              clearInterval(ticker);
              const result = { ...event.result, filename: file.name };
              setState({ stage: "done", progress: 100, message: "Done", elapsed, stalled: false, result });
              onComplete?.(result);
              const stored = result.encountersInserted;
              sendNotification(
                "✅ Upload complete",
                stored > 0
                  ? `${stored} encounter${stored !== 1 ? "s" : ""} stored from ${file.name}`
                  : `${file.name} processed — no new encounters`,
              );

            } else if (event.type === "error") {
              throw new Error((event as { msg?: string }).msg ?? "Upload failed");
            }
          }
        }
      }
    } catch (err) {
      // Ignore stream close errors that arrive after a successful complete event
      if (succeeded) return;
      clearInterval(ticker);
      const msg = String(err instanceof Error ? err.message : err);
      setState({ stage: "error", progress: 0, message: "", elapsed: 0, stalled: false, error: msg });
      sendNotification("❌ Upload failed", msg);
    } finally {
      clearInterval(ticker);
      window.removeEventListener("beforeunload", onBeforeUnload);
    }
  }, [characterName, realmName, realmHost, guildName, onComplete, requestNotificationPermission, sendNotification]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => {
      if (files[0]) processFile(files[0]);
    },
    accept: { "text/plain": [".txt", ".log"] },
    multiple: false,
    disabled: state.stage === "uploading" || !characterName.trim(),
  });

  const reset = () => setState({ stage: "idle", progress: 0, message: "", elapsed: 0, stalled: false });

  return (
    <div className="space-y-4">
      {/* Metadata inputs */}
      {state.stage === "idle" && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">
              Character <span className="text-danger">*</span>
            </label>
            <input
              value={characterName}
              onChange={e => setCharacterName(e.target.value)}
              placeholder="Your character name"
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold transition-colors w-44"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Realm</label>
            <select
              value={realmName}
              onChange={e => setRealmName(e.target.value)}
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold transition-colors"
            >
              <option value="Icecrown">Icecrown</option>
              <option value="Lordaeron">Lordaeron</option>
              <option value="Onyxia">Onyxia</option>
              <option value="Blackrock">Blackrock</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Server</label>
            <select
              value={realmHost}
              onChange={e => setRealmHost(e.target.value)}
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold transition-colors"
            >
              <option value="warmane">Warmane</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Guild</label>
            <input
              value={guildName}
              onChange={e => setGuildName(e.target.value)}
              placeholder="PizzaWarriors (optional)"
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold transition-colors w-48"
            />
          </div>
        </div>
      )}

      {/* Drop zone */}
      {state.stage === "idle" && (
        <div
          {...getRootProps()}
          className={cn(
            "relative border border-dashed rounded-sm px-10 py-16 text-center transition-all duration-200 overflow-hidden",
            !characterName.trim()
              ? "cursor-not-allowed opacity-40 border-gold/20 bg-[rgba(180,140,60,0.01)]"
              : isDragActive
                ? "cursor-pointer border-gold bg-[rgba(180,140,60,0.06)] shadow-gold-glow"
                : "cursor-pointer border-gold/40 bg-[rgba(180,140,60,0.02)] hover:border-gold hover:bg-[rgba(180,140,60,0.04)]"
          )}
        >
          <input {...getInputProps()} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(180,140,60,0.05)_0%,transparent_70%)]" />
          <div className="relative">
            <UploadIcon className="mx-auto mb-4 text-gold/60" />
            <p className="heading-cinzel text-lg text-gold-light mb-2">
              {!characterName.trim()
                ? "Enter your character name above to upload"
                : isDragActive ? "Release to upload" : "Drop your WoWCombatLog.txt"}
            </p>
            <p className="text-sm text-text-secondary mb-6">
              WotLK · Naxxramas through Ruby Sanctum · All processing server-side
            </p>
            <Button variant="gold" size="md" onClick={e => e.stopPropagation()} disabled={!characterName.trim()}>
              Choose File
            </Button>
            <p className="text-xs text-text-dim mt-3">Supports files up to 1 GB</p>
          </div>
        </div>
      )}

      {/* Uploading / progress */}
      {state.stage === "uploading" && (
        <div className="border border-gold/40 rounded bg-bg-panel px-8 py-16 text-center space-y-6">
          <Spinner className="mx-auto" />
          <div>
            <p className="heading-cinzel text-lg text-gold-light mb-1">{state.message}</p>
            {state.stalled ? (
              <p className="text-xs text-warning mt-1">
                Stream connection lost — your data may have saved successfully.{" "}
                <Link href="/uploads" className="text-gold hover:text-gold-light underline">
                  Check History →
                </Link>
              </p>
            ) : (
              <p className="text-xs text-text-dim">Large logs can take 1–3 minutes — do not close this tab</p>
            )}
          </div>
          <div className="max-w-sm mx-auto space-y-1.5">
            <div className="flex justify-between text-[11px] text-text-dim tabular-nums">
              <span>{state.progress}%</span>
              <span>{state.elapsed < 60
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

      {/* Result */}
      {state.stage === "done" && state.result && (
        <UploadResult result={state.result} onReset={reset} />
      )}

      {/* Error */}
      {state.stage === "error" && (
        <div className="border border-danger/30 rounded bg-danger/5 px-6 py-8 text-center">
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
    <div className="border border-gold-dim rounded bg-bg-panel divide-y divide-gold-dim">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <p className="heading-cinzel text-sm text-gold-light">{result.filename}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {isDuplicate ? "Duplicate file — already uploaded" : `${result.encountersInserted} encounter${result.encountersInserted !== 1 ? "s" : ""} stored`}
          </p>
        </div>
        <button onClick={onReset} className="text-xs text-text-dim hover:text-text-secondary uppercase tracking-wide">
          Upload Another
        </button>
      </div>

      {/* Stats row */}
      {!isDuplicate && (
        <div className="px-5 py-3 flex flex-wrap gap-6 text-sm">
          <Stat label="Found"     value={result.encountersFound} />
          <Stat label="Stored"    value={result.encountersInserted} highlight />
          <Stat label="Duplicate" value={result.encountersDuplicate} />
        </div>
      )}

      {/* Milestones */}
      {result.milestones && result.milestones.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-3">
            ✦ Milestones Achieved
          </p>
          {result.milestones.map((m, i) => (
            <div key={i} className="milestone-banner flex items-center justify-between text-sm">
              <span>
                <span className="text-gold font-bold">
                  #{m.rank}
                </span>
                {" "}
                <span className="text-text-primary font-semibold">{m.playerName}</span>
                <span className="text-text-secondary"> — {m.bossName} {m.difficulty}</span>
              </span>
              <span className="font-bold tabular-nums text-gold-light">
                {m.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {m.metric}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="px-5 py-3">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-warning">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-text-dim uppercase tracking-widest">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", highlight ? "text-gold-light" : "text-text-primary")}>
        {value}
      </div>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="16" width="32" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
      <path d="M24 8 L24 28 M17 15 L24 8 L31 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("w-10 h-10 rounded-full border-2 border-bg-hover border-t-gold animate-spin", className)}
    />
  );
}
