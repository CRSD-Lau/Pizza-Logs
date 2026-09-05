"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearArmoryGearCache } from "./actions";
import { formatCountLabel } from "@/lib/utils";

type Phase = "idle" | "confirm" | "clearing" | "done" | "error";

export function ClearGearCacheButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function clearCache() {
    setPhase("clearing");
    const result = await clearArmoryGearCache();

    if (!result.ok) {
      setMessage(result.error);
      setPhase("error");
      return;
    }

    setMessage(`${formatCountLabel(result.deleted, "snapshot")} cleared`);
    setPhase("done");
    router.refresh();
  }

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => setPhase("confirm")}
        className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-warning/50 px-4 py-2 text-sm font-semibold text-warning transition-colors hover:border-warning hover:bg-warning/10"
      >
        Clear Gear Cache
      </button>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="max-w-md rounded-sm border border-warning/40 bg-warning/5 p-3">
        <p className="text-sm text-text-secondary">
          Delete every cached gear snapshot? Quick looks will request each character from Warmane again.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearCache}
            className="inline-flex min-h-11 items-center rounded-sm border border-danger px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            Yes, clear snapshots
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="inline-flex min-h-11 items-center px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "clearing") {
    return <span className="text-sm text-text-dim animate-pulse">Clearing snapshots…</span>;
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("idle")}
      className={`min-h-11 text-sm font-medium ${phase === "done" ? "text-success" : "text-danger"}`}
    >
      {message} · Dismiss
    </button>
  );
}
