import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPage } from "./helpers/render-page";

const stamp = new Date("2026-09-04T23:04:10Z");
const route = { sessionIndex: 0, startedAt: stamp, dateSlug: "2026-09-04", slug: "2026-09-04", dateOrdinal: 1 };
const player = { id: "synthetic-player", name: "Syntheticrogue", class: "Rogue" };
const participant = {
  id: "synthetic-participant", player, dps: 13_931.2, hps: 15.5, aps: 0, deaths: 1, critPct: 1, role: "DPS", spec: "Combat",
  totalDamage: 1_393_100, totalHealing: 1000, totalAbsorbs: 0, damageTaken: 900,
  spellBreakdown: {}, absorbBreakdown: {}, targetBreakdown: null,
  auraBreakdown: { "Synthetic Aura": { uptimePct: 0.01, uptimeSeconds: 1, applications: 1 } },
  consumableBreakdown: {}, powerBreakdown: { "Synthetic Power": { amount: 1234, events: 1, powerType: 0 } }, deathEvents: [],
};
const encounter = {
  id: "synthetic-encounter", sessionIndex: 0, outcome: "WIPE", difficulty: "25N", startedAt: stamp, endedAt: new Date("2026-09-05T00:05:00Z"),
  durationMs: 0 as number | null, durationSeconds: 0, totalDamage: 1_393_100, totalHealing: 1000, totalAbsorbs: 0, totalDamageTaken: 900, unattributedAbsorbs: 0,
  boss: { id: "synthetic-boss", name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel" },
  upload: { id: "synthetic-upload", publicSlug: "synthetic-report", guild: null, realm: { name: "Lordaeron", host: "example.test" } },
  participants: [participant], milestones: [{ id: "synthetic-award", rank: 1, type: "ALL_TIME_RANK", metric: "DPS", value: 13_931.2, player }],
};
const db = {
  encounter: { findUnique: async () => encounter, findMany: async () => [encounter] },
  upload: { findUnique: async () => ({ ...encounter.upload, sessionDamage: { "0": 1_393_100 }, sessionAnalytics: null }) },
  guildRosterMember: { findFirst: async () => null, findMany: async () => [] },
};
const plainText = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const contains = (markup: string, value: string) => assert.ok(plainText(markup).includes(value), `Expected rendered text: ${value}`);

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  let navigationPath = "/raids/synthetic-report/sessions/2026-09-04";
  let navigationSearch = new URLSearchParams();
  const exportsByName: Record<string, unknown> = {
    "next/navigation": {
      usePathname: () => navigationPath,
      useSearchParams: () => navigationSearch,
      useRouter: () => ({ replace: () => { throw new Error("Static numeric fixture must not navigate"); } }),
      notFound: () => { throw new Error("Unexpected notFound in numeric fixture"); },
      permanentRedirect: () => { throw new Error("Unexpected redirect in numeric fixture"); },
    },
    "@/lib/db": { db },
    "@/lib/raid-session-routing.server": {
      getRaidSessionRouteByIndex: async () => route,
      getRaidSessionRoutes: async () => [route],
      resolveRaidSession: async () => ({ route, uploadId: "synthetic-upload", publicSlug: "synthetic-report", isLegacyUploadId: false, isLegacyIndex: false }),
    },
  };
  const mocks = Object.fromEntries(Object.entries(exportsByName).map(([name, exports], index) => {
    const filename = path.join(process.cwd(), "tests", "__mocks__", `report-numeric-${index}.js`);
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
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("Numeric presentation fixture must not contact upstream services"); };
  try {
    const { DamageMeter, AbsorbBreakdown, SpellBreakdown } = require("../components/meter/DamageMeter") as typeof import("../components/meter/DamageMeter");
    const meter = renderToStaticMarkup(React.createElement(DamageMeter, { participants: [participant, { ...participant, player: { ...player, name: "Tinyplayer" }, dps: 0.01, totalDamage: 1, deaths: 0 }], metric: "dps" }));
    contains(meter, "1.39M"); contains(meter, "13.93K"); contains(meter, "1 death · 1.00% overall crit");
    contains(meter, "Damage"); contains(meter, "DPS"); contains(meter, "Share of total");
    assert.ok(meter.includes("&lt;0.01%"), "A positive tiny share must not be displayed as zero");
    assert.match(meter, /Position <\/span><span aria-hidden="true">#<\/span>1/);
    assert.ok(!meter.includes("13,931.2") && !meter.includes("☠"));

    const shieldMeters = renderToStaticMarkup(React.createElement(AbsorbBreakdown, { breakdown: {
      "Large shield": { amount: 100_000, hits: 1, ambiguousHits: 0 },
      "Tiny shield": { amount: 1, hits: 1, ambiguousHits: 0 },
    } }));
    const spellEntry = { damage: 100_000, healing: 100_000, hits: 1, crits: 0, school: 4 };
    const spokenCases = [
      { markup: shieldMeters, label: "Tiny shield relative absorb volume", scope: "shield" },
      ...(["damage", "healing"] as const).map(outputMetric => ({
        markup: renderToStaticMarkup(React.createElement(SpellBreakdown, { outputMetric, breakdown: {
          "Large spell": spellEntry,
          "Tiny spell": { ...spellEntry, damage: 1, healing: 1 },
        } })),
        label: `Tiny spell relative ${outputMetric} volume`, scope: outputMetric,
      })),
    ];
    for (const { markup, label, scope } of spokenCases) {
      const spokenMeter = [...markup.matchAll(/<div[^>]*role="meter"[^>]*>/g)].find(([tag]) => tag.includes(`aria-label="${label}"`))?.[0];
      assert.ok(spokenMeter, `Rendered ${scope} breakdown must expose its tiny-contribution meter`);
      assert.match(spokenMeter, /aria-valuenow="0\.001"/, "Assistive technology must receive the measured positive percentage, not a rounded zero");
      assert.ok(spokenMeter.includes(`aria-valuetext="&lt;0.01% of the largest ${scope} ability"`), "Spoken percentage must state the comparison scope");
    }

    const { MobBreakdown } = require("../components/meter/MobBreakdown") as typeof import("../components/meter/MobBreakdown");
    const targets = renderToStaticMarkup(React.createElement(MobBreakdown, { mobs: [
      { name: "Large target", totalDamage: 1_393_100, hits: 1000, crits: 10, byPlayer: [] },
      { name: "Tiny target", totalDamage: 1, hits: 1, crits: 0, byPlayer: [] },
    ] }));
    contains(targets, "1 hit ·"); contains(targets, "1,000 hits ·");
    assert.ok(targets.includes("&lt;0.01%"));

    const { SessionPlayerTable } = require("../components/reports/SessionPlayerTable") as typeof import("../components/reports/SessionPlayerTable");
    navigationSearch = new URLSearchParams({ raidMetrics: "all" });
    const table = renderToStaticMarkup(React.createElement(SessionPlayerTable, { label: "Synthetic player metrics", rows: [
      { name: player.name, href: null, color: "var(--color-text-primary)", totalDamage: 1_393_100, dps: 13_931.2, heal: 0, healPerSecond: null, damageTaken: 0, dtps: 0 },
    ] }));
    contains(table, "1.39M"); contains(table, "13.93K"); contains(table, "Healing + absorbs /s");
    assert.ok(table.includes('<span class="sr-only">Unavailable</span>'));
    assert.ok(table.includes('<span class="tabular-nums">0.00</span>'), "Actual zero remains a measured value");
    navigationSearch = new URLSearchParams();

    const { default: EncounterPage } = require("../app/encounters/[id]/page") as typeof import("../app/encounters/[id]/page");
    const encounterProps = { params: Promise.resolve({ id: encounter.id }), searchParams: Promise.resolve({}) };
    const missing = await renderPage(await EncounterPage(encounterProps));
    contains(missing, "Raid rates are unavailable because the recorded fight duration is missing or invalid");
    contains(missing, "13.93K DPS"); contains(missing, "1 application"); contains(missing, "1 event");
    contains(missing, "Sep 4, 2026, 23:04:10 UTC");
    assert.ok(!missing.includes("1 applications") && !missing.includes("1 events"));

    encounter.durationMs = 50_000;
    const precise = await renderPage(await EncounterPage(encounterProps));
    contains(precise, "Damage 1.39M 27.86K raid DPS");
    assert.ok(!precise.includes("Raid rates are unavailable"), "Positive precise milliseconds work even when legacy seconds are zero");
    encounter.durationMs = -1; encounter.durationSeconds = 100;
    const invalid = await renderPage(await EncounterPage(encounterProps));
    contains(invalid, "Raid rates are unavailable");
    encounter.durationMs = null;
    const legacy = await renderPage(await EncounterPage(encounterProps));
    contains(legacy, "Damage 1.39M 13.93K raid DPS");
    assert.equal(participant.dps, 13_931.2, "Display-derived rates must not rewrite stored participant rates");

    encounter.durationMs = 0; encounter.durationSeconds = 0;
    const { default: SessionPage } = require("../app/uploads/[id]/sessions/[sessionIdx]/page") as typeof import("../app/uploads/[id]/sessions/[sessionIdx]/page");
    const sessionProps = { params: Promise.resolve({ id: "synthetic-report", sessionIdx: route.slug }), searchParams: Promise.resolve({}) };
    const session = await renderPage(await SessionPage(sessionProps));
    contains(session, "0 kills / 1 wipe"); contains(session, "Healing + absorbs"); contains(session, "Unavailable raid DPS");
    contains(session, "Sep 4, 2026, 23:04 – Sep 5, 2026, 00:05 UTC");
    assert.ok(!session.includes("0K / 1W"));

    const { default: SessionPlayerPage } = require("../app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page") as typeof import("../app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page");
    navigationPath += `/players/${player.name}`;
    const detailParams = Promise.resolve({ id: "synthetic-report", sessionIdx: route.slug, playerName: player.name });
    const relevantDetail = await renderPage(await SessionPlayerPage({ ...sessionProps, params: detailParams }));
    contains(relevantDetail, "13.93K DPS");
    assert.ok(!plainText(relevantDetail).includes("15.50 HPS"), "Incidental healing stays secondary for a recorded damage role");
    navigationSearch = new URLSearchParams({ metrics: "all" });
    const detail = await renderPage(await SessionPlayerPage({ ...sessionProps, params: detailParams, searchParams: Promise.resolve({ metrics: "all" }) }));
    contains(detail, "The average on kills is unavailable"); contains(detail, "Avg DPS - Unavailable on kills");
    contains(detail, "Best DPS 13.93K single pull");
    contains(detail, "15.50 HPS"); contains(detail, "0.00 APS"); contains(detail, "1 death");
  } finally {
    global.fetch = originalFetch;
    loader._resolveFilename = originalResolve;
    for (const filename of Object.values(mocks)) delete require.cache[filename];
  }
  console.log("report numeric presentation tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
