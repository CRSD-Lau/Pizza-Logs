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
const timings = [];
const denseMeasurements = [];
const names = ["Qzraidchart", "Qzraidone", "Qzraidempty", "Qzraiddense"];
const dates = ["2026-07-26", "2026-08-16", "2026-08-30", "2026-09-06"];
const previousDps = [12400, 11600, 6800, 12900, 11900, 12000, 10100, 9500, 10400, 0, 9100, 7300];
const latestDps = [13900, 12400, 7920, 14100, 13600, 12900, 10900, 10500, 11000, 5500, 9600, 8800];
const normalBossIndexes = new Set([1, 6, 8, 10, 11]);
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
  for (const [name, realm] of [[names[0], lordaeron], [names[0], icecrown], [names[1], lordaeron], [names[2], lordaeron], [names[3], lordaeron]]) {
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
        difficulty: normalBossIndexes.has(index) ? "25N" : "25H", hps: 40 + run * 20 + index * 3,
        duration: run === 3 && icc[index].slug === "gunship-battle" ? 12 : 120 });
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
  const denseUpload = await upload(lordaeron);
  const denseSessions = [];
  for (let run = 0; run < 250; run++) {
    const date = new Date(Date.UTC(2025, 11, 31 + run)).toISOString().slice(0, 10);
    denseSessions.push(`${denseUpload}:${run}`);
    for (let index = 0; index < 3; index++) {
      // The newest raid is a lone observation; the previous raid has two
      // isolated observations separated by a missing boss. Sparse evidence
      // must remain visible when ordinary dense-history dots are suppressed.
      if (run === 249 && index !== 1 || run === 248 && index === 1) continue;
      await fight({ uploadId: denseUpload, sessionIndex: run, boss: icc[index], date, index,
        playerId: players[`${names[3]}:Lordaeron`], dps: 7000 + run % 25 * 75 + index * 500, hps: 0 });
    }
  }
  return { playerName: names[0], playerId, sessions, fights, bossNames: icc.map(boss => boss.name), denseSessions };
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
  const highlight = section.getByLabel("Highlight raid", { exact: true });
  const chart = section.getByTestId("player-raid-comparison-chart");
  const lineCount = () => section.locator(".recharts-line").count();
  const twoFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function measure(label, maxMs, action) {
    const start = performance.now();
    await action();
    await twoFrames();
    const elapsedMs = Math.round(performance.now() - start);
    timings.push({ label, elapsedMs, maxMs });
    assert.ok(elapsedMs < maxMs, `${label}: ${elapsedMs}ms exceeds ${maxMs}ms`);
  }
  async function visit(name = names[0], query = "realm=Lordaeron&includeShortPulls=1") {
    const response = await page.goto(new URL(`/players/${name}?${query}`, base).href, { waitUntil: "networkidle", timeout: 30000 });
    assert.equal(response.status(), 200);
    await section.getByRole("heading", { name: "DPS by successful boss fight", exact: true }).waitFor();
    await twoFrames();
    return response;
  }
  async function choose(label, value) {
    await section.getByLabel(label, { exact: true }).selectOption(value);
    await page.waitForFunction(({ label, value }) => {
      const root = document.querySelector("#raid-progress");
      const field = [...root.querySelectorAll("label")].find(element => element.textContent === label);
      const select = field && document.getElementById(field.htmlFor);
      return select?.value === value && root.querySelector('[aria-busy="false"]');
    }, { label, value });
    if (label !== "Highlight raid") await page.waitForLoadState("networkidle");
    await twoFrames();
  }
  async function metric(value) {
    await section.getByRole("group", { name: "Metric", exact: true }).getByRole("button", { name: value, exact: true }).click();
    await section.getByRole("heading", { name: `${value} by successful boss fight`, exact: true }).waitFor();
    await twoFrames();
  }
  async function disclosure(text) {
    const summary = section.locator("summary", { hasText: text });
    if (!await summary.evaluate(element => element.parentElement.open)) await summary.click();
  }
  async function values(metric = "DPS") {
    await disclosure(`View ${metric} chart values`);
    await section.getByRole("table").waitFor({ state: "visible" });
  }
  async function pageValues() {
    return section.locator("tbody tr").evaluateAll(rows => rows.map(row => {
      const cells = [...row.querySelectorAll("th,td")];
      const valueCell = cells.at(-1);
      return {
        date: cells[0].querySelector("time")?.getAttribute("datetime")?.slice(0, 10) ?? cells[0].textContent.trim(),
        boss: cells[1].querySelector('[data-testid="raid-value-boss-name"]')?.textContent.trim() ?? cells[1].textContent.trim(),
        difficulty: cells[1].textContent.match(/(?:10|25)[NH]/)?.[0] ?? null,
        value: valueCell.querySelector(".tabular-nums")?.textContent ?? null,
        text: valueCell.textContent,
        href: valueCell.querySelector("a")?.getAttribute("href") ?? null,
      };
    }));
  }
  async function allValues(metricName = "DPS", expectedLines = 4) {
    await values(metricName);
    const previous = section.getByRole("button", { name: "Previous values page", exact: true });
    const next = section.getByRole("button", { name: "Next values page", exact: true });
    while (await previous.count() && !await previous.isDisabled()) await previous.click();
    const entries = [];
    for (let pageNumber = 0; pageNumber < 50; pageNumber++) {
      const rows = await pageValues();
      assert.ok(rows.length <= 25, "Only one values page is mounted");
      entries.push(...rows);
      assert.equal(await lineCount(), expectedLines, "Values pagination never changes chart lines");
      if (!await next.count() || await next.isDisabled()) return entries;
      await next.click();
    }
    throw new Error("Unexpected values page loop");
  }
  function entry(rows, date, boss) {
    const matches = rows.filter(row => row.date === date && row.boss === boss);
    assert.equal(matches.length, 1, `One values row for ${date} / ${boss}`);
    return matches[0];
  }
  async function assertLayout(width) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`);
    assert.ok(await chart.evaluate(element => element.scrollWidth <= element.clientWidth), `No chart overflow at ${width}px`);
    assert.deepEqual(await section.locator("td .tabular-nums").evaluateAll(elements => elements.flatMap(element => {
      const bounds = element.getBoundingClientRect(), cell = element.closest("td").getBoundingClientRect();
      return bounds.left < cell.left - 1 || bounds.right > cell.right + 1 ? [element.textContent] : [];
    })), [], `Numbers fit table cells at ${width}px`);
    assert.ok(await section.getByRole("combobox").evaluateAll(elements => elements.every(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    })), `Selectors fit viewport at ${width}px`);
  }

  await visit();
  assert.equal(await section.getByLabel("Difficulty", { exact: true }).inputValue(), "25", "Default scope combines normal and heroic at the same raid size");
  assert.equal(await section.getByLabel("First raid", { exact: true }).count(), 0);
  assert.equal(await section.getByLabel("Second raid", { exact: true }).count(), 0);
  assert.equal(await highlight.inputValue(), fixture.sessions[3]);
  assert.deepEqual(await highlight.locator("option").evaluateAll(options => options.map(option => option.value)), [...fixture.sessions].reverse());
  assert.equal(await lineCount(), 4, "All four sessions are drawn by default, including history beyond 50 encounters");
  assert.equal(await section.getByRole("table").count(), 0, "Table is lazy-mounted");
  const dpsRows = await allValues();
  assert.equal(dpsRows.length, 48, "All raid/boss combinations are reachable");
  assert.equal(dpsRows.filter(row => row.value !== null).length, 47, "Three complete mixed-mode raids and one incomplete raid have 47 actual observations");
  assert.equal(await section.locator(".recharts-line-dot").count(), 47, "The chart draws each recorded normal and heroic observation");
  assert.equal(await section.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count(), 12, "All twelve canonical ICC boss labels are rendered");
  for (const date of dates) {
    assert.equal(dpsRows.filter(row => row.date === date && row.difficulty === "25N").length, date === dates[3] ? 4 : 5);
    assert.equal(dpsRows.filter(row => row.date === date && row.difficulty === "25H").length, 7);
  }
  assert.deepEqual(dpsRows.slice(0, 12).map(row => row.boss), fixture.bossNames);
  for (const [date, boss, value] of [[dates[3], "Lord Marrowgar", "13.90K"], [dates[2], "Lord Marrowgar", "12.40K"],
    [dates[0], "Lord Marrowgar", "9.00K"], [dates[3], "Gunship Battle", "7.92K"], [dates[2], "Valithria Dreamwalker", "0.00"]]) {
    assert.equal(entry(dpsRows, date, boss).value, value);
  }
  const missingKill = entry(dpsRows, dates[3], "The Lich King");
  assert.equal(missingKill.value, null);
  assert.match(missingKill.text, /Unavailable.*No recorded kill/);
  assert.equal(missingKill.href, null);
  const sourcePath = `/encounters/${fixture.fights[3][0]}?includeShortPulls=1`;
  assert.equal(entry(dpsRows, dates[3], "Lord Marrowgar").href, sourcePath);
  assert.equal((await context.request.get(new URL(sourcePath, base).href)).status(), 200);
  assert.ok(dpsRows.every(row => !["99.00M", "3.00M"].includes(row.value)));
  observations.push("Default combines five normal and seven heroic bosses per raid: 47 actual points across four runs, 48 canonical slots and all 12 labels; table carries actual difficulty, zero/missing/source values and exact realm isolation");

  for (const [mode, pointCount, perComplete] of [["25N", 19, 5], ["25H", 28, 7]]) {
    await choose("Difficulty", mode);
    const exactRows = await allValues();
    assert.equal(exactRows.length, 48, "Exact difficulty retains all 12 canonical boss slots per raid");
    assert.equal(exactRows.filter(row => row.value !== null).length, pointCount);
    assert.equal(await section.locator(".recharts-line-dot").count(), pointCount);
    assert.equal(await section.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count(), 12);
    assert.ok(exactRows.filter(row => row.value !== null).every(row => row.difficulty === mode));
    for (const date of dates.slice(0, 3)) assert.equal(exactRows.filter(row => row.date === date && row.value !== null).length, perComplete);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await section.getByLabel("Difficulty", { exact: true }).inputValue(), mode, "Explicit exact-mode URLs survive reload");
    assert.equal(await section.locator(".recharts-line-dot").count(), pointCount);
  }
  await choose("Difficulty", "25");
  assert.equal(await section.locator(".recharts-line-dot").count(), 47);
  observations.push("Exact 25N/25H filters preserve five/seven measurements per complete raid and 12-slot gaps; explicit URLs reload without reverting to combined mode");

  await choose("Highlight raid", fixture.sessions[0]);
  assert.equal(await lineCount(), 4, "Highlight never filters history");
  const oldMarrowgar = section.locator(`.recharts-line-dot[data-run-key="${fixture.sessions[0]}"][data-boss-index="0"]`);
  await oldMarrowgar.hover();
  const tooltip = section.getByTestId("highlighted-raid-tooltip");
  await tooltip.waitFor({ state: "visible" });
  assert.equal(await tooltip.getAttribute("data-run-key"), fixture.sessions[0]);
  assert.equal(await tooltip.locator("time").count(), 1, "Tooltip includes only the highlighted raid");
  assert.equal((await tooltip.locator("time").getAttribute("datetime")).slice(0, 10), dates[0]);
  assert.match(await tooltip.innerText(), /Lord Marrowgar/);
  assert.match(await tooltip.innerText(), /9\.00K DPS/);
  assert.match(await tooltip.innerText(), /25H/, "Tooltip identifies the stored encounter difficulty");
  assert.doesNotMatch(await tooltip.innerText(), /13\.90K|12\.40K/);
  const tooltipBounds = await tooltip.boundingBox();
  assert.ok(tooltipBounds.width <= 260 && tooltipBounds.height <= 250 && (await tooltip.innerText()).length < 250, "Tooltip remains compact with all runs visible");
  await page.mouse.move(0, 0);
  await disclosure("Choose visible raids");
  const visibility = section.getByRole("group", { name: "Visible raid lines", exact: true });
  await visibility.waitFor({ state: "visible" });
  assert.equal(await visibility.getByRole("button").count(), 4);
  await visibility.getByRole("button").nth(0).click();
  assert.equal(await lineCount(), 3);
  await choose("Highlight raid", fixture.sessions[3]);
  assert.equal(await lineCount(), 4, "Highlight reveals a hidden raid");
  for (let index = 0; index < 4; index++) {
    const button = visibility.getByRole("button").nth(index);
    if (await button.getAttribute("aria-pressed") === "true") await button.click();
  }
  assert.equal(await lineCount(), 0);
  await section.getByRole("button", { name: "Show all raids", exact: true }).click();
  await twoFrames();
  assert.equal(await lineCount(), 4);
  await visibility.getByRole("button").first().focus();
  await page.keyboard.press("Space");
  assert.equal(await lineCount(), 3);
  await page.keyboard.press("Space");
  assert.equal(await lineCount(), 4);
  observations.push("Highlight keeps all runs and reveals hidden ones; visibility controls support keyboard and all-hidden recovery via Show all");

  await metric("HPS");
  assert.equal(new URL(page.url()).searchParams.get("comparisonMetric"), "HPS");
  const hpsRows = await allValues("HPS");
  for (const [date, value] of [[dates[3], "100.00"], [dates[2], "80.00"], [dates[0], "40.00"]]) assert.equal(entry(hpsRows, date, "Lord Marrowgar").value, value);
  assert.ok(hpsRows.every(row => !["580.00", "600.00"].includes(row.value)), "HPS excludes separate APS");
  await page.reload({ waitUntil: "networkidle" });
  await section.getByRole("heading", { name: "HPS by successful boss fight", exact: true }).waitFor();
  assert.equal(await lineCount(), 4);
  await choose("Highlight raid", fixture.sessions[1]);
  assert.equal(await lineCount(), 4);
  for (const [key, value] of [["comparisonMetric", "HPS"], ["realm", "Lordaeron"], ["includeShortPulls", "1"]]) assert.equal(new URL(page.url()).searchParams.get(key), value);
  await metric("DPS");
  await visit(names[0], `realm=Lordaeron&includeShortPulls=1&comparisonFirst=${encodeURIComponent(fixture.sessions[0])}&comparisonSecond=${encodeURIComponent(fixture.sessions[1])}`);
  assert.equal(await lineCount(), 4, "Old two-raid URL parameters never restrict history");
  await metric("HPS");
  await choose("Difficulty", "10");
  assert.equal(await highlight.locator("option").count(), 1, "Combined 10-player scope cannot include any 25-player session");
  assert.equal(await section.locator(".recharts-line-dot").count(), 1);
  const tenRows = await allValues("HPS", 1);
  assert.equal(tenRows.length, 12);
  assert.equal(tenRows.filter(row => row.value !== null).length, 1);
  assert.equal(tenRows[0].difficulty, "10N");
  await choose("Difficulty", "10N");
  assert.equal(await highlight.locator("option").count(), 1);
  await section.getByRole("heading", { name: "HPS by successful boss fight", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("comparisonMetric"), "HPS");
  assert.equal((await allValues("HPS", 1))[0].value, "0.00");
  await choose("Raid", "ruby-sanctum");
  assert.equal(await section.getByLabel("Difficulty", { exact: true }).inputValue(), "25");
  await section.getByRole("heading", { name: "HPS by successful boss fight", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("comparisonMetric"), "HPS");
  assert.equal((await allValues("HPS", 1))[0].value, "0.00");
  await metric("DPS");
  const ruby = await allValues("DPS", 1);
  assert.equal(ruby.length, 1);
  assert.equal(ruby[0].boss, "Halion");
  assert.equal(ruby[0].value, "8.20K");
  observations.push("HPS URL/reload/highlight persistence, APS separation, old URL compatibility and exact raid/difficulty scopes pass");

  await visit(names[1]);
  assert.equal(await highlight.locator("option").count(), 1);
  assert.equal((await allValues("DPS", 1))[0].value, "15.00K");
  assert.equal((await page.goto(new URL(`/players/${names[2]}?realm=Lordaeron`, base).href, { waitUntil: "networkidle" })).status(), 200);
  assert.match(await section.innerText(), /No successful boss kills recorded/);
  assert.equal(await section.getByRole("combobox").count(), 0);
  await visit(names[0], "realm=Icecrown");
  assert.equal((await allValues("DPS", 1))[0].value, "99.00M");
  observations.push("Single-run, no-kill and same-name other-realm profiles pass");

  const require = createRequire(import.meta.url);
  const axe = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(names[0], "realm=Lordaeron");
    assert.equal(entry(await allValues(), dates[3], "Gunship Battle").value, "7.92K");
    await section.getByRole("button", { name: "Previous values page", exact: true }).click();
    await assertLayout(width);
    const plot = section.getByRole("region", { name: "DPS boss chart", exact: true });
    assert.equal(await plot.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count(), 12);
    const scrolls = await plot.evaluate(element => element.scrollWidth > element.clientWidth + 1);
    if (width < 1000) {
      assert.equal(scrolls, true, "Narrow plots provide contained horizontal scrolling rather than omit bosses");
      assert.equal(await plot.getAttribute("tabindex"), "0", "Scrollable chart is keyboard reachable");
      await choose("Highlight raid", fixture.sessions[0]);
      await plot.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector('[aria-label="DPS boss chart"]').scrollLeft > 0);
      await plot.hover({ position: { x: 100, y: 20 } });
      await page.mouse.wheel(2000, 0);
      await page.waitForFunction(() => {
        const element = document.querySelector('[aria-label="DPS boss chart"]');
        return element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      });
      const lastTick = plot.locator(".recharts-xAxis .recharts-cartesian-axis-tick").last();
      assert.match(await lastTick.textContent(), /Lich King/);
      const tickBounds = await lastTick.boundingBox(), plotBounds = await plot.boundingBox();
      assert.ok(tickBounds.x >= plotBounds.x && tickBounds.x + tickBounds.width <= plotBounds.x + plotBounds.width + 1, "Last boss label is reachable within the scroll viewport");
      await plot.locator(`.recharts-line-dot[data-run-key="${fixture.sessions[0]}"][data-boss-index="11"]`).hover();
      const scrolledTooltip = section.getByTestId("highlighted-raid-tooltip");
      await scrolledTooltip.waitFor({ state: "visible" });
      assert.match(await scrolledTooltip.innerText(), /The Lich King/);
      assert.match(await scrolledTooltip.innerText(), /10\.10K DPS/);
      assert.match(await scrolledTooltip.innerText(), /25N/);
      assert.equal(await scrolledTooltip.locator("time").count(), 1);
      const bounds = await scrolledTooltip.boundingBox();
      assert.ok(bounds.x >= plotBounds.x - 1 && bounds.x + bounds.width <= plotBounds.x + plotBounds.width + 1, "Tooltip remains visible after horizontal scrolling");
      await chart.screenshot({ path: path.join(out, `comparison-scrolled-chart-${width}.png`) });
      await page.mouse.move(0, 0);
      await plot.evaluate(element => element.scrollTo({ left: 0, behavior: "instant" }));
      await choose("Highlight raid", fixture.sessions[3]);
    } else {
      assert.equal(scrolls, false, "Desktop shows all twelve labels without scrolling");
      const plotBounds = await plot.boundingBox();
      assert.ok(await plot.locator(".recharts-xAxis .recharts-cartesian-axis-tick").evaluateAll((ticks, bounds) => ticks.every(tick => {
        const rect = tick.getBoundingClientRect();
        return rect.left >= bounds.x - 1 && rect.right <= bounds.x + bounds.width + 1;
      }), plotBounds), "Every desktop boss label fits the visible plot");
    }
    await page.addScriptTag({ content: axe });
    const audit = await page.evaluate(() => window.axe.run(document.querySelector("#raid-progress")));
    assert.deepEqual(audit.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })), [], `Scoped accessibility at ${width}px`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, `comparison-${width}.png`), fullPage: true });
    await section.screenshot({ path: path.join(out, `comparison-section-${width}.png`) });
  }
  observations.push("375/768px keyboard/horizontal scrolling reaches the last boss and its correctly positioned difficulty tooltip; desktop shows all 12 labels, with no page overflow and scoped accessibility/screenshots passing");

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    let response;
    await measure(`250 raids initial render at ${width}px`, 30000, async () => { response = await visit(names[3]); });
    assert.equal(await highlight.locator("option").count(), 250);
    assert.equal(await lineCount(), 250, "Dense histories have no silent chart cap");
    assert.equal(await section.getByRole("table").count(), 0);
    assert.equal(await section.locator('[data-isolated="true"]').count(), 3, "Lone and separated observations remain visible");
    const dots = await section.locator(".recharts-line-dot").count();
    assert.ok(dots >= 3 && dots < 100, "Ordinary dense dots are suppressed while isolated observations remain");
    const domNodes = await section.locator("*").count();
    assert.ok(domNodes < 8000, "Dense chart has bounded DOM without a 3000-row table");
    assert.equal(await section.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count(), 12);
    denseMeasurements.push({ width, raids: 250, recordedBosses: 3, canonicalBossSlots: 12, initialDomNodes: domNodes, initialDots: dots, decodedDocumentBytes: (await response.body()).length });
    await measure(`250 raids highlight at ${width}px`, 10000, () => choose("Highlight raid", fixture.denseSessions[125]));
    assert.equal(await lineCount(), 250);
    await measure(`250 raids HPS switch at ${width}px`, 10000, () => metric("HPS"));
    assert.equal(await lineCount(), 250, "All-zero HPS still plots all raids");
    await values("HPS");
    assert.equal(await section.locator("tbody tr").count(), 25);
    assert.match(await section.innerText(), /of 3,000/, "Dense values retain 250 raids × 12 canonical boss slots");
    assert.ok((await pageValues()).every(row => row.value === "0.00" || row.value === null));
    await section.getByRole("button", { name: "Next values page", exact: true }).click();
    assert.equal(await lineCount(), 250);
    assert.equal(await section.locator("tbody tr").count(), 25);
    await assertLayout(width);
    await measure(`250 raids resize from ${width}px`, 10000, async () => {
      await page.setViewportSize({ width: width === 375 ? 414 : 1280, height: 1000 });
      await twoFrames();
      assert.equal(await lineCount(), 250);
      await page.setViewportSize({ width, height: 1000 });
    });
    await metric("DPS");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, `comparison-dense-${width}.png`), fullPage: true });
    await section.screenshot({ path: path.join(out, `comparison-dense-section-${width}.png`) });
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  observations.push("250 raids × 3 bosses: all lines, retained isolated points, suppressed dense dots, all-zero HPS, lazy 25-row pagination, measured render/highlight/metric/resize at 375/1440px; no browser errors");
}

await fs.mkdir(out, { recursive: true });
try {
  await run();
} catch (error) {
  failure = { name: error.name, message: error.message, location: error.stack?.split("\n").filter(line => line.trim().startsWith("at ")).slice(0, 3) };
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
const result = { ...metadata, status: failure ? "fail" : "pass", observations, timings, denseMeasurements, ...(failure ? { failure } : {}) };
await fs.writeFile(path.join(out, "results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (failure) process.exitCode = 1;
