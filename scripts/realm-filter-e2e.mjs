import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";

// Author: Neil Mitchell
// Last Modified By: Neil Mitchell
// This script only creates invocation-owned records in an already-isolated loopback schema.
const metadata = { author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell" };
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
assert.ok(localHosts.has(base.hostname) && localHosts.has(databaseUrl.hostname), "Only loopback browser and database hosts are allowed");
assert.ok(["http:", "https:"].includes(base.protocol) && !base.username && !base.password, "Use a local HTTP base URL without credentials");
assert.ok(["postgres:", "postgresql:"].includes(databaseUrl.protocol), "Expected a PostgreSQL URL");
assert.ok([...databaseUrl.searchParams.keys()].every(key => key === "schema"), "Only the schema query parameter is allowed");
const schema = databaseUrl.searchParams.get("schema") ?? "public";
assert.match(schema, /^[a-z0-9_]+$/, "Use a validated lowercase task schema");

const prefix = `realm-e2e-${randomUUID()}`;
const out = path.resolve(process.env.PIZZA_REALM_ARTIFACTS ?? ".test-artifacts/realm-filter");
const owned = { realms: [], players: [], uploads: [], encounters: [], participants: [] };
const observations = [];
const names = { shared: "Qzrealmshared", legacy: "Qzrealmlegacy" };
let database;
let browser;

function href(route) { return new URL(route, base).href; }
function realmQuery(id, extra = "") { return `realmId=${encodeURIComponent(id)}${extra ? `&${extra}` : ""}`; }
function currentWeekDate(offsetMinutes = 0) {
  const now = new Date();
  const day = now.getUTCDay();
  const daysToWednesday = day < 3 ? day + 4 : day - 3;
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - daysToWednesday);
  start.setUTCHours(9, offsetMinutes, 0, 0);
  if (start > now) start.setUTCDate(start.getUTCDate() - 7);
  return start;
}

async function seed() {
  const bosses = (await database.query('SELECT id,slug FROM bosses ORDER BY "sortOrder",slug LIMIT 2')).rows;
  assert.equal(bosses.length, 2, "Run db:seed against the isolated schema before realm acceptance");

  const nonce = randomUUID().replace(/[^a-f]/g, "").slice(0, 8);
  const realmNames = { alpha: `Qzalpha${nonce}`, beta: `Qzbeta${nonce}` };
  for (const [suffix, name] of Object.entries(realmNames)) {
    const id = `${prefix}-realm-${suffix}`;
    await database.query('INSERT INTO realms (id,name,host,expansion) VALUES ($1,$2,$3,$4)', [id, name, "warmane", "wotlk"]);
    owned.realms.push(id);
  }
  const [alphaRealmId, betaRealmId] = owned.realms;

  const addPlayer = async (name, realmId, className = "Mage") => {
    const id = `${prefix}-player-${owned.players.length}`;
    await database.query('INSERT INTO players (id,name,class,"realmId") VALUES ($1,$2,$3,$4)', [id, name, className, realmId]);
    owned.players.push(id);
    return id;
  };
  const alphaShared = await addPlayer(names.shared, alphaRealmId, "Mage");
  const betaShared = await addPlayer(names.shared, betaRealmId, "Priest");
  const legacy = await addPlayer(names.legacy, null, "Rogue");
  const alphaPlayers = [alphaShared];
  const betaPlayers = [betaShared];
  for (let index = 0; index < 30; index += 1) {
    alphaPlayers.push(await addPlayer(`Qzrealma${String(index).padStart(2, "0")}`, alphaRealmId));
  }
  for (let index = 0; index < 10; index += 1) {
    betaPlayers.push(await addPlayer(`Qzrealmb${String(index).padStart(2, "0")}`, betaRealmId));
  }

  const addUpload = async realmId => {
    const id = `${prefix}-upload-${owned.uploads.length}`;
    await database.query(`INSERT INTO uploads (id,"publicSlug",filename,"fileHash","fileSize",status,"realmId","updatedAt","createdAt")
      VALUES ($1,$2,'realm-filter-e2e.log',$3,1,'DONE',$4,now(),now())`, [id, `${id}-report`, `${id}-hash`, realmId]);
    owned.uploads.push(id);
    return id;
  };
  const addEncounter = async ({ uploadId, boss, index, players, difficulty = "25H", outcome = "KILL" }) => {
    const id = `${prefix}-encounter-${owned.encounters.length}`;
    const start = currentWeekDate(index * 5);
    const duration = 120;
    await database.query(`INSERT INTO encounters
      (id,"uploadId","bossId",fingerprint,outcome,difficulty,"groupSize","sessionIndex","durationSeconds","durationMs","startedAt","endedAt","totalDamage","totalHealing")
      VALUES ($1,$2,$3,$4,$5,$6,25,0,$7,$8,$9,$10,$11,$12)`,
    [id, uploadId, boss.id, `${id}-fingerprint`, outcome, difficulty, duration, duration * 1000, start.toISOString(), new Date(start.getTime() + duration * 1000).toISOString(), players.length * 1000, players.length * 500]);
    owned.encounters.push(id);
    for (const [rank, playerId] of players.entries()) {
      const participantId = `${prefix}-participant-${owned.participants.length}`;
      const dps = 30000 - rank * 100;
      const hps = 3000 - rank * 10;
      await database.query(`INSERT INTO participants
        (id,"encounterId","playerId",role,"totalDamage","totalHealing",dps,hps)
        VALUES ($1,$2,$3,'DPS',$4,$5,$6,$7)`, [participantId, id, playerId, dps * duration, hps * duration, dps, hps]);
      owned.participants.push(participantId);
    }
    return id;
  };
  for (let index = 0; index < 21; index += 1) {
    await addEncounter({ uploadId: await addUpload(alphaRealmId), boss: bosses[0], index, players: alphaPlayers.slice(0, 11) });
  }
  // A second boss/difficulty proves that the realm scope composes with difficulty.
  await addEncounter({ uploadId: await addUpload(alphaRealmId), boss: bosses[1], index: 22, players: alphaPlayers.slice(0, 11), difficulty: "10N" });
  for (let index = 0; index < 10; index += 1) {
    await addEncounter({ uploadId: await addUpload(betaRealmId), boss: bosses[0], index: 30 + index, players: betaPlayers });
  }
  await addEncounter({ uploadId: await addUpload(null), boss: bosses[0], index: 45, players: [legacy] });
  return { alphaRealmId, betaRealmId, realmNames, bosses, alphaShared, betaShared };
}

async function apiJson(route) {
  const response = await fetch(href(route));
  assert.equal(response.status, 200, route);
  return response.json();
}

async function assertArtifact(page, name) {
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: no horizontal overflow`);
}

try {
  await fs.mkdir(out, { recursive: true });
  database = new Client({ host: databaseUrl.hostname.replace(/^\[|\]$/g, ""), port: Number(databaseUrl.port || 5432), database: decodeURIComponent(databaseUrl.pathname.slice(1)), user: decodeURIComponent(databaseUrl.username), password: decodeURIComponent(databaseUrl.password), connectionTimeoutMillis: 5000 });
  await database.connect();
  await database.query(`SET search_path TO "${schema}"`);
  assert.equal((await database.query("SELECT current_schema() AS name")).rows[0].name, schema, "The selected schema must already exist");
  assert.equal((await database.query("SELECT pg_try_advisory_lock(hashtext(current_schema()), hashtext('pizza-realm-filter-e2e')) AS locked")).rows[0].locked, true, "Another realm acceptance run owns this schema");
  const fixture = await seed();
  const fixtureCounts = (await database.query(`SELECT
    count(*) FILTER (WHERE "realmId" = $1)::int AS "alphaUploads",
    count(*) FILTER (WHERE "realmId" = $2)::int AS "betaUploads",
    count(*) FILTER (WHERE "realmId" IS NULL)::int AS "legacyUploads"
    FROM uploads WHERE id = ANY($3::text[])`, [fixture.alphaRealmId, fixture.betaRealmId, owned.uploads])).rows[0];
  assert.deepEqual(fixtureCounts, { alphaUploads: 22, betaUploads: 10, legacyUploads: 1 }, "Fixture manifest contains only the expected realm-owned uploads");
  const playerCounts = (await database.query(`SELECT
    count(*) FILTER (WHERE "realmId" = $1)::int AS alpha,
    count(*) FILTER (WHERE "realmId" = $2)::int AS beta,
    count(*) FILTER (WHERE "realmId" IS NULL)::int AS legacy
    FROM players WHERE id = ANY($3::text[])`, [fixture.alphaRealmId, fixture.betaRealmId, owned.players])).rows[0];
  assert.deepEqual(playerCounts, { alpha: 31, beta: 11, legacy: 1 }, "Fixture manifest has enough selected-realm players to cross directory pagination");
  const averageFightCount = (await database.query(`SELECT count(*)::int AS fights FROM participants p
    JOIN encounters e ON e.id = p."encounterId" JOIN uploads u ON u.id = e."uploadId"
    WHERE p."playerId" = $1 AND u."realmId" = $2`, [fixture.alphaShared, fixture.alphaRealmId])).rows[0].fights;
  assert.equal(averageFightCount, 22, "The selected-realm average fixture exceeds the ten-fight qualification threshold");
  const weeklyStart = currentWeekDate();
  const weeklyEnd = new Date(weeklyStart);
  weeklyEnd.setUTCDate(weeklyEnd.getUTCDate() + 7);
  const weeklyFixtureCount = (await database.query(`SELECT count(*)::int AS kills FROM encounters e
    JOIN uploads u ON u.id = e."uploadId"
    WHERE u."realmId" = $1 AND e.outcome = 'KILL' AND e."startedAt" >= $2 AND e."startedAt" < $3`,
  [fixture.alphaRealmId, weeklyStart.toISOString(), weeklyEnd.toISOString()])).rows[0].kills;
  assert.equal(weeklyFixtureCount, 22, "Selected-realm weekly fixtures fall inside the app's Wednesday 09:00 UTC window");

  const [allBosses, alphaBosses, betaBosses, staleBosses] = await Promise.all([
    apiJson("/api/bosses"), apiJson(`/api/bosses?${realmQuery(fixture.alphaRealmId)}`), apiJson(`/api/bosses?${realmQuery(fixture.betaRealmId)}`), apiJson(`/api/bosses?${realmQuery(`${prefix}-stale`)}`),
  ]);
  const boss = fixture.bosses[0];
  assert.ok(allBosses.find(row => row.id === boss.id).totalPulls >= 32, "All-realm boss totals include both scoped and null-realm records");
  assert.equal(alphaBosses.find(row => row.id === boss.id).totalPulls, 21, "Realm A boss totals exclude Realm B and null-realm records");
  assert.equal(betaBosses.find(row => row.id === boss.id).totalPulls, 10, "Realm B boss totals exclude Realm A and null-realm records");
  assert.equal(staleBosses.find(row => row.id === boss.id).totalPulls, 0, "A stale realm ID must produce an empty scope");
  const [alphaWeekly, betaWeekly, staleWeekly] = await Promise.all([
    apiJson(`/api/weekly?${realmQuery(fixture.alphaRealmId)}`), apiJson(`/api/weekly?${realmQuery(fixture.betaRealmId)}`), apiJson(`/api/weekly?${realmQuery(`${prefix}-stale`)}`),
  ]);
  const apiWeeklyStart = new Date(alphaWeekly.weekStart);
  const apiWeeklyEnd = new Date(alphaWeekly.weekEnd);
  const apiBoundedAlphaKills = (await database.query(`SELECT count(*)::int AS kills FROM encounters e
    JOIN uploads u ON u.id = e."uploadId"
    WHERE u."realmId" = $1 AND e.outcome = 'KILL' AND e."startedAt" >= $2 AND e."startedAt" < $3`,
  [fixture.alphaRealmId, apiWeeklyStart.toISOString(), apiWeeklyEnd.toISOString()])).rows[0].kills;
  assert.equal(apiBoundedAlphaKills, 22, "The API's own weekly bounds contain all selected-realm weekly fixtures");
  assert.equal(alphaWeekly.totalKills, 22); assert.equal(betaWeekly.totalKills, 10); assert.equal(staleWeekly.totalKills, 0);
  const [alphaBoard, betaBoard] = await Promise.all([
    apiJson(`/api/leaderboard?boss=${boss.slug}&metric=dps&take=10&${realmQuery(fixture.alphaRealmId)}`), apiJson(`/api/leaderboard?boss=${boss.slug}&metric=dps&take=10&${realmQuery(fixture.betaRealmId)}`),
  ]);
  assert.equal(alphaBoard.length, 10, "Realm A API top-10 is scoped before its limit");
  assert.equal(betaBoard.length, 10, "Realm B API top-10 is scoped before its limit");
  assert.ok(alphaBoard.every(row => row.playerName.startsWith("Qzrealma") || row.playerName === names.shared));
  assert.ok(betaBoard.every(row => row.playerName.startsWith("Qzrealmb") || row.playerName === names.shared));
  observations.push("API aggregates, weekly summaries and top-10 leaderboards isolate selected realms before limits; null-realm data remains All-only");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(20000);
  const visit = async route => {
    const response = await page.goto(href(route), { waitUntil: "networkidle", timeout: 60000 });
    assert.equal(response.status(), 200, route);
    await waitForPageContent(page);
  };
  const expectScope = async (route, selectedRealm, absentPlayer) => {
    await visit(route);
    const select = page.locator('select[name="realmId"]');
    await select.waitFor();
    assert.equal(await select.inputValue(), selectedRealm);
    if (absentPlayer) assert.equal((await page.locator("main").innerText()).includes(absentPlayer), false, `${route} excludes the other realm`);
  };

  for (const route of ["/raids", "/players", "/bosses", `/bosses/${boss.slug}`, "/leaderboards", "/weekly"]) {
    await visit(route);
    assert.equal(await page.locator('select[name="realmId"]').inputValue(), "", `${route} defaults to All realms`);
  }
  observations.push("Every realm-enabled browse page defaults its Realm select to All realms");

  await visit(`/players?${realmQuery(fixture.alphaRealmId, `q=${names.shared}`)}`);
  assert.equal(await page.locator('select[name="realmId"]').inputValue(), fixture.alphaRealmId, "Player directory renders the Realm control");
  const alphaRow = page.locator(`[data-player-row="${names.shared}"][data-player-realm="${fixture.realmNames.alpha}"]`);
  assert.equal(await alphaRow.count(), 1, "The selected realm retains exactly one same-name player row");
  assert.equal(await page.locator(`[data-player-row="${names.shared}"][data-player-realm="${fixture.realmNames.beta}"]`).count(), 0, "The other same-name player is excluded");
  const profileHref = await alphaRow.locator('a[href*="/players/"]').first().getAttribute("href");
  assert.equal(new URL(profileHref, base).searchParams.get("realm"), fixture.realmNames.alpha, "Same-name profile links retain the exact selected realm");
  await page.getByRole("button", { name: "Find players", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("realmId") === fixture.alphaRealmId);
  await visit(`/players?${realmQuery(fixture.alphaRealmId, "class=Mage&page=2")}`);
  assert.equal(await page.locator("[data-player-row]").count(), 1, "The selected realm player directory paginates after realm filtering");
  await page.getByRole("link", { name: "Previous", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("realmId") === fixture.alphaRealmId && url.searchParams.get("class") === "Mage" && !url.searchParams.has("page"));
  observations.push("Player directory filters and same-name profile links retain the exact realm");

  await expectScope(`/raids?${realmQuery(fixture.alphaRealmId)}`, fixture.alphaRealmId);
  assert.equal(await page.locator('main a[href^="/raids/"]').count(), 20, "Raids applies the selected realm before its twenty-upload page limit");
  for (const route of ["/bosses", `/bosses/${boss.slug}`, "/leaderboards", "/weekly"]) await expectScope(`${route}?${realmQuery(fixture.alphaRealmId)}`, fixture.alphaRealmId, "Qzrealmb");
  await visit(`/raids?${realmQuery(fixture.alphaRealmId, "page=2&difficulty=25H&class=Mage")}`);
  assert.match(await page.locator("main").innerText(), /Uploads 21–22 of 22/, "Raids paginate after the realm filter");
  const raidsForm = page.getByRole("button", { name: "Apply filters", exact: true });
  await raidsForm.click();
  await page.waitForURL(url => url.searchParams.get("realmId") === fixture.alphaRealmId && url.searchParams.get("difficulty") === "25H" && url.searchParams.get("class") === "Mage" && !url.searchParams.has("page"));
  observations.push("Realm selection is present on raids, bosses, boss detail, leaderboards and weekly pages; forms preserve supported filters while resetting pagination");

  await visit(`/leaderboards?${realmQuery(fixture.alphaRealmId, `difficulty=25H`)}`);
  const leaderboardRealmSelect = page.locator('select[name="realmId"]');
  assert.equal(await leaderboardRealmSelect.inputValue(), fixture.alphaRealmId, "Difficulty filters include the selected Realm control");
  assert.equal(await leaderboardRealmSelect.locator("xpath=ancestor::form[1]").getByRole("button", { name: "Apply filters", exact: true }).count(), 1, "The difficulty form applies the selected realm");
  assert.match(await page.locator("#all-time-averages").innerText(), /21 fights/, "All-time averages compose the selected realm with the 25H difficulty before their minimum-fight calculation");
  const averageProfileHref = await page.locator(`#all-time-averages a[href^="/players/${names.shared}"]`).first().getAttribute("href");
  assert.equal(new URL(averageProfileHref, base).searchParams.get("realmId"), fixture.alphaRealmId, "Average leaderboard profile links retain the selected realm ID");
  for (const label of ["Raids", "Leaderboards", "Players", "This Week", "Bosses"]) {
    const link = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: label, exact: true }).first();
    assert.equal(new URL(await link.getAttribute("href"), base).searchParams.get("realmId"), fixture.alphaRealmId, `Navigation preserves Realm A for ${label}`);
  }
  const search = page.getByRole("combobox", { name: "Search players", exact: true });
  await search.fill(names.shared);
  await page.waitForTimeout(350);
  const searchResult = page.getByRole("option", { name: new RegExp(`^${names.shared}`) });
  await searchResult.click();
  await page.waitForURL(url => url.pathname === `/players/${names.shared}`);
  assert.equal(new URL(page.url()).searchParams.get("realm"), fixture.realmNames.alpha, "Navigation search resolves the matching selected-realm player");
  await waitForPageContent(page);
  assert.match(await page.locator("main h1").innerText(), new RegExp(names.shared), "Search opens the selected same-name player profile rather than a not-found page");
  observations.push("Browse navigation and global player search retain the selected realm scope");

  await visit(`/players?${realmQuery(`${prefix}-stale`)}`);
  assert.match(await page.locator("main").innerText(), /No players found|Unavailable realm/i, "A stale player-realm link fails closed");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(`/leaderboards?${realmQuery(fixture.alphaRealmId)}`);
    await assertArtifact(page, `realm-leaderboards-${width}.png`);
    await visit(`/players?${realmQuery(fixture.alphaRealmId)}`);
    await assertArtifact(page, `realm-players-${width}.png`);
  }
  assert.deepEqual(errors, [], "Realm browsing must not cause browser errors");
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ ...metadata, observations }, null, 2));
  console.log(JSON.stringify({ status: "pass", observations }));
} finally {
  if (browser) await browser.close();
  if (database) {
    for (const [table, ids] of [["participants", owned.participants], ["encounters", owned.encounters], ["uploads", owned.uploads], ["players", owned.players], ["realms", owned.realms]]) {
      if (!ids.length) continue;
      const removed = await database.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [ids]);
      assert.equal(removed.rowCount, ids.length, `Clean up only this invocation's ${table}`);
    }
    await database.end();
  }
}
