"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { syncGuildRosterFromAdmin } from "./actions";
import { formatCountLabel } from "@/lib/utils";

type RefreshResult =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

export function GuildRosterRefreshButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshResult>(null);

  function refreshRoster() {
    setResult(null);
    startTransition(async () => {
      const response = await syncGuildRosterFromAdmin();
      if (!response.ok) {
        setResult({ tone: "error", message: response.error });
        return;
      }

      setResult({
        tone: "success",
        message: `${formatCountLabel(response.count, "member")} refreshed`,
      });
    });
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3" aria-live="polite">
      <button
        type="button"
        onClick={refreshRoster}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-gold/60 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-light transition-colors hover:border-gold hover:bg-gold/15 disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Refreshing roster…" : "Refresh from Warmane"}
      </button>
      {result && (
        <span className={`text-xs font-medium ${result.tone === "success" ? "text-success" : "text-danger"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
