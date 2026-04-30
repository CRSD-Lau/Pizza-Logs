"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { seedArmoryGearCache } from "./actions";

export function SeedGearCacheButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSeed() {
    setPhase("running");
    setMessage("");

    const result = await seedArmoryGearCache(100);
    if (result.ok) {
      setMessage(`Attempted ${result.attempted}; cached ${result.cached}; failed ${result.failed}.`);
      setPhase("done");
      router.refresh();
      return;
    }

    setMessage(result.error);
    setPhase("error");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleSeed}
        disabled={phase === "running"}
        className="px-4 py-2 text-sm border border-gold-dim text-gold hover:border-gold hover:text-gold-light disabled:cursor-not-allowed disabled:opacity-60 rounded transition-colors"
      >
        {phase === "running" ? "Seeding gear..." : "Seed Gear Cache"}
      </button>
      {message && (
        <span className={phase === "error" ? "text-sm text-danger" : "text-sm text-text-secondary"}>
          {message}
        </span>
      )}
    </div>
  );
}
