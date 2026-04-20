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
        className="px-4 py-2 text-sm border border-danger/40 text-danger/80 hover:border-danger hover:text-danger rounded transition-colors"
      >
        Clear Database
      </button>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-warning">Wipes all uploads, encounters, players. Sure?</span>
        <button
          onClick={handleConfirm}
          className="px-3 py-1.5 text-sm border border-danger text-danger hover:bg-danger/10 rounded transition-colors"
        >
          Yes, wipe it
        </button>
        <button
          onClick={() => setPhase("idle")}
          className="px-3 py-1.5 text-sm text-text-dim hover:text-text-secondary transition-colors"
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
    return <span className="text-sm text-success">✓ Database cleared</span>;
  }

  // error
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-danger">{error}</span>
      <button onClick={() => setPhase("idle")} className="text-sm text-text-dim hover:text-text-secondary">
        Dismiss
      </button>
    </div>
  );
}
