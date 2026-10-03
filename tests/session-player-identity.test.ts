import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import React from "react";
import { renderPage } from "./helpers/render-page";
import { CLASS_COLORS } from "../lib/constants/classes";
import { getPlayerClassMeta } from "../lib/player-class";

const startedAt = new Date("2026-09-04T23:04:10Z");
const route = { sessionIndex: 0, startedAt, dateSlug: "2026-09-04", slug: "2026-09-04", dateOrdinal: 1 };

function participant(name: string, storedClass: string, dps: number, totalDamage: number) {
  return {
    id: `participant-${name.toLowerCase()}`,
    player: { id: `player-${name.toLowerCase()}`, name, class: storedClass },
    dps,
    hps: 0,
    aps: 0,
    totalDamage,
    totalHealing: 0,
    totalAbsorbs: 0,
    damageTaken: 321,
    role: "DPS",
    spec: name === "Dizguy" ? "Demonology" : "Unknown",
    deaths: 0,
    critPct: 12.5,
  };
}

const dizguy = participant("Dizguy", "Warrior", 12_345, 1_234_500);
const observedWarlock = participant("Otherlock", "Mage", 9_876, 987_600);
const actualWarrior = participant("Actualwarrior", "Warrior", 8_765, 876_500);
const encounters = [0, 1].map(index => ({
  id: `encounter-${index}`,
  sessionIndex: 0,
  outcome: "KILL",
  difficulty: "25N",
  startedAt: new Date(startedAt.getTime() + index * 60_000),
  endedAt: new Date(startedAt.getTime() + (index + 1) * 60_000),
  durationMs: 60_000,
  durationSeconds: 60,
  boss: { name: index === 0 ? "Lord Marrowgar" : "Lady Deathwhisper", slug: `boss-${index}`, raid: "Icecrown Citadel" },
  participants: [dizguy, observedWarlock, actualWarrior],
}));

type Observation = {
  characterName: string;
  realm: string;
  className: string;
  observedAt: string;
  source: "armory";
  sourceUrl: string;
};

const observation = (characterName: string, realm: string, className: string, observedAt = "2026-09-05T02:00:00Z"): Observation => ({
  characterName,
  realm,
  className,
  observedAt,
  source: "armory",
  sourceUrl: `https://armory.warmane.com/character/${characterName}/${realm}/summary`,
});

let observations: Observation[] = [
  observation("Dizguy", "Lordaeron", "Warlock"),
  observation("Dizguy", "Icecrown", "Mage", "2026-09-06T02:00:00Z"),
  observation("Otherlock", "Lordaeron", "Warlock"),
  observation("Actualwarrior", "Lordaeron", "Warrior"),
];
const identityObservationQueries: Array<{ name?: string; realm?: string; names?: readonly string[] }> = [];

const db = {
  encounter: { findMany: async () => encounters },
  upload: { findUnique: async () => ({ realm: { name: "Lordaeron" }, guild: { name: "Pizza Warriors" } }) },
  guildRosterMember: { findFirst: async () => null },
};

const plainText = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  const loader = Module as typeof Module & {
    _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string;
  };
  const originalResolve = loader._resolveFilename;
  const exportsByName: Record<string, unknown> = {
    "next/navigation": {
      usePathname: () => "/raids/identity-report/sessions/2026-09-04/players/Dizguy",
      useSearchParams: () => new URLSearchParams(),
      useRouter: () => ({ replace: () => { throw new Error("Static identity fixture must not navigate"); } }),
      notFound: () => { throw new Error("Unexpected notFound in session player identity fixture"); },
      permanentRedirect: () => { throw new Error("Unexpected redirect in session player identity fixture"); },
    },
    "@/lib/db": { db },
    "@/lib/raid-session-routing.server": {
      resolveRaidSession: async () => ({
        route,
        uploadId: "identity-upload",
        publicSlug: "identity-report",
        isLegacyUploadId: false,
        isLegacyIndex: false,
      }),
    },
    "@/lib/player-directory": {
      getStoredPlayerIdentityObservations: async (name?: string, realm?: string, names?: readonly string[]) => {
        identityObservationQueries.push({ name, realm, names });
        return observations;
      },
    },
    "@/components/players/PlayerAvatar": {
      PlayerAvatar: ({ characterClass, fallbackIconUrl }: { characterClass?: string | null; fallbackIconUrl?: string | null }) => React.createElement("div", {
        "data-testid": "player-avatar",
        "data-player-class": characterClass ?? "Unknown",
        "data-fallback-icon": fallbackIconUrl ?? "none",
      }),
    },
    "@/components/charts/SessionLineChart": {
      SessionLineChart: ({ players }: { players: Array<{ name: string }> }) => React.createElement("div", {
        "data-testid": "session-line-chart",
        "data-player-names": players.map(player => player.name).join(","),
      }),
    },
  };
  const mocks = Object.fromEntries(Object.entries(exportsByName).map(([name, exports], index) => {
    const filename = path.join(process.cwd(), "tests", "__mocks__", `session-player-identity-${index}.js`);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
    return [name, filename];
  }));

  loader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (mocks[request]) return mocks[request];
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  try {
    const { default: SessionPlayerPage } = require("../app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page") as typeof import("../app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page");
    const props = {
      params: Promise.resolve({ id: "identity-report", sessionIdx: route.slug, playerName: "Dizguy" }),
      searchParams: Promise.resolve({}),
    };

    const resolved = await renderPage(await SessionPlayerPage(props));
    const resolvedText = plainText(resolved);
    assert.deepEqual(identityObservationQueries.at(-1), {
      name: undefined,
      realm: "Lordaeron",
      names: ["Dizguy", "Otherlock", "Actualwarrior"],
    }, "Identity observations are bounded to this realm and the unique session participants");
    assert.match(resolved, /data-player-class="Warlock"/, "The avatar uses the exact-realm observed class");
    assert.ok(resolved.includes("classicon_warlock"), "The class icon agrees with the resolved Warlock identity");
    assert.ok(resolved.includes(`style="color:${CLASS_COLORS.Warlock}"`), "The player name color agrees with the resolved Warlock identity");
    assert.ok(resolvedText.includes("Warlock Demonology"), "The header reports the resolved class beside the recorded spec");
    assert.ok(resolvedText.includes("Comparing Dizguy vs Otherlock (Warlock)"), "Class comparisons use resolved identities for every participant");
    assert.match(resolved, /data-player-names="Dizguy,Otherlock"/, "A raw Warrior is excluded while a raw Mage resolved as Warlock is included");
    assert.ok(resolvedText.includes("Best DPS 12.35K single pull"), "Stored numeric performance remains unchanged by identity resolution");
    assert.ok(resolvedText.includes("Damage 1.23M 12.35K DPS"), "Encounter totals and rates remain unchanged");

    observations = [
      observation("Dizguy", "Lordaeron", "Warlock"),
      observation("Dizguy", "Lordaeron", "Mage"),
      observation("Otherlock", "Lordaeron", "Warlock"),
      observation("Actualwarrior", "Lordaeron", "Warrior"),
    ];
    const conflicted = await renderPage(await SessionPlayerPage(props));
    const conflictedText = plainText(conflicted);
    assert.match(conflicted, /data-player-class="Unknown"/, "A same-time class conflict remains unknown instead of falling back to the raw roster class");
    assert.match(conflicted, /data-fallback-icon="none"/, "A conflicted identity does not display the raw Warrior icon");
    assert.ok(conflicted.includes(`style="color:${getPlayerClassMeta(null).textColor}"`), "The name color also reflects the unknown identity");
    assert.ok(!conflictedText.includes("Warrior Demonology"), "The raw Warrior class does not leak into a conflicted header");
    assert.ok(!conflictedText.includes("Comparing Dizguy"), "An unknown subject class has no raw-class comparison group");
    assert.match(conflicted, /data-player-names="Dizguy"/);
  } finally {
    loader._resolveFilename = originalResolve;
    for (const filename of Object.values(mocks)) delete require.cache[filename];
  }

  console.log("session-player-identity tests passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
