import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Client } from "pg";
import { chromium } from "playwright";

// Author: Neil Mitchell
// Last Modified By: Neil Mitchell
// All records are illustrative, invocation-owned, and restricted to loopback.
const metadata = { author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell" };
const out = path.resolve(process.env.PIZZA_COMPARISON_ARTIFACTS ?? ".test-artifacts/player-raid-comparison");
const prefix = `comparison-e2e-${randomUUID()}`;
const owned = { participants: [], encounters: [], uploads: [], armory_gear_cache: [], players: [] };
const observations = [];
const names = ["Qzraidchart", "Qzraidone", "Qzraidempty"];
const dates = ["2026-07-26", "2026-08-16", "2026-08-30", "2026-09-06"];
const previousDps = [12400, 11600, 6800, 12900, 11900, 12000, 10100, 9500, 10400, 0, 9100, 7300];
const latestDps = [13900, 12400, 7920, 14100, 13600, 12900, 10900, 10500, 11000, 5500, 9600, 8800];
const errors = [];
let database;
let browser;
let page;
let connected = false;
let fixtureReady = false;
let failure;
let fixture;

const armoryUrl = (name, realm) => `https://armory.warmane.com/character/${name}/${realm}/summary`;
const gear = (name, realm) => ({
  characterName: name, realm, className: "Rogue", raceName: "Human", guildName: "Synthetic Test Guild",
  sourceUrl: armoryUrl(name, realm), fetchedAt: new Date().toISOString(), appearance: null,
  items: Array.from({ length: 18 }, (_, index) => ({ slot: `Slot ${index + 1}`, name: `Synthetic equipment ${index + 1}` })),
});

async function seed() {
  // Fixed character names aid readable screenshots. Refuse any prior fixture,
  // including retained fixtures, rather than updating or deleting its records.
  assert.equal((await database.query("SELECT id FROM players WHERE lower(name) = ANY($1::text[])", [names.map(name => name.toLowerCase())])).rowCount, 0,
    "Refuse an existing named comparison fixture; clean it using its original owned-ID manifest first");
  assert.equal((await database.query('SELECT id FROM armory_gear_cache WHERE "characterKey" = ANY($1::text[])', [names.map(name => name.toLowerCase())])).rowCount, 0,
    "Refuse existing comparison armory fixtures");
  const realms = (await database.query("SELECT id,name FROM realms WHERE host = 'warmane'")).rows;
  const lordaeron = realms.find(realm => realm.name === "Lordaeron");
  const icecrown = realms.find(realm => realm.name === "Icecrown");
  const bosses = (await database.query('SELECT id,name,slug,"raidSlug" FROM bosses ORDER BY "sortOrder",slug')).rows;
  const icc = bosses.filter(boss => boss.raidSlug === "icecrown-citadel");
  const halion = bosses.find(boss => boss.slug === "halion");
  assert.ok(lordaeron && icecrown && icc.length === 12 && halion, "Run db:seed against this local schema first");
  const players = {};
  for (const [name, realm] of [[names[0], lordaeron], [names[0], icecrown], [names[1], lordaeron], [names[2], lordaeron]]) {
    const id = `${prefix}-player-${owned.players.length}`;
    await database.query('INSERT INTO players (id,name,class,"realmId") VALUES ($1,$2,\'Rogue\',$3)', [id, name, realm.id]);
    owned.players.push(id);
    players[`${name}:${realm.name}`] = id;
    const cacheId = `${prefix}-cache-${owned.armory_gear_cache.length}`;
    await database.query(`INSERT INTO armory_gear_cache
      (id,"characterName","characterKey",realm,"sourceUrl",gear,"fetchedAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,now(),now())`, [cacheId, name, name.toLowerCase(), realm.name, armoryUrl(name, realm.name), gear(name, realm.name)]);
    owned.armory_gear_cache.push(cacheId);
  }
  async function upload(realm) {
    const id = `${prefix}-upload-${owned.uploads.length}`;
    await database.query(`INSERT INTO uploads
      (id,"publicSlug",filename,"fileHash","fileSize",status,"realmId","updatedAt")
      VALUES ($1,$2,'synthetic-view-acceptance.log',$3,0,'DONE',$4,now())`, [id, `${id}-report`, `${id}-hash`, realm.id]);
    owned.uploads.push(id);
    return id;
  }
  async function fight({ uploadId, sessionIndex = 0, boss, date, index = 0, playerId, dps, hps = 0, aps = 500, difficulty = "25H", outcome = "KILL", duration = 120 }) {
    const id = `${prefix}-encounter-${owned.encounters.length}`;
    const start = new Date(`${date}T18:00:00.000Z`);
    start.setUTCMinutes(start.getUTCMinutes() + index * 5);
    const end = new Date(start.getTime() + duration * 1000);
    await database.query(`INSERT INTO encounters
      (id,"uploadId","bossId",fingerprint,outcome,difficulty,"groupSize","sessionIndex","durationSeconds","durationMs","startedAt","endedAt","totalDamage","totalHealing","totalAbsorbs")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [id, uploadId, boss.id, `${id}-fingerprint`, outcome, difficulty, difficulty.startsWith("10") ? 10 : 25,
      sessionIndex, duration, duration * 1000, start, end, dps * duration, hps * duration, aps * duration]);
    owned.encounters.push(id);
    const participantId = `${prefix}-participant-${owned.participants.length}`;
    await database.query(`INSERT INTO participants
      (id,"encounterId","playerId",role,spec,"totalDamage","totalHealing","totalAbsorbs",dps,hps,aps)
      VALUES ($1,$2,$3,'DPS','Combat',$4,$5,$6,$7,$8,$9)`,
    [participantId, id, playerId, dps * duration, hps * duration, aps * duration, dps, hps, aps]);
    owned.participants.push(participantId);
    return id;
  }
  const playerId = players[`${names[0]}:Lordaeron`];
  const uploads = [await upload(lordaeron), await upload(lordaeron)];
  const sessions = [];
  const fights = [];
  for (let run = 0; run < dates.length; run++) {
    const uploadId = uploads[Math.floor(run / 2)];
    const sessionIndex = run % 2;
    sessions.push(`${uploadId}:${sessionIndex}`);
    fights[run] = [];
    for (let index = 0; index < icc.length; index++) {
      if (run === 3 && icc[index].slug === "the-lich-king") continue;
      const dps = run === 3 ? latestDps[index] : run === 2 ? previousDps[index] : 9000 + run * 1000 + index * 100;
      fights[run][index] = await fight({ uploadId, sessionIndex, boss: icc[index], date: dates[run], index, playerId, dps,
        hps: 40 + run * 20 + index * 3, duration: run === 3 && icc[index].slug === "gunship-battle" ? 12 : 120 });
    }
  }
  // More than 50 later participant records ensure July's session cannot be
  // reconstructed from the existing profile's latest-50 encounter summary.
  for (let index = 0; index < 20; index++) {
    await fight({ uploadId: uploads[1], sessionIndex: 1, boss: icc[0], date: dates[3], index: 12 + index, playerId,
      dps: 3000000, hps: 40000, outcome: "WIPE" });
  }
  const otherScope = await upload(lordaeron);
  await fight({ uploadId: otherScope, boss: icc[0], date: "2026-07-12", playerId, dps: 7200, difficulty: "10N" });
  await fight({ uploadId: otherScope, sessionIndex: 1, boss: halion, date: "2026-07-05", playerId, dps: 8200 });
  await fight({ uploadId: await upload(icecrown), boss: icc[0], date: dates[3], playerId: players[`${names[0]}:Icecrown`], dps: 99000000 });
  await fight({ uploadId: await upload(lordaeron), boss: icc[0], date: dates[3], playerId: players[`${names[1]}:Lordaeron`], dps: 15000 });
  return { playerName: names[0], playerId, sessions, fights, bossNames: icc.map(boss => boss.name) };
}

async function run() {
  const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const local = ["localhost", "127.0.0.1", "[::1]"];
  assert.ok(local.includes(base.hostname) && local.includes(url.hostname), "Only loopback browser and database hosts are allowed");
  assert.ok(["http:", "https:"].includes(base.protocol) && !base.username && !base.password, "Use a local HTTP base URL without credentials");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "Expected a PostgreSQL connection URL");
  assert.ok([...url.searchParams.keys()].every(key => key === "schema"), "Only the schema query parameter is allowed");
  assert.ok(url.searchParams.getAll("schema").length <= 1, "Specify at most one database schema");
  const schema = url.searchParams.get("schema") ?? "public";
  assert.ok(/^[a-z0-9_]+$/.test(schema) && Buffer.byteLength(schema) <= 63, "Use public or a validated lowercase task schema");
  database = new Client({
    host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), connectionTimeoutMillis: 5000,
  });
  await database.connect();
  connected = true;
  await database.query(`SET search_path TO "${schema}"`);
  assert.equal((await database.query("SELECT current_schema() AS name")).rows[0].name, schema, "The selected schema must already exist");
  assert.equal((await database.query("SELECT pg_try_advisory_lock(hashtext(current_schema()), hashtext('pizza-player-comparison-e2e')) AS locked")).rows[0].locked, true,
    "Another comparison acceptance run owns this schema; do not overlap named fixtures");
  fixture = await seed();
  fixtureReady = true;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  await context.route("**/*", route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === base.origin) return route.continue();
    if (requestUrl.hostname === "cdn.warmane.com" && requestUrl.pathname.includes("/icons/")) {
      return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#555"/></svg>' });
    }
    return route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  const section = page.locator("#raid-progress");
  const first = section.getByLabel("First raid", { exact: true });
  const second = section.getByLabel("Second raid", { exact: true });
  async function visit(name = names[0], query = "realm=Lordaeron&includeShortPulls=1") {
    const response = await page.goto(new URL(`/players/${name}?${query}`, base).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Synthetic player profile is reachable");
    await section.waitFor();
    await section.getByRole("heading", { name: "DPS by successful boss fight", exact: true }).waitFor();
  }
  async function choose(label, value) {
    await section.getByLabel(label, { exact: true }).selectOption(value);
    await page.waitForFunction(({ label, value }) => {
      const root = document.querySelector("#raid-progress");
      const field = [...root.querySelectorAll("label")].find(element => element.textContent === label);
      const select = field && document.getElementById(field.htmlFor);
      return select?.value === value && root.querySelector('[aria-busy="false"]');
    }, { label, value });
    await page.waitForLoadState("networkidle");
  }
  async function values(metric = "DPS") {
    const summary = section.locator("summary", { hasText: `View ${metric} chart values` });
    if (!await summary.evaluate(element => element.parentElement.open)) await summary.click();
    return section.getByRole("table");
  }
  const row = name => section.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });
  const assertRates = async (name, expected) => {
    assert.deepEqual(await row(name).getByRole("cell").allTextContents(), expected.map(value => `${value}Combat`));
  };

  await visit();
  assert.equal(await first.inputValue(), fixture.sessions[3], "Default first raid is September 6");
  assert.equal(await second.inputValue(), fixture.sessions[2], "Default second raid is August 30");
  assert.deepEqual(await first.locator("option").evaluateAll(options => options.map(option => option.value)), [...fixture.sessions].reverse(), "All four sessions survive the latest-50 summary boundary");
  assert.match(await section.innerText(), /4 recorded raids in this scope/);
  await values();
  assert.equal(await section.locator("tbody tr").count(), 12);
  assert.deepEqual(await section.locator("tbody th").allTextContents(), fixture.bossNames, "Bosses retain canonical raid order");
  await assertRates("Lord Marrowgar", ["13.90K", "12.40K"]);
  await assertRates("Gunship Battle", ["7.92K", "6.80K"]);
  await assertRates("Valithria Dreamwalker", ["5.50K", "0.00"]);
  const lichCells = row("The Lich King").getByRole("cell");
  assert.match(await lichCells.nth(1).textContent(), /7\.30K/);
  assert.match(await lichCells.nth(0).textContent(), /Unavailable.*No recorded kill/);
  assert.equal(await lichCells.nth(0).getByRole("link").count(), 0, "A missing kill is neither zero nor a fabricated encounter");
  const source = row("Lord Marrowgar").getByRole("link").nth(0);
  const sourcePath = `/encounters/${fixture.fights[3][0]}?includeShortPulls=1`;
  assert.equal(await source.getAttribute("href"), sourcePath, "Values link to their stored source encounter");
  assert.equal((await context.request.get(new URL(sourcePath, base).href)).status(), 200, "The source encounter route resolves");
  assert.doesNotMatch(await section.getByRole("table").textContent(), /99\.00M|3\.00M/, "Same-name other-realm values and wipes never enter this player's chart");
  observations.push("Four sessions from two uploads, latest-two defaults, boss order, short kills, missing-vs-zero values, source encounter, and wipe/realm isolation");

  await section.getByRole("group", { name: "Metric", exact: true }).getByRole("button", { name: "HPS", exact: true }).click();
  await section.getByRole("heading", { name: "HPS by successful boss fight", exact: true }).waitFor();
  await values("HPS");
  await assertRates("Lord Marrowgar", ["100.00", "80.00"]);
  assert.match(await section.innerText(), /Effective healing per second/);
  assert.doesNotMatch(await row("Lord Marrowgar").textContent(), /580\.00|600\.00/, "HPS does not silently include the separately stored 500 APS");
  assert.equal(new URL(page.url()).searchParams.get("comparisonMetric"), "HPS", "Metric choice is shareable in the URL");
  await page.reload({ waitUntil: "networkidle" });
  await section.getByRole("heading", { name: "HPS by successful boss fight", exact: true }).waitFor();
  await values("HPS");
  await assertRates("Lord Marrowgar", ["100.00", "80.00"]);
  await choose("Second raid", fixture.sessions[1]);
  await section.getByRole("heading", { name: "HPS by successful boss fight", exact: true }).waitFor();
  await values("HPS");
  await assertRates("Lord Marrowgar", ["100.00", "60.00"]);
  await choose("Second raid", fixture.sessions[2]);
  await values("HPS");
  const legend = section.getByRole("group", { name: "Show or hide a raid line", exact: true });
  assert.equal(await section.locator(".recharts-line-curve").count(), 2);
  await legend.getByRole("button").nth(0).click();
  assert.equal(await legend.getByRole("button").nth(0).getAttribute("aria-pressed"), "false");
  assert.equal(await section.locator(".recharts-line-curve").count(), 1);
  await assertRates("Lord Marrowgar", ["100.00", "80.00"]);
  await legend.getByRole("button").nth(1).click();
  assert.match(await section.innerText(), /Select a raid in the legend to show its line/);
  await legend.getByRole("button").nth(0).click();
  await legend.getByRole("button").nth(1).click();
  await section.getByRole("group", { name: "Metric", exact: true }).getByRole("button", { name: "DPS", exact: true }).click();
  observations.push("DPS/HPS switch uses stored effective healing separately from APS, persists in URL/reload/session changes; both legend toggles work and values remain available");

  await choose("Second raid", fixture.sessions[0]);
  const selectedUrl = new URL(page.url());
  assert.equal(selectedUrl.searchParams.get("comparisonFirst"), fixture.sessions[3]);
  assert.equal(selectedUrl.searchParams.get("comparisonSecond"), fixture.sessions[0]);
  assert.equal(selectedUrl.searchParams.get("realm"), "Lordaeron");
  assert.equal(selectedUrl.searchParams.get("includeShortPulls"), "1");
  await values();
  await assertRates("Lord Marrowgar", ["13.90K", "9.00K"]);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await second.inputValue(), fixture.sessions[0], "Selected session survives reload");
  await choose("Difficulty", "10N");
  assert.equal(await first.locator("option").count(), 1);
  assert.equal(await second.isDisabled(), true);
  assert.match(await section.innerText(), /One recorded raid in this scope/);
  await values();
  assert.equal(await section.locator("tbody tr").count(), 1);
  await assertRates("Lord Marrowgar", ["7.20K"]);
  await choose("Raid", "ruby-sanctum");
  assert.equal(await section.getByLabel("Difficulty", { exact: true }).inputValue(), "25H");
  await values();
  assert.deepEqual(await section.locator("tbody th").allTextContents(), ["Halion"]);
  await assertRates("Halion", ["8.20K"]);
  observations.push("Oldest-session URL selection/reload preserves realm and short-pull preference; raid and difficulty filters isolate scopes and show single-run state");

  await visit(names[1]);
  assert.equal(await second.isDisabled(), true);
  assert.match(await section.innerText(), /One recorded raid in this scope/);
  await values();
  await assertRates("Lord Marrowgar", ["15.00K"]);
  const emptyResponse = await page.goto(new URL(`/players/${names[2]}?realm=Lordaeron`, base).href, { waitUntil: "networkidle" });
  assert.equal(emptyResponse.status(), 200);
  assert.match(await section.innerText(), /No successful boss kills recorded/);
  assert.equal(await section.getByRole("combobox").count(), 0);
  await visit(names[0], "realm=Icecrown");
  await values();
  await assertRates("Lord Marrowgar", ["99.00M"]);
  observations.push("Independent one-run, no-kill, and same-name other-realm profiles render their own history");

  const require = createRequire(import.meta.url);
  const axe = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(names[0], "realm=Lordaeron");
    await values();
    await assertRates("Gunship Battle", ["7.92K", "6.80K"]);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page horizontal overflow at ${width}px`);
    assert.ok(await section.getByTestId("player-raid-comparison-chart").evaluate(element => element.scrollWidth <= element.clientWidth), `No chart horizontal overflow at ${width}px`);
    assert.deepEqual(await section.locator("td .tabular-nums").evaluateAll(elements => elements.flatMap(element => {
      const bounds = element.getBoundingClientRect();
      const cell = element.closest("td").getBoundingClientRect();
      return bounds.left < cell.left - 1 || bounds.right > cell.right + 1 ? [element.textContent] : [];
    })), [], `Numeric values fit their table cells at ${width}px`);
    assert.ok(await section.getByRole("combobox").evaluateAll(elements => elements.every(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= window.innerWidth;
    })), `Selectors fit the viewport at ${width}px`);
    await page.addScriptTag({ content: axe });
    const audit = await page.evaluate(() => window.axe.run(document.querySelector("#raid-progress")));
    assert.deepEqual(audit.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })), [], `Comparison accessibility at ${width}px`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, `comparison-${width}.png`), fullPage: true });
    await section.screenshot({ path: path.join(out, `comparison-section-${width}.png`) });
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  observations.push("375/768/1440px screenshots, expanded values accessibility/overflow, short kills without the short-pull preference, and no browser runtime errors");
}

await fs.mkdir(out, { recursive: true });
try {
  await run();
} catch (error) {
  failure = { name: error.name, message: error.message };
  if (page && !page.isClosed()) {
    try {
      await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true });
      await fs.writeFile(path.join(out, "failure-geometry.json"), JSON.stringify({ ...metadata, geometry: await page.locator("#raid-progress").evaluate(root => ({
        width: root.clientWidth, scrollWidth: root.scrollWidth,
        overflow: [...root.querySelectorAll("*")].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => ({
          tag: element.tagName, class: element.getAttribute("class"), width: element.clientWidth, scrollWidth: element.scrollWidth,
        })),
      })) }, null, 2));
    } catch {
      observations.push("Failure screenshot or geometry was unavailable; the original assertion is retained");
    }
  }
} finally {
  try {
    if (browser) await browser.close();
  } catch (error) {
    failure ??= { name: error.name, message: `Browser cleanup: ${error.message}` };
  }
  if (connected) {
    const keep = process.env.PIZZA_COMPARISON_KEEP_FIXTURE === "1" && fixtureReady;
    try {
      if (keep) {
        await fs.writeFile(path.join(out, "owned-fixture.json"), JSON.stringify({ ...metadata, prefix, owned, fixture, note: "Illustrative local records; delete only these exact owned IDs when preview is finished." }, null, 2));
        observations.push("Fixture retained by PIZZA_COMPARISON_KEEP_FIXTURE=1; exact ownership is recorded in owned-fixture.json");
      } else {
        for (const [table, ids] of Object.entries(owned)) {
          if (!ids.length) continue;
          const removed = await database.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [ids]);
          assert.equal(removed.rowCount, ids.length, `Clean up only owned ${table} fixtures`);
        }
        observations.push("Removed only this invocation's exact UUID-owned fixture rows");
      }
    } catch (error) {
      failure ??= { name: error.name, message: `Fixture cleanup: ${error.message}` };
      await fs.writeFile(path.join(out, "cleanup-required.json"), JSON.stringify({ ...metadata, prefix, owned, note: "Cleanup failed; verify and delete only the exact remaining owned IDs." }, null, 2));
    }
  }
  if (database) {
    try { await database.end(); } catch (error) { failure ??= { name: error.name, message: `Database cleanup: ${error.message}` }; }
  }
}
const result = { ...metadata, status: failure ? "fail" : "pass", observations, ...(failure ? { failure } : {}) };
await fs.writeFile(path.join(out, "results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (failure) process.exitCode = 1;
