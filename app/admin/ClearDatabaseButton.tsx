"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearDatabase } from "./actions";

export function ClearDatabaseButton() {
  const router = useRouter();
  const [phase, setPhase]   = useState<"idle" | "confirm" | "clearing" | "done" | "error">("idle");
  const [error, setError]   = useState("");

  async function handleConfirm() {
    setPhase("clearing");
    const result = await clearDatabase();
    if (result.ok) {
      setPhase("done");
      // Refresh page stats after a short delay
      setTimeout(() => { router.refresh(); setPhase("idle"); }, 2000);
    } else {
      setError(result.error);
      setPhase("error");
    }
  }

  if (phase === "idle") {
    return (
      <button
        onClick={() => setPhase("confirm")}
        className="min-h-11 px-4 py-2 text-sm border border-danger/40 text-danger-light hover:border-danger rounded-sm transition-colors"
      >
        Clear Upload Data
      </button>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="flex max-w-2xl flex-wrap items-center gap-3 rounded-sm border border-danger/30 bg-danger/5 p-4">
        <span className="text-sm text-warning max-w-md">
          This will delete uploaded logs, parsed raids, encounters, combat events, and upload analytics.
          Cached Warmane gear, player profiles, guild roster, and item template data will be retained.
        </span>
        <button
          onClick={handleConfirm}
          className="min-h-11 px-3 py-1.5 text-sm border border-danger text-danger-light hover:bg-danger/10 rounded-sm transition-colors"
        >
          Yes, clear uploads
        </button>
        <button
          onClick={() => setPhase("idle")}
          className="min-h-11 px-3 py-1.5 text-sm text-text-dim hover:text-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (phase === "clearing") {
    return <span className="text-sm text-text-dim animate-pulse">Clearing…</span>;
  }

  if (phase === "done") {
    return <span className="text-sm text-success">✓ Upload data cleared</span>;
  }

  // error
  return (
    <div className="flex max-w-2xl flex-wrap items-center gap-3">
      <span className="break-words text-sm text-danger-light">{error}</span>
      <button onClick={() => setPhase("idle")} className="min-h-11 px-3 text-sm text-text-dim hover:text-text-secondary">
        Dismiss
      </button>
    </div>
  );
}
