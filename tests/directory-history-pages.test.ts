import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { renderPage } from "./helpers/render-page";

const players = Array.from({ length: 65 }, (_, index) => ({
  id: `player-${index}`, name: `Player${String(index + 1).padStart(2, "0")}`,
  class: index % 2 === 0 ? "Rogue" : "Mage", realm: { name: "Lordaeron" }, _count: { participants: 1 },
}));
type PlayerWhere = { class?: string; name?: { contains: string; mode: string }; id?: { in: string[] } };
type PlayerQuery = { where?: PlayerWhere; select?: { class?: boolean; _count?: unknown }; skip?: number; take?: number; orderBy?: unknown; include?: Record<string, unknown> };
type UploadQuery = { where: unknown; skip: number; take: number; orderBy: unknown; select: { encounters: { orderBy: unknown; select: unknown } } };
const filterPlayers = (where: PlayerWhere = {}) => players.filter(player => (!where.class || player.class === where.class)
  && (!where.name || player.name.toLowerCase().includes(where.name.contains.toLowerCase())));
const playerQueries: PlayerQuery[] = [];
const uploadQueries: UploadQuery[] = [];
const boss = { name: "Lord Marrowgar", slug: "lord-marrowgar", raid: "Icecrown Citadel" };
const encounter = (sessionIndex: number, index = 0) => ({
  id: `encounter-${index}`, sessionIndex, outcome: "KILL", difficulty: "25H", durationMs: 80_000, durationSeconds: 80,
  startedAt: new Date(`2026-09-01T${String(12 + sessionIndex).padStart(2, "0")}:00:00Z`),
  endedAt: new Date(`2026-09-01T${String(12 + sessionIndex).padStart(2, "0")}:01:20Z`), boss, participants: [{ deaths: 0 }],
});
const uploads = Array.from({ length: 61 }, (_, index) => ({
  publicSlug: `synthetic-${index}`, sessionAnalytics: null, realm: { name: "Lordaeron", host: "example.test" }, guild: { name: "Synthetic Guild" },
  encounters: Array.from({ length: index % 20 === 0 ? 3 : index % 20 === 19 ? 2 : 1 }, (_, sessionIndex) => encounter(sessionIndex)),
}));
let unavailable = false;
const checkAvailable = () => { if (unavailable) throw new Error("Can't reach database server at localhost:5432"); };
const db = {
  $queryRaw: async () => { checkAvailable(); return []; },
  player: {
    count: async ({ where }: { where: PlayerWhere }) => { checkAvailable(); return filterPlayers(where).length; },
    findMany: async (query: PlayerQuery) => {
      checkAvailable();
      playerQueries.push(query);
      if (query.where?.id) return players.filter(player => query.where!.id!.in.includes(player.id));
      return filterPlayers(query.where);
    },
    findFirst: async () => ({ ...players[0], milestones: [{ id: "award", rank: 1, metric: "HPS", value: 7000, difficulty: "25H", achievedAt: new Date("2026-08-15T14:00:00Z"), encounter: { boss } }] }),
  },
  encounter: { count: async () => { checkAvailable(); return 1; } },
  upload: {
    count: async ({ where }: { where: unknown }) => { checkAvailable(); assert.deepEqual(where, { encounters: { some: {} } }); return uploads.length; },
    findMany: async (query: UploadQuery) => { uploadQueries.push(query); return uploads.slice(query.skip, query.skip + query.take); },
  },
  guildRosterMember: { findFirst: async () => null },
  participant: { findMany: async ({ take }: { take: number }) => {
    assert.equal(take, 50);
    return Array.from({ length: 50 }, (_, index) => ({ id: `participation-${index}`, dps: 1000, hps: 200, aps: 0, deaths: 0, spec: null, encounter: encounter(0, index) }));
  } },
};

async function main() {
  const loader = Module as typeof Module & { _resolveFilename: (request: string, parent: NodeModule | undefined, isMain: boolean, options?: unknown) => string };
  const originalResolve = loader._resolveFilename;
  const mockExports: Record<string, unknown> = {
    "@/lib/db": { db },
    "@/lib/warmane-armory": { getWarmaneCharacterGear: async () => ({ ok: false }) },
    "@/lib/warmane-guild-roster": { DEFAULT_GUILD_NAME: "Synthetic Guild", DEFAULT_GUILD_REALM: "Lordaeron" },
    "@/components/players/PlayerGearSection": { PlayerGearSection: () => null, PlayerGearSectionSkeleton: () => null },
    "@/components/players/PlayerRaidComparisonSection": { PlayerRaidComparisonSection: () => null, PlayerRaidComparisonSkeleton: () => null },
  };
  const mockPaths = Object.fromEntries(Object.entries(mockExports).map(([name, exports], index) => {
    const filename = path.join(process.cwd(), "tests", "__mocks__", `directory-history-${index}.js`);
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule;
    return [name, filename];
  }));
  loader._resolveFilename = function resolve(request, parent, isMain, options) {
    if (request === "./db" && parent?.filename.endsWith("player-directory.ts")) return mockPaths["@/lib/db"];
    if (mockPaths[request]) return mockPaths[request];
    if (request.startsWith("@/")) {
      const base = path.join(process.cwd(), request.slice(2));
      const match = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
      if (match) return originalResolve.call(this, match, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("Page render must not fetch upstream data in this fixture"); };
  try {
    const { default: PlayersPage } = require("../app/players/page") as typeof import("../app/players/page");
    const directory = await renderPage(await PlayersPage({ searchParams: Promise.resolve({ q: "player", class: "rogue", page: "2", includeShortPulls: "1" }) }));
    assert.match(directory, /Player61/); assert.match(directory, /Player63/); assert.match(directory, /Player65/);
    assert.doesNotMatch(directory, /Player59|Player62|👑|Best DPS|Best HPS|Rank #/);
    assert.match(directory, /31–33 of 33 players · Page 2 of 2/);
    assert.match(directory, /href="\/players\?q=player&amp;class=Rogue&amp;includeShortPulls=1"/);
    assert.match(directory, /href="\/players\/Player61\?realm=Lordaeron&amp;includeShortPulls=1"/);
    assert.match(directory, /name="includeShortPulls" value="1"/);
    assert.match(directory, /1 pull<\/span>/); assert.doesNotMatch(directory, /1 pulls/);
    assert.equal(playerQueries[0].where, undefined, "Canonical identity is resolved before filtering");
    assert.deepEqual(playerQueries[0].orderBy, [{ name: "asc" }, { id: "asc" }]);
    assert.deepEqual(playerQueries[1].where, { id: { in: ["player-60", "player-62", "player-64"] } }, "Only paginated identities load pull counts");
    assert.ok(!("milestones" in (playerQueries[0].include ?? {})), "Directory data must not use awards as current standing");
    const narrow = await renderPage(await PlayersPage({ searchParams: Promise.resolve({ q: "Player6", class: "Rogue", page: "99" }) }));
    assert.match(narrow, /1–3 of 3 players · Page 1 of 1/);
    assert.equal(playerQueries[3].where?.id?.in.length, 3);

    const { default: RaidsPage } = require("../app/raids/page") as typeof import("../app/raids/page");
    const sessionLinks = (markup: string) => [...markup.matchAll(/href="(\/raids\/synthetic-\d+\/sessions\/[^\"]+)"/g)].map(match => match[1]).sort();
    const allSessionLinks: string[] = [];
    let pageParams = { includeShortPulls: "1" } as { page?: string; includeShortPulls: string };
    let oldestPageLinks: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const markup = await renderPage(await RaidsPage({ searchParams: Promise.resolve(pageParams) }));
      const start = (page - 1) * 20;
      const pageUploads = uploads.slice(start, start + 20);
      const expectedLinks = pageUploads.flatMap(upload => upload.encounters.map(({ sessionIndex }) =>
        `/raids/${upload.publicSlug}/sessions/2026-09-01${sessionIndex === 0 ? "" : `-${sessionIndex + 1}`}?includeShortPulls=1`)).sort();
      const links = sessionLinks(markup);
      assert.deepEqual(links, expectedLinks, `Page ${page} must keep every session of its first and last uploads together`);
      assert.ok(markup.includes(`${expectedLinks.length} raid sessions from ${pageUploads.length} upload${pageUploads.length === 1 ? "" : "s"} on this page`));
      assert.ok(markup.includes(`Uploads ${start + 1}–${start + pageUploads.length} of 61`));
      assert.ok(markup.includes(`Page ${page} of 4`));
      assert.equal(uploadQueries[page - 1].skip, start);
      allSessionLinks.push(...links);
      if (page < 4) {
        const nextHref = [...markup.matchAll(/href="([^"]+)"[^>]*>Next uploads<\/a>/g)][0]?.[1];
        assert.ok(nextHref, `Page ${page} must link to the next upload window`);
        const nextUrl = new URL(nextHref.replaceAll("&amp;", "&"), "https://example.test");
        assert.equal(nextUrl.pathname, "/raids");
        assert.equal(nextUrl.searchParams.get("page"), String(page + 1));
        assert.equal(nextUrl.searchParams.get("includeShortPulls"), "1");
        pageParams = { page: nextUrl.searchParams.get("page")!, includeShortPulls: nextUrl.searchParams.get("includeShortPulls")! };
      } else {
        oldestPageLinks = links;
        assert.match(markup, /href="\/raids\?page=3&amp;includeShortPulls=1"/);
        assert.match(markup, /<button[^>]*disabled=""[^>]*>Next uploads<\/button>/);
      }
    }
    assert.equal(new Set(allSessionLinks).size, 72, "All stored sessions must be reachable exactly once across upload pages");
    assert.equal(allSessionLinks.length, 72);
    assert.equal(new Set(allSessionLinks.map(href => href.split("/")[2])).size, 61, "History must reach uploads beyond the previous latest-50 limit");
    assert.ok(oldestPageLinks.every(href => href.startsWith("/raids/synthetic-60/")));
    const clamped = await renderPage(await RaidsPage({ searchParams: Promise.resolve({ page: "99", includeShortPulls: "1" }) }));
    assert.match(clamped, /3 raid sessions from 1 upload on this page/);
    assert.match(clamped, /Uploads 61–61 of 61/); assert.match(clamped, /Page 4 of 4/);
    assert.deepEqual(sessionLinks(clamped), oldestPageLinks);
    assert.equal(uploadQueries[4].skip, 60);
    for (const query of uploadQueries) {
      assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
      assert.equal(query.take, 20);
      assert.ok(!("take" in query.select.encounters), "Upload pagination must retain complete child session groups");
    }

    const { default: PlayerPage } = require("../app/players/[playerName]/page") as typeof import("../app/players/[playerName]/page");
    const profile = await renderPage(await PlayerPage({ params: Promise.resolve({ playerName: "Player01" }), searchParams: Promise.resolve({ includeShortPulls: "1" }) }));
    assert.match(profile, /Rank when achieved:/); assert.match(profile, /Historical all-time ranks when achieved, not current standings/);
    assert.match(profile, /dateTime="2026-08-15T14:00:00.000Z"/);
    assert.match(profile, /href="\/bosses\/lord-marrowgar\?difficulty=25H&amp;includeShortPulls=1#boss-hps"/);
    assert.match(profile, /Performance summary and per-boss bests use the latest 50 recorded encounters/);
    assert.equal((profile.match(/href="\/encounters\/encounter-/g) ?? []).length, 50, "The recent encounter count and rendered rows must agree");
    assert.match(profile, /href="#recent-encounters"/);

    unavailable = true;
    for (const page of [PlayersPage, RaidsPage]) {
      const markup = await renderPage(await page({ searchParams: Promise.resolve({}) }));
      assert.match(markup, /temporarily unavailable/); assert.doesNotMatch(markup, /localhost|Postgres|Start local/);
    }
  } finally {
    loader._resolveFilename = originalResolve;
    global.fetch = originalFetch;
    for (const filename of Object.values(mockPaths)) delete require.cache[filename];
  }
  console.log("directory and raid history page tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
