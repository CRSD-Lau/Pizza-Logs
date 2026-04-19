"use client";

import { useCallback, useState } from "react";
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
  result?:  UploadResponse & { filename: string };
  error?:   string;
}

export function UploadZone({ onComplete }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>({
    stage:    "idle",
    progress: 0,
    message:  "",
  });

  // Form metadata state
  const [realmName, setRealmName] = useState("Lordaeron");
  const [realmHost, setRealmHost] = useState("warmane");
  const [guildName, setGuildName] = useState("");

  const processFile = useCallback(async (file: File) => {
    setState({ stage: "uploading", progress: 10, message: "Reading file…" });

    const params = new URLSearchParams({
      realmName,
      realmHost,
      filename: file.name,
      fileSize: String(file.size),
    });
    if (guildName.trim()) params.set("guildName", guildName.trim());

    const form = new FormData();
    form.append("file", file);

    setState(s => ({ ...s, progress: 20, message: "Sending to parser…" }));

    try {
      const res = await fetch(`/api/upload?${params}`, { method: "POST", body: form });

      setState(s => ({ ...s, progress: 80, message: "Processing encounters…" }));

      const data = await res.json() as UploadResponse;
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const result = { ...data, filename: file.name };
      setState({ stage: "done", progress: 100, message: "Done", result });
      onComplete?.(result);
    } catch (err) {
      setState({
        stage:    "error",
        progress: 0,
        message:  "",
        error:    String(err instanceof Error ? err.message : err),
      });
    }
  }, [realmName, realmHost, guildName, onComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => {
      if (files[0]) processFile(files[0]);
    },
    accept: { "text/plain": [".txt", ".log"] },
    multiple: false,
    disabled: state.stage === "uploading",
  });

  const reset = () => setState({ stage: "idle", progress: 0, message: "" });

  return (
    <div className="space-y-4">
      {/* Metadata inputs */}
      {state.stage === "idle" && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Realm</label>
            <input
              value={realmName}
              onChange={e => setRealmName(e.target.value)}
              placeholder="Lordaeron"
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold-dim w-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Server</label>
            <select
              value={realmHost}
              onChange={e => setRealmHost(e.target.value)}
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold-dim"
            >
              <option value="warmane">Warmane</option>
              <option value="blizzard">Blizzard</option>
              <option value="kronos">Kronos</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary uppercase tracking-wide">Guild</label>
            <input
              value={guildName}
              onChange={e => setGuildName(e.target.value)}
              placeholder="PizzaWarriors (optional)"
              className="bg-bg-card border border-gold-dim rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-gold-dim w-48"
            />
          </div>
        </div>
      )}

      {/* Drop zone */}
      {state.stage === "idle" && (
        <div
          {...getRootProps()}
          className={cn(
            "relative border border-dashed rounded-sm px-10 py-16 text-center cursor-pointer transition-all duration-200",
            "bg-[rgba(180,140,60,0.02)] overflow-hidden",
            isDragActive
              ? "border-gold bg-[rgba(180,140,60,0.06)] shadow-gold-glow"
              : "border-gold/40 hover:border-gold hover:bg-[rgba(180,140,60,0.04)]"
          )}
        >
          <input {...getInputProps()} />
          {/* Glow overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(180,140,60,0.05)_0%,transparent_70%)]" />
          <div className="relative">
            <UploadIcon className="mx-auto mb-4 text-gold/60" />
            <p className="heading-cinzel text-lg text-gold-light mb-2">
              {isDragActive ? "Release to upload" : "Drop your WoWCombatLog.txt"}
            </p>
            <p className="text-sm text-text-secondary mb-6">
              WotLK · Naxxramas through Ruby Sanctum · All processing server-side
            </p>
            <Button variant="gold" size="md" onClick={e => e.stopPropagation()}>
              Choose File
            </Button>
            <p className="text-xs text-text-dim mt-3">Supports files up to 1 GB</p>
          </div>
        </div>
      )}

      {/* Uploading / progress */}
      {state.stage === "uploading" && (
        <div className="border border-gold-dim rounded bg-bg-panel px-8 py-12 text-center">
          <Spinner className="mx-auto mb-4" />
          <p className="heading-cinzel text-sm text-text-secondary">{state.message}</p>
          <div className="mt-4 h-1 rounded-full bg-bg-hover overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${state.progress}%` }}
            />
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
