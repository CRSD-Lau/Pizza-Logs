import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPage } from "./helpers/render-page";

let attempts: Array<{ id: string; dps: number; hps: number; aps: number; totalDamage: number; totalHealing: number; totalAbsorbs: number; damageTaken: number; deaths: number; role: string; spec: string | null; encounter: {
  id: string; startedAt: Date; outcome: string; difficulty: string; durationSeconds: number; durationMs: number;
  boss: { name: string; slug: string; raid: string }; participants: Array<{ deaths: number }>;
} }> = [];
const bossEncounters: Array<{
  id: string; outcome: string; difficulty: string; startedAt: Date;
  durationSeconds: number; durationMs: number | null; participants: never[];
}> = [];
const boss = { id: "synthetic-boss", name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel", encounters: bossEncounters };
const textContent = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
let profileSearch: Record<string, string> = {};
const mocks: Record<string, unknown> = {
  "next/navigation": {
    usePathname: () => "/players/Synthetic",
    useSearchParams: () => new URLSearchParams(profileSearch),
    notFound: () => { throw new Error("not found"); },
  },
  "@/components/players/PlayerRaidComparisonSection": { PlayerRaidComparisonSection: () => null, PlayerRaidComparisonSkeleton: () => null },
  "@/lib/db": { db: {
    player: { findFirst: async () => ({ name: "Synthetic", class: "Mage", realm: { name: "Lordaeron" }, milestones: [] }) },
    guildRosterMember: { findFirst: async () => null }, participant: { findMany: async () => attempts },
    boss: { findUnique: async () => boss, findMany: async () => [boss] },
    encounter: { findMany: async () => [] },
  } },
  "@/lib/warmane-armory": { getWarmaneCharacterGear: async () => ({ ok: false }) },
  "@/lib/player-directory": { getStoredPlayerIdentity: async () => ({ className: "Mage", raceName: null, guildName: null }) },
  "@/lib/warmane-guild-roster": { DEFAULT_GUILD_NAME: "Synthetic", DEFAULT_GUILD_REALM: "Lordaeron" },
  "@/components/players/PlayerGearSection": { PlayerGearSection: () => null, PlayerGearSectionSkeleton: () => null },
};

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  const mockPaths = Object.fromEntries(Object.entries(mocks).map(([name, exports], index) => {
    const filename = path.join(process.cwd(), "tests", "__mocks__", `public-numeric-${index}.js`);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
    return [name, filename];
  }));
  loader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (mockPaths[request]) return mockPaths[request];
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  try {
    const { LeaderboardBar } = require("../components/charts/LeaderboardBar") as typeof import("../components/charts/LeaderboardBar");
    const entry = { rank: 1, playerName: "SyntheticFirst", value: 13931.24, bossName: "Lord Marrowgar", bossSlug: "lord-marrowgar", difficulty: "25N", encounterId: "attempt", date: "2026-01-01T23:59:59Z" };
    const leaders = renderToStaticMarkup(React.createElement(LeaderboardBar, { metric: "dps", entries: [entry, { ...entry, rank: 2, playerName: "SyntheticSecond", value: 13931.21 }] }));
    assert.match(leaders, /<ol[^>]+aria-label="DPS positions"/);
    assert.equal((leaders.match(/<li /g) ?? []).length, 2);
    assert.match(leaders, /Position /);
    assert.match(leaders, /13\.93K/);
    assert.match(leaders, /Jan 1, 2026/);
    assert.doesNotMatch(leaders, /13,931\.2/);
    assert.ok(leaders.indexOf("SyntheticFirst") < leaders.indexOf("SyntheticSecond"), "Display rounding must not reorder positions or turn rounded-equal values into analytical ties");

    const { SessionLineChart } = require("../components/charts/SessionLineChart") as typeof import("../components/charts/SessionLineChart");
    const chart = renderToStaticMarkup(React.createElement(SessionLineChart, {
      metric: "DPS", players: [{ name: "Synthetic", isSubject: true, color: "#ffffff" }],
      data: [{ bossName: "Large output", Synthetic: 12345678.9 }, { bossName: "Billion output", Synthetic: 1234567890 }, { bossName: "Zero output", Synthetic: 0 }, { bossName: "Absent player", Synthetic: null }],
    }));
    assert.match(chart, /View DPS chart values/);
    assert.match(chart, /12\.35M/);
    assert.match(chart, /1,234\.57M/);
    assert.match(chart, />0\.00<\/span>/);
    assert.match(chart, /Unavailable/);
    assert.equal((chart.match(/scope="row"/g) ?? []).length, 4, "Every chart point has an accessible row using the same compact two-decimal format, including zero and missing data");

    const { default: PlayerPage } = require("../app/players/[playerName]/page") as typeof import("../app/players/[playerName]/page");
    const profile = () => PlayerPage({ params: Promise.resolve({ playerName: "Synthetic" }), searchParams: Promise.resolve(profileSearch) });
    const empty = await renderPage(await profile());
    assert.match(textContent(empty), /Best DPS - Unavailable/);
    assert.match(textContent(empty), /Effective healing - Unavailable/);
    assert.match(empty, /No recorded attempts/);
    assert.match(empty, /No boss kills/);
    attempts = [{ id: "recorded-zero", dps: 0, hps: 0, aps: 0, totalDamage: 0, totalHealing: 0, totalAbsorbs: 0, damageTaken: 0, deaths: 0, role: "UNKNOWN", spec: null, encounter: {
      id: "zero", startedAt: new Date("2026-09-04T20:00:00Z"), outcome: "KILL", difficulty: "25N", durationSeconds: 80, durationMs: 80000,
      boss: { name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel" }, participants: [{ deaths: 0 }],
    } }];
    const zero = await renderPage(await profile());
    assert.doesNotMatch(zero, /Unavailable|No recorded attempts|No boss kills/);
    assert.match(zero, />0\.00<\/span>/);
    assert.match(textContent(zero), /Best DPS: 0\.00/);
    assert.match(textContent(zero), /Best HPS: 0\.00/);
    assert.match(textContent(zero), /0\.00 DPS Effective healing: 0\.00 · 0\.00 HPS Absorbs: 0\.00 · 0\.00 APS/);
    attempts[0].hps = 50;
    const lowHealing = await renderPage(await profile());
    assert.match(textContent(lowHealing), /Best HPS: 50\.00/);
    assert.match(textContent(lowHealing), /0\.00 DPS Effective healing: 0\.00 · 50\.00 HPS Absorbs: 0\.00 · 0\.00 APS/);
    attempts[0].encounter.outcome = "WIPE";
    const noKills = await renderPage(await profile());
    assert.equal((noKills.match(/Unavailable/g) ?? []).length, 2, "Only the DPS/HPS kill averages are unavailable when a recorded zero-output wipe exists");
    assert.match(noKills, /No boss kills/);

    attempts[0].role = "DPS";
    attempts[0].spec = "Combat";
    const damageProfile = textContent(await renderPage(await profile()));
    assert.doesNotMatch(damageProfile, /Best HPS:|Best APS:|Effective healing:/, "Self-healing does not change a recorded damage role's focused display");
    assert.match(damageProfile, /Recorded role: Damage · Spec: Combat/);
    profileSearch = { metrics: "all", comparisonMetric: "aps", comparisonDifficulty: "25H", realm: "Lordaeron" };
    const allProfile = await renderPage(await profile());
    assert.match(textContent(allProfile), /Best HPS: 50\.00/);
    assert.match(allProfile, /href="\/players\/Synthetic\?comparisonMetric=aps&amp;comparisonDifficulty=25H&amp;realm=Lordaeron"/, "Returning to relevant metrics preserves the explicit chart metric and scope");
    profileSearch = {};
    attempts[0].role = "HEALER";
    attempts[0].spec = "Discipline";
    const healerProfile = textContent(await renderPage(await profile()));
    assert.match(healerProfile, /Best HPS: 50\.00/);
    assert.match(healerProfile, /Best APS: 0\.00/);
    assert.doesNotMatch(healerProfile, /Best DPS/, "Healers lead with effective healing and explicit absorbs");
    attempts[0].role = "TANK";
    attempts[0].spec = "Protection";
    attempts[0].encounter.durationMs = 0;
    attempts[0].encounter.durationSeconds = 0;
    const tankProfile = textContent(await renderPage(await profile()));
    assert.match(tankProfile, /Damage taken 0\.00 - Unavailable DTPS/);
    assert.match(tankProfile, /Best DPS/);
    assert.match(tankProfile, /0 deaths/);
    assert.doesNotMatch(tankProfile, /Best DTPS/);

    attempts = [];
    const { default: BossPage } = require("../app/bosses/[bossSlug]/page") as typeof import("../app/bosses/[bossSlug]/page");
    const { default: BossesPage } = require("../app/bosses/page") as typeof import("../app/bosses/page");
    const bossPage = () => BossPage({ params: Promise.resolve({ bossSlug: boss.slug }), searchParams: Promise.resolve({}) });
    const bossesPage = () => BossesPage({ searchParams: Promise.resolve({}) });
    assert.match(textContent(await renderPage(await bossPage())), /Fastest Kill - Unavailable No boss kills/);
    const unknownKill = { id: "unknown-time", outcome: "KILL", difficulty: "25N", startedAt: new Date("2026-09-04T20:00:00Z"), durationSeconds: 0, durationMs: 0, participants: [] as never[] };
    bossEncounters.push(unknownKill);
    const unknownBoss = textContent(await renderPage(await bossPage()));
    assert.match(unknownBoss, /Fastest Kill - Unavailable Kill duration unavailable/);
    assert.match(unknownBoss, /Unavailable duration/);
    assert.doesNotMatch(unknownBoss, /Fastest Kill 0:00|0:00 duration/);
    assert.match(textContent(await renderPage(await bossesPage())), /Kill duration unavailable/);

    bossEncounters.push({ ...unknownKill, id: "precise-time", durationMs: 125_500, durationSeconds: 0 });
    bossEncounters.push({ ...unknownKill, id: "legacy-time", durationMs: null, durationSeconds: 180 });
    bossEncounters.push({ ...unknownKill, id: "invalid-time", durationMs: -1, durationSeconds: 1 });
    const mixedBoss = textContent(await renderPage(await bossPage()));
    assert.match(mixedBoss, /Fastest Kill 2:05 From known kill durations/);
    assert.match(mixedBoss, /2:05 duration/);
    assert.match(mixedBoss, /3:00 duration/);
    assert.doesNotMatch(mixedBoss, /(?:0:00|0:01) duration/);
    const mixedDirectory = textContent(await renderPage(await bossesPage()));
    assert.match(mixedDirectory, /2:05/);
    assert.doesNotMatch(mixedDirectory, /Kill duration unavailable|0:00|0:01/);
    assert.equal(bossEncounters[1].durationSeconds, 0, "Presentation must not rewrite recorded duration fields");
  } finally {
    loader._resolveFilename = originalResolve;
    for (const filename of Object.values(mockPaths)) delete require.cache[filename];
  }
  console.log("public numeric presentation tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
