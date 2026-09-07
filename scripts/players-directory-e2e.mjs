import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Client } from "pg";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";

// Author: Neil Mitchell
// Synthetic records are owned by this invocation and only written to loopback.
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
const url = new URL(process.env.DATABASE_URL ?? "");
const local = ["localhost", "127.0.0.1", "[::1]"];
assert.ok(local.includes(base.hostname) && local.includes(url.hostname));
assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
assert.ok([...url.searchParams.keys()].every(key => key === "schema"));
assert.equal(url.searchParams.get("schema") ?? "public", "public");
const database = new Client({
  host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432),
  database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password), connectionTimeoutMillis: 5000,
});
const out = path.resolve(process.env.PIZZA_PLAYERS_ARTIFACTS ?? ".test-artifacts/players-directory");
await fs.mkdir(out, { recursive: true });
const prefix = `players-e2e-${randomUUID()}`;
const ids = { players: [], caches: [], roster: [] };
const observations = [];
const classNames = ["Death Knight", "Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
const names = ["Qzrefdk", "Qzrefdruid", "Qzrefhunter", "Qzrefmage", "Qzrefpal", "Qzrefpriest", "Qzrefrogue", "Qzrefshaman", "Qzreflock", "Qzrefwar"];
const armoryUrl = (name, realm = "Lordaeron") => `https://armory.warmane.com/character/${name}/${realm}/summary`;
const gear = (name, className, realm = "Lordaeron") => ({
  characterName: name, realm, className, raceName: "Human", guildName: "Synthetic Guild",
  sourceUrl: armoryUrl(name, realm), fetchedAt: new Date().toISOString(), appearance: null,
  items: Array.from({ length: 18 }, (_, index) => ({ slot: `Slot ${index + 1}`, name: `Synthetic equipment ${index + 1}` })),
});
let browser;
await database.connect();
async function addCache(name, className, realm = "Lordaeron") {
  const id = `${prefix}-cache-${ids.caches.length}`;
  await database.query(`INSERT INTO armory_gear_cache
    (id,"characterName","characterKey",realm,"sourceUrl",gear,"fetchedAt","updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,now(),now())`, [id, name, name.toLowerCase(), realm, armoryUrl(name, realm), gear(name, className, realm)]);
  ids.caches.push(id);
}
try {
  assert.equal((await database.query("SELECT id FROM players WHERE name LIKE 'Qzref%'")).rowCount, 0, "Refuse to replace another fixture");
  assert.equal((await database.query("SELECT id FROM armory_gear_cache WHERE \"characterKey\" LIKE 'qzref%'")).rowCount, 0);
  const realms = (await database.query("SELECT id,name FROM realms WHERE host = 'warmane'")).rows;
  const lordaeron = realms.find(realm => realm.name === "Lordaeron");
  const icecrown = realms.find(realm => realm.name === "Icecrown");
  assert.ok(lordaeron && icecrown, "Run db:seed before browser acceptance");
  const rows = [...names.map((name, index) => ({ name, class: index === 4 ? "Warrior" : classNames[index], realmId: lordaeron.id })),
    { name: "Qzrefnone", class: null, realmId: lordaeron.id },
    { name: "Qzreflegacy", class: "Priest", realmId: null },
    { name: "Qzrefpal", class: "Mage", realmId: icecrown.id },
    ...Array.from({ length: 31 }, (_, index) => ({ name: `Qzrefz${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`, class: "Mage", realmId: lordaeron.id }))];
  for (const row of rows) {
    const id = `${prefix}-player-${ids.players.length}`;
    await database.query('INSERT INTO players (id,name,class,"realmId") VALUES ($1,$2,$3,$4)', [id, row.name, row.class, row.realmId]);
    ids.players.push(id);
  }
  await addCache("Qzrefpal", "paladin");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors = [];
  const requests = [];
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  await context.route("**/*", route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === base.origin) return route.continue();
    if (requestUrl.hostname === "cdn.warmane.com" && requestUrl.pathname.includes("/icons/")) {
      return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#555"/></svg>' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/\/api\/players\/[^/]+\/gear/.test(request.url())) requests.push(request.url()); });
  page.setDefaultTimeout(15000);
  const visit = async suffix => {
    const response = await page.goto(new URL(`/players${suffix}`, base).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await waitForPageContent(page);
  };
  await visit("?q=Qzref");
  assert.equal(requests.length, 0, "Directory rendering must not fan out gear fetches");
  assert.equal(await page.locator("[data-player-row]").count(), 30);
  const paladin = page.locator('[data-player-row="Qzrefpal"][data-player-realm="Lordaeron"]');
  assert.equal(await paladin.getAttribute("data-player-class"), "Paladin", "Armory class overrides wrong log class before render");
  assert.match(await paladin.locator("img").first().getAttribute("src"), /classicon_paladin/);
  assert.equal(await page.locator('[data-player-row="Qzrefpal"][data-player-realm="Icecrown"]').getAttribute("data-player-class"), "Mage");
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL(/page=2/);
  await waitForPageContent(page);
  assert.equal(await page.locator("[data-player-row]").count(), rows.length - 30);
  await visit("?q=Qzref&class=Paladin&includeShortPulls=1");
  assert.equal(await page.locator("[data-player-row]").count(), 1, "Canonical class filter agrees with displayed identity");
  await page.getByRole("button", { name: "Find players", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await waitForPageContent(page);
  assert.equal(new URL(page.url()).searchParams.get("class"), "Paladin");
  assert.equal(new URL(page.url()).searchParams.get("includeShortPulls"), "1");
  observations.push("Canonical cache/log resolution, cross-realm isolation, pagination and filter preservation");
  const legacyProfile = await context.request.get(new URL("/players/Qzreflegacy?realm=Lordaeron", base).href);
  assert.equal(legacyProfile.status(), 200, "Legacy null-realm players remain reachable through directory links");
  assert.equal((await context.request.get(new URL("/players/Qzreflegacy?realm=Icecrown", base).href)).status(), 404);
  await visit("?q=Qzrefnone");
  const unknown = page.locator('[data-player-row="Qzrefnone"]');
  assert.equal(await unknown.getAttribute("data-player-class"), "Unknown");
  assert.match(await unknown.innerText(), /Unknown class/);
  let correctionWrite;
  await context.route("**/api/players/Qzrefnone/gear?*", async route => {
    correctionWrite ??= addCache("Qzrefnone", "Shaman");
    await correctionWrite;
    await route.fulfill({ json: { ok: true, stale: false, className: "Shaman", raceName: "Human", guildName: "Synthetic Guild", gearScore: null, gear: gear("Qzrefnone", "Shaman") } });
  });
  const avatar = unknown.getByRole("button", { name: "View live gear for Qzrefnone" });
  await avatar.focus();
  await page.waitForFunction(() => document.querySelector('[data-player-row="Qzrefnone"]')?.getAttribute("data-player-class") === "Shaman");
  await page.waitForLoadState("networkidle");
  await waitForPageContent(page);
  assert.equal(await avatar.evaluate(el => el === document.activeElement), true, "Server class reconciliation retains keyboard focus");
  assert.equal(await page.getByRole("tooltip").isVisible(), true, "Class reconciliation keeps the quick look open");
  assert.match(await unknown.locator("img").first().getAttribute("src"), /classicon_shaman/);
  assert.match(await unknown.innerText(), /Shaman/);
  await page.keyboard.press("Escape");
  await avatar.blur();
  const beforeReopen = requests.length;
  await avatar.focus();
  await page.getByRole("tooltip").waitFor();
  assert.equal(requests.length, beforeReopen, "Healthy quick look is reused on keyboard reopening");
  await page.keyboard.press("Escape");
  observations.push("Live class correction synchronizes the whole row, filters refresh, keyboard reopen reuses cached gear");
  await visit("?q=Qzrefmage");
  let conflictWrite;
  await context.route("**/api/players/Qzrefmage/gear?*", async route => {
    conflictWrite ??= (async () => {
      await addCache("Qzrefmage", "Mage");
      const observedAt = "2026-09-06T00:00:00.000Z";
      await database.query('UPDATE armory_gear_cache SET "fetchedAt"=$1 WHERE id=$2', [observedAt, ids.caches.at(-1)]);
      const rosterId = `${prefix}-roster-conflict`;
      await database.query(`INSERT INTO guild_roster_members
        (id,character_name,normalized_character_name,guild_name,realm,class_name,armory_url,last_synced_at,updated_at)
        VALUES ($1,'Qzrefmage','qzrefmage','Synthetic Class Conflict','Lordaeron','Warlock',$2,$3,now())`,
      [rosterId, armoryUrl("Qzrefmage"), observedAt]);
      ids.roster.push(rosterId);
    })();
    await conflictWrite;
    await route.fulfill({ json: { ok: true, stale: false, className: null, classSource: "unknown", raceName: null, guildName: null, gearScore: null, gear: gear("Qzrefmage", "Mage") } });
  });
  await page.getByRole("button", { name: "View live gear for Qzrefmage" }).focus();
  await page.waitForFunction(() => document.querySelector('[data-player-row="Qzrefmage"]')?.getAttribute("data-player-class") === "Unknown");
  await page.waitForLoadState("networkidle");
  await waitForPageContent(page);
  assert.equal(await page.locator('[data-player-row="Qzrefmage"] [data-pizza-avatar]').getAttribute("data-character-class"), "");
  assert.match(await page.getByRole("tooltip").innerText(), /Unknown class/);
  await page.keyboard.press("Escape");
  observations.push("Equal-time conflicting observations remain canonical Unknown in server filters, row, avatar and quick look");
  const require = createRequire(import.meta.url);
  const axe = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit("?q=Qzref");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
    await page.addScriptTag({ content: axe });
    const audit = await page.evaluate(() => window.axe.run(document.querySelector("main")));
    assert.deepEqual(audit.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })), [], `Accessibility at ${width}px`);
    await page.screenshot({ path: path.join(out, `players-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 480 });
  await visit("?q=Qzrefnone");
  await page.getByRole("button", { name: "View live gear for Qzrefnone" }).click();
  const tooltip = page.getByRole("tooltip");
  await tooltip.waitFor();
  const bounds = await tooltip.boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 480, "Quick look fits short viewport");
  assert.ok(await tooltip.evaluate(el => el.scrollHeight > el.clientHeight || [...el.querySelectorAll("*")].some(child => child.scrollHeight > child.clientHeight && getComputedStyle(child).overflowY === "auto")), "Long quick look is scrollable");
  await page.screenshot({ path: path.join(out, "players-quicklook-short.png") });
  assert.deepEqual(errors, []);
  observations.push("375/768/1440px accessibility and overflow, short-screen gear scrolling, no browser errors");
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ author: "Neil Mitchell", modifier: "Neil Mitchell", observations }, null, 2));
  console.log(JSON.stringify({ status: "pass", observations }));
} finally {
  if (browser) await browser.close();
  for (const [table, ownedIds] of [["armory_gear_cache", ids.caches], ["guild_roster_members", ids.roster], ["players", ids.players]]) {
    if (!ownedIds.length) continue;
    const removed = await database.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [ownedIds]);
    assert.equal(removed.rowCount, ownedIds.length, `Clean up only owned ${table} fixtures`);
  }
  await database.end();
}
