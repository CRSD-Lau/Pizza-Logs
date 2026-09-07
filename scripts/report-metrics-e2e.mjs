import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Client } from "pg";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";

// Author: Neil Mitchell
// Last Modified By: Neil Mitchell
// Illustrative records only. Never update existing players or clean up by prefix.
const metadata = { author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell" };
const out = path.resolve(process.env.PIZZA_METRICS_ARTIFACTS ?? ".test-artifacts/report-metrics");
const prefix = `metrics-e2e-${randomUUID()}`;
const owned = { participants: [], encounters: [], uploads: [], armory_gear_cache: [], players: [] };
const subjects = [
  { name: "Qzmetricdps", className: "Rogue", roles: ["DPS", "DPS"], specs: ["Combat", "Combat"], dps: [12000, 0], hps: [10, 0], aps: [0, 0], dtps: [300, 0] },
  { name: "Qzmetricheal", className: "Priest", roles: ["HEALER", "HEALER"], specs: ["Discipline", "Discipline"], dps: [200, 100], hps: [300, 400], aps: [4000, 5000], dtps: [500, 600] },
  { name: "Qzmetrictank", className: "Death Knight", roles: ["TANK", "TANK"], specs: ["Blood", "Blood"], dps: [3000, 4000], hps: [500, 600], aps: [0, 0], dtps: [8000, 9000] },
  { name: "Qzmetricmix", className: "Druid", roles: ["HEALER", "DPS"], specs: ["Restoration", "Feral"], dps: [100, 10000], hps: [6000, 20], aps: [0, 0], dtps: [300, 400] },
  { name: "Qzmetricunk", className: "Mage", roles: ["UNKNOWN", "UNKNOWN"], specs: [null, null], dps: [0, 0], hps: [0, 0], aps: [0, 0], dtps: [0, 0] },
];
const observations = [];
const errors = [];
let database;
let browser;
let page;
let connected = false;
let failure;

async function seed() {
  const names = subjects.map(subject => subject.name.toLowerCase());
  assert.equal((await database.query("SELECT id FROM players WHERE lower(name) = ANY($1::text[])", [names])).rowCount, 0,
    "Refuse existing named report-metrics fixtures; use their original owned-ID manifest to clean up");
  assert.equal((await database.query('SELECT id FROM armory_gear_cache WHERE "characterKey" = ANY($1::text[])', [names])).rowCount, 0,
    "Refuse existing armory fixtures");
  const realm = (await database.query("SELECT id,name FROM realms WHERE host = 'warmane' AND name = 'Lordaeron'")).rows[0];
  const bosses = (await database.query('SELECT id,name,slug FROM bosses WHERE "raidSlug" = \'icecrown-citadel\' ORDER BY "sortOrder",slug LIMIT 2')).rows;
  assert.ok(realm && bosses.length === 2, "Run db:seed against the selected local schema first");
  for (const subject of subjects) {
    subject.id = `${prefix}-player-${owned.players.length}`;
    await database.query('INSERT INTO players (id,name,class,"realmId") VALUES ($1,$2,$3,$4)', [subject.id, subject.name, subject.className, realm.id]);
    owned.players.push(subject.id);
    const cacheId = `${prefix}-cache-${owned.armory_gear_cache.length}`;
    const sourceUrl = `https://armory.warmane.com/character/${subject.name}/${realm.name}/summary`;
    const gear = { characterName: subject.name, realm: realm.name, className: subject.className, raceName: "Human", guildName: "Synthetic Test Guild",
      sourceUrl, fetchedAt: new Date().toISOString(), appearance: null,
      items: Array.from({ length: 18 }, (_, index) => ({ slot: `Slot ${index + 1}`, name: `Synthetic equipment ${index + 1}` })) };
    await database.query(`INSERT INTO armory_gear_cache (id,"characterName","characterKey",realm,"sourceUrl",gear,"fetchedAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,now(),now())`, [cacheId, subject.name, subject.name.toLowerCase(), realm.name, sourceUrl, gear]);
    owned.armory_gear_cache.push(cacheId);
  }
  const uploadId = `${prefix}-upload`;
  const publicSlug = `${prefix}-report`;
  await database.query(`INSERT INTO uploads (id,"publicSlug",filename,"fileHash","fileSize",status,"realmId","updatedAt")
    VALUES ($1,$2,'synthetic-report-metrics.log',$3,0,'DONE',$4,now())`, [uploadId, publicSlug, `${prefix}-hash`, realm.id]);
  owned.uploads.push(uploadId);
  for (let index = 0; index < 2; index++) {
    const encounterId = `${prefix}-encounter-${index}`;
    const start = new Date(`2026-09-06T18:0${index * 5}:00.000Z`);
    const totals = key => subjects.reduce((sum, subject) => sum + subject[key][index] * 120, 0);
    await database.query(`INSERT INTO encounters
      (id,"uploadId","bossId",fingerprint,outcome,difficulty,"groupSize","sessionIndex","durationSeconds","durationMs","startedAt","endedAt","totalDamage","totalHealing","totalAbsorbs","totalDamageTaken")
      VALUES ($1,$2,$3,$4,'KILL','25H',25,0,120,120000,$5,$6,$7,$8,$9,$10)`,
    [encounterId, uploadId, bosses[index].id, `${encounterId}-fingerprint`, start, new Date(start.getTime() + 120000), totals("dps"), totals("hps"), totals("aps"), totals("dtps")]);
    owned.encounters.push(encounterId);
    for (const subject of subjects) {
      const id = `${prefix}-participant-${owned.participants.length}`;
      await database.query(`INSERT INTO participants
        (id,"encounterId","playerId",role,spec,"totalDamage","totalHealing","totalAbsorbs","damageTaken",dps,hps,aps,deaths)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, encounterId, subject.id, subject.roles[index], subject.specs[index], subject.dps[index] * 120, subject.hps[index] * 120,
        subject.aps[index] * 120, subject.dtps[index] * 120, subject.dps[index], subject.hps[index], subject.aps[index], subject.roles[index] === "TANK" && index === 1 ? 1 : 0]);
      owned.participants.push(id);
    }
  }
  return { report: `/raids/${publicSlug}/sessions/2026-09-06`, bosses };
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
  assert.ok(/^[a-z0-9_]+$/.test(schema) && Buffer.byteLength(schema) <= 63, "Use a validated lowercase task schema");
  database = new Client({ host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), connectionTimeoutMillis: 5000 });
  await database.connect();
  connected = true;
  await database.query(`SET search_path TO "${schema}"`);
  assert.equal((await database.query("SELECT current_schema() AS name")).rows[0].name, schema, "The selected schema must already exist");
  assert.equal((await database.query("SELECT pg_try_advisory_lock(hashtext(current_schema()), hashtext('pizza-report-metrics-e2e')) AS locked")).rows[0].locked, true,
    "Another metrics acceptance run owns the schema");
  const fixture = await seed();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  const require = createRequire(import.meta.url);
  const axe = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");

  async function visit(route) {
    const response = await page.goto(new URL(route, base).href, { waitUntil: "load", timeout: 60000 });
    assert.equal(response.status(), 200, route);
    await waitForPageContent(page);
    await page.evaluate(() => document.fonts.ready);
  }
  async function assertLayout(label) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${label}: no page overflow`);
  }
  async function disclosure(scope, label) {
    const summary = scope.locator("summary").filter({ hasText: label });
    await summary.waitFor({ state: "visible" });
    if (!await summary.evaluate(element => element.parentElement.open)) await summary.click();
  }
  async function assertDefault(subject, isSession) {
    const summary = page.getByRole("region", { name: "Player performance summary", exact: true });
    await summary.waitFor();
    await summary.getByRole("link", { name: "Show all metrics", exact: true }).waitFor({ state: "visible" });
    const text = await summary.innerText();
    if (subject === subjects[0]) {
      assert.match(text, /Best DPS/i);
      assert.doesNotMatch(text, /Best (?:HPS|APS)|Healing \+ absorbs|Effective healing/i,
        "Small self-healing does not turn a damage role into a healer or crowd its summary");
    } else if (subject === subjects[1]) {
      assert.match(text, /Effective healing/i);
      assert.match(text, /Absorbs/i);
      assert.match(text, /Healing \+ absorbs/i);
      assert.match(text, /5\.00K/, "Absorb-heavy healer retains APS separately");
      assert.match(text, /5\.40K/, "Combined healing is effective healing plus absorbs");
    } else if (subject === subjects[2]) {
      assert.match(text, /Damage taken/i);
      assert.match(text, /DTPS/i);
      assert.match(text, /Deaths/i);
      assert.match(text, /DPS/i);
    } else {
      assert.match(text, /DPS/i);
      assert.match(text, /HPS/i);
      assert.match(text, /APS/i);
    }
    if (isSession) {
      const rows = page.locator('#encounters a[href^="/encounters/"]');
      assert.equal(await rows.count(), 2, "Both recorded fights remain in their original order");
      if (subject === subjects[0]) {
        assert.match(await rows.nth(1).innerText(), /0\.00\s*DPS/i, "Recorded zero-output DPS is displayed as zero");
        assert.doesNotMatch(await rows.nth(0).innerText(), /\bHPS\b|\bAPS\b/i, "Self-healing stays available through all metrics");
      }
      if (subject === subjects[3]) {
        const healerFight = await rows.nth(0).innerText();
        const damageFight = await rows.nth(1).innerText();
        assert.match(healerFight, /Restoration/i);
        assert.match(healerFight, /\bHPS\b/i);
        assert.doesNotMatch(healerFight, /\bDPS\b/i, "Mixed-role scope keeps the individual healing fight focused");
        assert.match(damageFight, /Feral/i);
        assert.match(damageFight, /\bDPS\b/i);
        assert.doesNotMatch(damageFight, /\bHPS\b|\bAPS\b/i, "Mixed-role scope keeps the individual damage fight focused");
      }
    }
    return summary;
  }

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const subject of subjects) {
      for (const isSession of [false, true]) {
        const route = isSession ? `${fixture.report}/players/${subject.name}?scope=kills&includeShortPulls=1` : `/players/${subject.name}?realm=Lordaeron&includeShortPulls=1`;
        await visit(route);
        const summary = await assertDefault(subject, isSession);
        await assertLayout(`${subject.name} ${isSession ? "session" : "profile"} ${width}`);
        if (subject === subjects[0] || subject === subjects[3]) {
          await page.getByRole("link", { name: "Show all metrics", exact: true }).click();
          await page.waitForURL(url => url.searchParams.get("metrics") === "all");
          await waitForPageContent(page);
          await summary.getByRole("link", { name: "Show relevant metrics", exact: true }).waitFor({ state: "visible" });
          assert.match(await summary.innerText(), /HPS/i);
          assert.match(await summary.innerText(), /APS/i);
          const chosen = page.url();
          await page.reload({ waitUntil: "load" });
          await waitForPageContent(page);
          await summary.getByRole("link", { name: "Show relevant metrics", exact: true }).waitFor({ state: "visible" });
          assert.equal(page.url(), chosen, "Explicit all metrics survives reload");
          assert.match(await summary.innerText(), /HPS/i);
          assert.equal(new URL(page.url()).searchParams.get("includeShortPulls"), "1");
          if (isSession) {
            assert.equal(new URL(page.url()).searchParams.get("scope"), "kills");
            const fights = page.locator('#encounters a[href^="/encounters/"]');
            if (subject === subjects[0]) assert.match(await fights.first().innerText(), /10\.00\s*HPS/i);
            else for (let index = 0; index < 2; index++) {
              const text = await fights.nth(index).innerText();
              assert.match(text, /\bDPS\b/i);
              assert.match(text, /\bHPS\b/i);
              assert.match(text, /\bAPS\b/i, "Explicit all metrics restores every rate on mixed-role fights");
            }
          }
          await page.getByRole("link", { name: "Show relevant metrics", exact: true }).click();
          await page.waitForURL(url => url.searchParams.get("metrics") !== "all");
          await waitForPageContent(page);
          await assertDefault(subject, isSession);
          await page.goBack({ waitUntil: "load" });
          await waitForPageContent(page);
          await summary.getByRole("link", { name: "Show relevant metrics", exact: true }).waitFor({ state: "visible" });
          assert.equal(new URL(page.url()).searchParams.get("metrics"), "all", "Back restores the explicit all-metric view");
          assert.match(await summary.innerText(), /APS/i);
          await page.goForward({ waitUntil: "load" });
          await waitForPageContent(page);
          await assertDefault(subject, isSession);
        }
        await summary.screenshot({ path: path.join(out, `${subject.name}-${isSession ? "session" : "profile"}-${width}.png`) });
      }
    }
    observations.push(`DPS/self-heal, absorb healer, tank, mixed spec and unknown player defaults, actual zero output, explicit all-metric reload and scope preservation at ${width}px`);

    await visit(fixture.report);
    const label = "All boss attempt player metrics";
    const group = page.getByRole("group", { name: `${label}: metric view`, exact: true });
    const view = page.getByRole(width < 1280 ? "list" : "table", { name: label, exact: true });
    const names = () => width < 1280 ? view.locator(":scope > li > div:first-child").allTextContents() : view.locator("tbody th[scope='row']").allTextContents();
    const headings = () => width < 1280 ? view.locator(":scope > li").first().locator("dt").allTextContents() : view.locator("thead th").allTextContents();
    assert.equal(await group.getByRole("button", { name: "Damage", exact: true }).getAttribute("aria-pressed"), "true");
    for (const mode of ["Damage", "Healing", "All"]) {
      await group.getByRole("button", { name: mode, exact: true }).click();
      await page.waitForURL(url => (url.searchParams.get("raidMetrics") ?? "damage") === mode.toLowerCase());
      await waitForPageContent(page);
      await page.locator(`[data-metric-view="${mode.toLowerCase()}"]`).first().waitFor();
      assert.deepEqual((await names()).sort(), subjects.map(subject => subject.name).sort(), `${mode} keeps all participants, including recorded zeros`);
      const columns = (await headings()).join(" ");
      if (mode === "Damage") assert.doesNotMatch(columns, /Healing|HPS|APS/i);
      if (mode === "Healing") assert.match(columns, /Healing/i);
      if (mode === "All") assert.match(columns, /Damage.*DPS.*Healing.*DTPS/i);
      await assertLayout(`${mode} raid ${width}`);
    }
    await page.reload({ waitUntil: "load" });
    await waitForPageContent(page);
    assert.equal(await group.getByRole("button", { name: "All", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("navigation", { name: "Boss fight scope", exact: true }).getByRole("link", { name: "Successful Boss Fights", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("scope") === "kills");
    await waitForPageContent(page);
    assert.equal(new URL(page.url()).searchParams.get("raidMetrics"), "all", "Metric selection survives a boss scope change");
    const selectedGroup = page.getByRole("group", { name: "Boss kill player metrics: metric view", exact: true });
    assert.equal(await selectedGroup.getByRole("button", { name: "All", exact: true }).getAttribute("aria-pressed"), "true");
    await page.locator("#boss-kill-breakdown").screenshot({ path: path.join(out, `raid-all-${width}.png`) });
    observations.push(`Raid Damage/Healing/All columns preserve all five players and persist through reload and scope navigation at ${width}px`);

    await visit(`${fixture.report}/players/${subjects[1].name}?scope=kills&includeShortPulls=1`);
    const sessionChart = page.locator("#performance");
    const sessionSelector = sessionChart.getByLabel("Chart metric", { exact: true });
    assert.equal(await sessionSelector.inputValue(), "Healing + absorbs /s", "Absorb-heavy healer session chart defaults to combined healing");
    for (const [code, value] of [["HPS", "400.00"], ["APS", "5.00K"], ["Healing + absorbs /s", "5.40K"], ["DTPS", "600.00"]]) {
      await sessionSelector.selectOption(code);
      await page.waitForURL(url => url.searchParams.get("chartMetric") === code);
      await waitForPageContent(page);
      await disclosure(sessionChart, `View ${code} chart values`);
      assert.match(await sessionChart.getByRole("table").innerText(), new RegExp(value.replace(".", "\\.")));
    }
    await page.reload({ waitUntil: "load" });
    await waitForPageContent(page);
    assert.equal(await sessionSelector.inputValue(), "DTPS");
    assert.equal(new URL(page.url()).searchParams.get("scope"), "kills");
    assert.equal(new URL(page.url()).searchParams.get("includeShortPulls"), "1");
    await assertLayout(`session chart ${width}`);
    observations.push(`Session chart exposes effective HPS, APS, combined healing and DTPS without changing the stored scope, with exact values and reload persistence at ${width}px`);

    await visit(`/players/${subjects[1].name}?realm=Lordaeron`);
    const comparison = page.locator("#raid-progress");
    const selector = comparison.getByLabel("Comparison metric", { exact: true });
    assert.equal(await selector.inputValue(), "HA", "Absorb-heavy healer comparison defaults to combined healing");
    for (const [code, label, value] of [["HPS", "HPS", "400.00"], ["APS", "APS", "5.00K"], ["HA", "Healing + absorbs /s", "5.40K"], ["DTPS", "DTPS", "600.00"]]) {
      await selector.selectOption(code);
      await page.waitForURL(url => url.searchParams.get("comparisonMetric") === code);
      await comparison.getByRole("heading", { name: `${label} by successful boss fight`, exact: true }).waitFor();
      await disclosure(comparison, `View ${label} chart values`);
      assert.match(await comparison.getByRole("table").innerText(), new RegExp(value.replace(".", "\\.")));
      await page.reload({ waitUntil: "load" });
      await waitForPageContent(page);
      assert.equal(await selector.inputValue(), code, "Explicit comparison metric survives reload");
    }
    await visit(`/players/${subjects[0].name}?realm=Lordaeron`);
    assert.equal(await selector.inputValue(), "DPS");
    await disclosure(comparison, "View DPS chart values");
    const zero = comparison.getByRole("row").filter({ hasText: fixture.bosses[1].name });
    assert.match(await zero.innerText(), /0\.00/, "Recorded zero is a value");
    assert.equal(await zero.locator('a[href^="/encounters/"]').count(), 1, "Recorded zero keeps its encounter link");
    const missing = comparison.getByRole("row").filter({ hasText: "Gunship Battle" });
    assert.equal(await missing.locator('a[href^="/encounters/"]').count(), 0, "Missing boss remains a gap without fabricated encounter link");
    await visit(`/players/${subjects[2].name}?realm=Lordaeron`);
    assert.equal(await selector.inputValue(), "DTPS");
    await page.addScriptTag({ content: axe });
    const audit = await page.evaluate(() => window.axe.run(document.querySelector("#raid-progress")));
    assert.deepEqual(audit.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })), [], `Comparison accessibility ${width}px`);
    await assertLayout(`comparison ${width}`);
    observations.push(`Comparison role defaults, HPS/APS/combined/DTPS values, explicit selection reload, zero versus missing fights and accessibility at ${width}px`);
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
}

await fs.mkdir(out, { recursive: true });
try {
  await run();
} catch (error) {
  failure = { name: error.name, message: error.message, location: error.stack?.split("\n").filter(line => line.trim().startsWith("at ")).slice(0, 3) };
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
} finally {
  try { if (browser) await browser.close(); } catch (error) { failure ??= { name: error.name, message: `Browser cleanup: ${error.message}` }; }
  if (connected) {
    try {
      for (const [table, ids] of Object.entries(owned)) {
        if (!ids.length) continue;
        const removed = await database.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [ids]);
        assert.equal(removed.rowCount, ids.length, `Clean up only owned ${table} fixtures`);
      }
      observations.push("Removed only this invocation's exact UUID-owned fixture rows");
    } catch (error) {
      failure ??= { name: error.name, message: `Fixture cleanup: ${error.message}` };
      await fs.writeFile(path.join(out, "cleanup-required.json"), JSON.stringify({ ...metadata, prefix, owned, note: "Verify and delete only these exact remaining owned IDs." }, null, 2));
    }
  }
  if (database) try { await database.end(); } catch (error) { failure ??= { name: error.name, message: `Database cleanup: ${error.message}` }; }
}
const result = { ...metadata, status: failure ? "fail" : "pass", observations, ...(failure ? { failure } : {}) };
await fs.writeFile(path.join(out, "results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (failure) process.exitCode = 1;
