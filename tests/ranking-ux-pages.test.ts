import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPage } from "./helpers/render-page";
import { formatShortDateUtc, getWeekBounds } from "../lib/utils";

const boss = { id: "marrowgar", name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel", raidSlug: "icecrown-citadel", sortOrder: 1 };
const otherBoss = { ...boss, id: "festergut", name: "Festergut", slug: "festergut", sortOrder: 2 };
const startedAt = new Date(getWeekBounds().start.getTime() + (2 * 24 + 19) * 60 * 60 * 1000);
const participant = (name: string, mode: string, dps: number, encounterId: string, encounterBoss = boss) => ({
  playerId: name, player: { name, class: "Mage" }, dps, hps: dps / 2, deaths: 0,
  encounter: { id: encounterId, bossId: encounterBoss.id, boss: encounterBoss, difficulty: mode, outcome: "KILL", startedAt,
    endedAt: new Date(startedAt.getTime() + 80_000), durationSeconds: 80, durationMs: 80_000 },
});
const participants = [
  participant("Normalplayer", "10N", 2000, "normal-high"),
  participant("Normalplayer", "10N", 1000, "normal-low"),
  participant("Heroicplayer", "25H", 10000, "heroic"),
  participant("Otherbossplayer", "10N", 3000, "other-boss", otherBoss),
];
type Encounter = typeof participants[number]["encounter"];
type Where = { difficulty?: string; bossId?: string; outcome?: string };
type ParticipantQuery = { where: { encounter: Where; dps?: { gt: number }; hps?: { gt: number } }; take: number; distinct?: string[]; orderBy: { dps?: string; hps?: string }; include: { encounter: { select: { id?: boolean; startedAt?: boolean } } } };
const matches = (encounter: Encounter, where: Where = {}) => (!where.difficulty || encounter.difficulty === where.difficulty)
  && (!where.bossId || encounter.bossId === where.bossId) && (!where.outcome || encounter.outcome === where.outcome);
const calls: ParticipantQuery[] = [];
const encounters = (where: Where = {}) => participants.filter(p => matches(p.encounter, where)).map(p => ({ ...p.encounter, participants: [p] }));
const db = {
  boss: {
    findMany: async (query: { include?: { encounters: { where: Where } } }) => [boss, otherBoss].map(item => ({
      ...item, encounters: encounters({ ...query.include?.encounters.where, bossId: item.id }),
    })),
    findUnique: async (query: { include: { encounters: { where: Where } } }) => ({ ...boss, encounters: encounters({ ...query.include.encounters.where, bossId: boss.id }) }),
  },
  encounter: { findMany: async ({ where }: { where: Where }) => encounters(where) },
  participant: {
    groupBy: async () => [],
    findMany: async (query: ParticipantQuery) => {
      calls.push(query);
      const metric = query.orderBy.dps ? "dps" : "hps";
      let rows = participants.filter(p => matches(p.encounter, query.where.encounter) && p[metric] > (query.where[metric]?.gt ?? 0))
        .sort((a, b) => b[metric] - a[metric]);
      if (query.distinct) rows = rows.filter((row, index) => rows.findIndex(other => other.playerId === row.playerId) === index);
      return rows.slice(0, query.take);
    },
  },
};

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  const dbPath = path.join(process.cwd(), "tests", "__mocks__", "ranking-ux-db.js");
  loader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (request === "@/lib/db") return dbPath;
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { db } } as NodeModule;
  try {
    const { default: WeeklyPage } = require("../app/weekly/page") as typeof import("../app/weekly/page");
    const weekly = await renderPage(await WeeklyPage({ searchParams: Promise.resolve({ difficulty: "10N", includeShortPulls: "1" }) }));
    assert.match(weekly, /Top DPS Attempts This Week/);
    assert.match(weekly, /href="\/encounters\/normal-high\?/);
    assert.match(weekly, /href="\/encounters\/normal-low\?/);
    assert.match(weekly, new RegExp(formatShortDateUtc(startedAt.toISOString())));
    assert.doesNotMatch(weekly, /Heroicplayer|Week view/);
    assert.ok(calls.every(query => query.where.encounter.difficulty === "10N" && !query.where.encounter.outcome && !query.distinct), "Weekly rankings retain all attempts and repeated players within the selected mode");
    assert.ok(calls.every(query => query.include.encounter.select.id && query.include.encounter.select.startedAt));

    calls.length = 0;
    const { default: LeaderboardsPage } = require("../app/leaderboards/page") as typeof import("../app/leaderboards/page");
    const leaders = await renderPage(await LeaderboardsPage({ searchParams: Promise.resolve({ difficulty: "25H", boss: boss.slug, includeShortPulls: "1" }) }));
    assert.match(leaders, /Heroicplayer/);
    assert.doesNotMatch(leaders, /Normalplayer|Otherbossplayer/);
    assert.match(leaders, /name="boss"/);
    assert.match(leaders, /Top 3 Average DPS/);
    assert.match(leaders, /Top 3 Average HPS/);
    assert.match(leaders, /No qualifying players yet/);
    assert.ok(calls.every(query => query.where.encounter.bossId === boss.id && query.where.encounter.difficulty === "25H" && query.where.encounter.outcome === "KILL" && query.distinct?.[0] === "playerId" && query.take === 10));
    calls.length = 0;
    await renderPage(await LeaderboardsPage({ searchParams: Promise.resolve({}) }));
    assert.ok(calls.every(query => query.where.encounter.difficulty === undefined), "All difficulties keeps the original pooled ranking query");

    const { default: BossPage } = require("../app/bosses/[bossSlug]/page") as typeof import("../app/bosses/[bossSlug]/page");
    const detail = await renderPage(await BossPage({ params: Promise.resolve({ bossSlug: boss.slug }), searchParams: Promise.resolve({ difficulty: "10N", includeShortPulls: "1" }) }));
    assert.match(detail, /href="#boss-history"/);
    assert.match(detail, /href="#boss-dps"/);
    assert.match(detail, /href="#boss-hps"/);
    assert.equal((detail.match(/aria-expanded="false"/g) ?? []).length, 2, "Both rankings start collapsed so history is reachable");
    assert.match(detail, /Latest 2 of 2 counted attempts/);
    assert.doesNotMatch(detail, /Heroicplayer/);
    assert.match(detail, /includeShortPulls=1/);

    const { default: BossesPage } = require("../app/bosses/page") as typeof import("../app/bosses/page");
    const directory = await renderPage(await BossesPage({ searchParams: Promise.resolve({ difficulty: "25H" }) }));
    assert.match(directory, />Bosses<\/h1>/);
    assert.doesNotMatch(directory, /Boss Rankings/);
    assert.match(directory, /value="25H" selected/);
    const bossCard = directory.match(/<a[^>]+aria-label="Lord Marrowgar boss summary"[\s\S]*?<\/a>/)?.[0];
    assert.ok(bossCard, "The real raid slug must render the selected boss card");
    assert.match(bossCard, /Heroicplayer/);
    assert.match(bossCard, />0<\/div><div[^>]*>Wipes<\/div>/, "Known zero wipes must be shown as zero, not unavailable");

    const { DifficultyFilter } = require("../components/reports/DifficultyFilter") as typeof import("../components/reports/DifficultyFilter");
    const form = renderToStaticMarkup(React.createElement(DifficultyFilter, { action: "/leaderboards", id: "fixture", difficulty: "25H", boss: boss.slug, bosses: [boss], searchParams: { difficulty: "10N", boss: "old", includeShortPulls: "1", tag: ["one", "two"] } }));
    assert.equal((form.match(/name="difficulty"/g) ?? []).length, 1);
    assert.equal((form.match(/name="boss"/g) ?? []).length, 1);
    assert.match(form, /name="includeShortPulls" value="1"/);
    assert.equal((form.match(/name="tag"/g) ?? []).length, 2);
  } finally {
    loader._resolveFilename = originalResolve;
    delete require.cache[dbPath];
  }
  console.log("ranking UX page tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
