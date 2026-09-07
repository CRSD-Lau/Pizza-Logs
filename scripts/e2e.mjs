import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { verifyPlayerQuickLooks } from "./player-quicklook-e2e.mjs";
import { waitForPageContent } from "./browser-page-ready.mjs";
import { localTestBase, syntheticCombatLog, uploadSyntheticLog } from "./e2e-upload.mjs";

const require = createRequire(import.meta.url);
const base = localTestBase(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
const out = path.resolve(process.env.PIZZA_TEST_ARTIFACTS ?? ".test-artifacts/e2e");
await fs.mkdir(out, { recursive: true });
const observations = [];
async function toggleShortPulls(page, label) {
  const link = page.getByRole("link", { name: label, exact: true, includeHidden: true });
  const notice = page.locator("details").filter({ has: link });
  if (await notice.getAttribute("open") === null) await notice.locator("summary").click();
  await page.getByRole("link", { name: label, exact: true }).click();
}
function authenticatorCode(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()].map(character => {
    const value = alphabet.indexOf(character);
    assert.ok(value >= 0, "setup key must be base32");
    return value.toString(2).padStart(5, "0");
  }).join("");
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return String((hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
let stackReady = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    stackReady = (await fetch(new URL("/api/health/ready", base), { signal: AbortSignal.timeout(2000) })).ok;
  } catch { /* container startup may still be applying migrations */ }
  if (stackReady) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.equal(stackReady, true, "Isolated stack must become ready before upload tests");
const upload = (bytes, filename) => uploadSyntheticLog(base, bytes, filename);
const input = syntheticCombatLog();
const first = await upload(input);
const duplicates = await Promise.all([upload(input), upload(input)]);
assert.ok(duplicates.every(result => result.status === "DUPLICATE" && result.uploadId === first.uploadId));
observations.push({ check: "upload and concurrent duplicate", status: "pass" });
const archived = spawnSync(process.env.PARSER_CONTRACT_PYTHON ?? "python", ["-c",
  "import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED); z.writestr('synthetic.txt',sys.stdin.buffer.read()); z.close(); sys.stdout.buffer.write(b.getvalue())",
], { input, maxBuffer: 1024 * 1024 });
assert.equal(archived.status, 0, "Python must generate the synthetic archive");
await upload(archived.stdout, "synthetic.zip");
observations.push({ check: "ZIP upload through web, parser and persistence", status: "pass" });
for (const endpoint of ["/api/encounters?take=-1", "/api/encounters?skip=NaN", "/api/leaderboard?metric=invalid"]) {
  assert.equal((await fetch(new URL(endpoint, base))).status, 400);
}
assert.equal((await fetch(new URL("/api/guild-roster/sync", base), { method: "POST", body: "null", headers: { "content-type": "application/json" } })).status, 401);
assert.equal((await fetch(new URL("/admin", base), { redirect: "manual" })).status, 307);
assert.equal((await fetch(new URL("/api/health/ready", base))).status, 200);
const report = `/raids/${first.publicReportSlug}/sessions/${first.firstSessionSlug}`;
// Three synthetic attempts retain the short-pull policy coverage while making
// kill, wipe and between-fight metrics distinguishable. No private log is used.
const policyLines = [];
const policyDay = new Date();
const policyDate = `${policyDay.getUTCMonth() + 1}/${policyDay.getUTCDate()}`;
const unit = (id, name) => `0x06000000000000${id},"${name}",0x514`;
const policyBoss = '0xF130008F98000001,"Lord Marrowgar",0xa48';
const killAdd = '0xF13000F001000001,"Synthetic Kill Add",0xa48';
const wipeAdd = '0xF13000F002000001,"Synthetic Wipe Add",0xa48';
const trashMob = '0xF13000F003000001,"Synthetic Between-Fight Trash",0xa48';
const killPlayers = [
  { id: "B1", name: "SyntheticFirst", damage: 900, grossHeal: 140, overheal: 40, heal: 100, taken: 150 },
  { id: "B2", name: "SyntheticSecond", damage: 400, grossHeal: 650, overheal: 150, heal: 500, taken: 50 },
  { id: "B3", name: "SyntheticThird", damage: 200, grossHeal: 400, overheal: 100, heal: 300, taken: 250 },
];
for (let pull = 0; pull < 3; pull += 1) {
  const timestamp = seconds => `${policyDate} 16:${String(pull * 2).padStart(2, "0")}:${seconds.toFixed(3).padStart(6, "0")}`;
  policyLines.push(`${timestamp(0)}  ENCOUNTER_START,1084,"Lord Marrowgar",4,25`);
  for (let hit = 1; hit <= 12; hit += 1) {
    const player = pull === 2 ? killPlayers[hit <= 6 ? 0 : hit <= 10 ? 1 : 2] : killPlayers[pull === 1 && hit > 4 ? 1 : 0];
    const source = unit(player.id, player.name);
    policyLines.push(`${timestamp(hit * (pull === 0 ? 0.5 : 2))}  SPELL_DAMAGE,${source},${policyBoss},48638,"Sinister Strike",0x1,100,0,1,0,0,0,nil,nil,nil`);
    if (pull === 1 && hit === 4) {
      policyLines.push(`${timestamp(8.1)}  UNIT_DIED,0x0000000000000000,nil,0x80000000,${unit("B1", "SyntheticFirst")},0`);
    }
    if (pull === 2 && [3, 6, 9].includes(hit)) {
      const healed = killPlayers[hit / 3 - 1];
      const target = unit(healed.id, healed.name);
      policyLines.push(`${timestamp(hit * 2 + 0.1)}  SPELL_HEAL,${target},${target},900001,"Synthetic Restore",0x2,${healed.grossHeal},${healed.overheal},0,nil`);
      policyLines.push(`${timestamp(hit * 2 + 0.2)}  SPELL_DAMAGE,${policyBoss},${target},900002,"Synthetic Strike",0x1,${healed.taken},0,1,0,0,0,nil,nil,nil`);
    }
    if (pull > 0 && hit === 10) {
      const addSource = pull === 2 ? unit("B1", "SyntheticFirst") : unit("B2", "SyntheticSecond");
      policyLines.push(`${timestamp(20.1)}  SPELL_DAMAGE,${addSource},${pull === 2 ? killAdd : wipeAdd},48638,"Sinister Strike",0x1,${pull === 2 ? 300 : 200},0,1,0,0,0,nil,nil,nil`);
      if (pull === 1) {
        policyLines.push(`${timestamp(20.2)}  SPELL_HEAL,${addSource},${addSource},900001,"Synthetic Restore",0x2,1200,200,0,nil`);
        policyLines.push(`${timestamp(20.3)}  SPELL_DAMAGE,${policyBoss},${addSource},900002,"Synthetic Strike",0x1,1000,0,1,0,0,0,nil,nil,nil`);
      }
    }
  }
  if (pull === 2) policyLines.push(`${timestamp(30)}  UNIT_DIED,0x0000000000000000,nil,0x80000000,${policyBoss},0`);
  policyLines.push(`${timestamp(31)}  ENCOUNTER_END,1084,"Lord Marrowgar",4,25,${pull === 2 ? 1 : 0}`);
}
policyLines.push(`${policyDate} 16:05:00.000  SPELL_DAMAGE,${unit("B4", "SyntheticTrashOnly")},${trashMob},48638,"Sinister Strike",0x1,700,0,1,0,0,0,nil,nil,nil`);
const policyUpload = await upload(Buffer.from(`${policyLines.join("\n")}\n`), "synthetic-short-pulls.txt");
const policyReport = `/raids/${policyUpload.publicReportSlug}/sessions/${policyUpload.firstSessionSlug}`;
const encounters = await (await fetch(new URL("/api/encounters", base))).json();
const encounter = encounters.find(value => value.uploadId === first.uploadId);
assert.ok(encounter);
assert.equal(encounter.totalDamage, 54000, "Rendered report input uses the frozen synthetic damage primitive");
assert.equal(encounter.durationMs, 26000);
const policyEncounters = encounters.filter(value => value.uploadId === policyUpload.uploadId);
assert.equal(policyEncounters.length, 3, "Raw encounter inventory preserves all three attempts");
assert.equal(policyEncounters.filter(value => value.outcome === "WIPE").length, 2);
assert.equal(policyEncounters.filter(value => value.outcome === "KILL").length, 1);
assert.equal(policyEncounters.reduce((sum, value) => sum + value.totalDamage, 0), 4100);
const policyKill = policyEncounters.find(value => value.outcome === "KILL");
const policyAllDurationMs = policyEncounters.reduce((sum, value) => {
  assert.ok(Number.isFinite(value.durationMs) && value.durationMs > 0, "All synthetic attempts must have measured durations");
  return sum + value.durationMs;
}, 0);
assert.equal(policyKill.totalDamage, 1500, "Winning-fight damage includes its add, without wipes or between-fight trash");
assert.equal(policyKill.totalHealing, 900, "Winning-fight healing excludes overheal");
assert.equal(policyKill.totalDamageTaken, 450);
assert.ok(policyKill.durationMs > 0);
const routes = ["/", "/raids", "/bosses", "/leaderboards", "/players", "/weekly", "/guild-roster", "/admin/login", report, `/encounters/${encounter.id}`, "/players/Phyre"];
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  observations.push(...await verifyPlayerQuickLooks({ browser, base, out, report, encounterId: encounter.id }));
  const context = await browser.newContext({ reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  await context.addInitScript(() => sessionStorage.setItem("pizza-logs-intro-seen", "true"));
  // Fix browser assets; server-side Warmane fallback is separately bounded.
  // Use an egress-isolated container network for completely offline rendering.
  await context.route("**/*", route => new URL(route.request().url()).origin === base.origin
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const axe = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      const started = performance.now();
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForPageContent(page);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(response.status(), 200, route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) failures.push({ route, width, issue: "horizontal overflow" });
      if (width === 390 || width === 1440) {
        await page.evaluate(axe);
        const accessibility = await page.evaluate(async () => {
          const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
          return result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) }));
        });
        failures.push(...accessibility.map(item => ({ route, width, ...item })));
      }
      const screenshot = `${width}-${route.replaceAll("/", "_")}.png`;
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true, animations: "disabled" });
      observations.push({ route, width, status: response.status(), elapsedMs: Math.round(performance.now() - started), screenshot });
    }
  }
  await page.goto(new URL(report, base).href);
  await waitForPageContent(page);
  assert.match(await page.locator("main").innerText(), /54\.00K/, "UI must display the same damage primitive in compact two-decimal form");
  const metricColumns = [
    ["name", "Player"], ["totalDamage", "Total Damage"], ["dps", "DPS"],
    ["heal", "Healing + absorbs"], ["healPerSecond", "Healing + absorbs /s"], ["damageTaken", "Damage Taken"], ["dtps", "DTPS"],
  ];
  const playerView = (label, width) => page.getByRole(width < 1280 ? "list" : "table", { name: label, exact: true });
  const playerNames = (view, width) => width < 1280
    ? view.locator(":scope > li > div:first-child").allTextContents()
    : view.locator("tbody th[scope='row']").allTextContents();
  const cardValue = (scope, label) => scope.getByText(label, { exact: true }).locator("..").locator(":scope > div").nth(1).innerText();
  const fixtureDuration = milliseconds => {
    assert.ok(milliseconds >= 0 && milliseconds < 3_600_000, "Synthetic combined fight time stays below one hour");
    return `${Math.floor(milliseconds / 60_000)}:${new Date(milliseconds).toISOString().slice(17, 19)}`;
  };
  const assertKillCards = async () => {
    const scope = page.getByRole("region", { name: "Boss kill summary", exact: true });
    assert.match(await scope.innerText(), /Fight results\s+1 kill\s+· 1 successful fight/);
    assert.equal(await cardValue(scope, "Total Damage"), "1.50K");
    assert.equal(await cardValue(scope, "Healing + absorbs"), "900.00");
    assert.equal(await cardValue(scope, "Damage Taken"), "450.00");
    assert.equal(await cardValue(scope, "Kill Time"), fixtureDuration(policyKill.durationMs));
  };
  const assertAllCards = async () => {
    const scope = page.getByRole("region", { name: "All boss attempt summary", exact: true });
    assert.match(await scope.innerText(), /Recorded results\s+1 kill \/ 2 wipes\s+· 3 recorded attempts/);
    assert.match(await scope.innerText(), /3 recorded attempts/);
    assert.equal(await cardValue(scope, "Total Damage"), "4.10K");
    assert.equal(await cardValue(scope, "Healing + absorbs"), "1.90K");
    assert.equal(await cardValue(scope, "Damage Taken"), "1.45K");
    assert.equal(await cardValue(scope, "Fight Time"), fixtureDuration(policyAllDurationMs));
  };
  const assertScopeSelection = async selected => {
    const navigation = page.getByRole("navigation", { name: "Boss fight scope", exact: true });
    for (const label of ["All Boss Attempts", "Successful Boss Fights"]) {
      assert.equal(await navigation.getByRole("link", { name: label, exact: true }).getAttribute("aria-current"), label === selected ? "page" : null);
    }
  };
  const auditOpenMetrics = async (width, route, openedToggle) => {
    // Contrast must be measured after the accordion's opening opacity transition.
    await page.waitForFunction(id => {
      const panel = document.getElementById(id);
      return panel && !panel.inert && getComputedStyle(panel).opacity === "1";
    }, await openedToggle.getAttribute("aria-controls"));
    await page.evaluate(axe);
    const violations = await page.evaluate(async () => (await window.axe.run(document,
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(item => ({
        id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
      })));
    failures.push(...violations.map(item => ({ route, width, ...item })));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  };
  const assertPlayerValues = async (view, width, expected) => {
    for (const [index, values] of expected.entries()) {
      const row = width < 1280 ? view.locator(":scope > li").nth(index) : view.locator("tbody tr").nth(index);
      assert.deepEqual(await row.locator(width < 1280 ? "dd" : "td").allTextContents(), values);
    }
  };
  const assertSorting = async (label, width, ascending) => {
    const view = playerView(label, width);
    const controls = view.locator("..").locator("..");
    for (const [key, column] of metricColumns) {
      for (const direction of ["ascending", "descending"]) {
        const status = `${label}: sorted by ${column}, ${direction}.`;
        if (width < 1280) {
          await controls.getByRole("combobox", { name: `${label}: sort by`, exact: true }).selectOption(key);
          if ((await controls.getByRole("status").innerText()) !== status) {
            await controls.getByRole("button", { name: `Sort ${direction} by ${column}`, exact: true }).click();
          }
        } else {
          const sortButton = page.getByRole("button", { name: `Sort ${column} ascending`, exact: true })
            .or(page.getByRole("button", { name: `Sort ${column} descending`, exact: true }));
          const heading = view.getByRole("columnheader").filter({ has: sortButton });
          if ((await heading.getAttribute("aria-sort")) !== direction) await heading.getByRole("button").click();
          if ((await heading.getAttribute("aria-sort")) !== direction) await heading.getByRole("button").click();
          assert.equal(await heading.getAttribute("aria-sort"), direction);
        }
        await controls.getByText(status, { exact: true }).waitFor();
        const expected = direction === "ascending" ? ascending[key] : [...ascending[key]].reverse();
        assert.deepEqual(await playerNames(view, width), expected, `${label}: ${column} ${direction} at ${width}px`);
      }
    }
  };
  const killAscending = {
    name: ["SyntheticFirst", "SyntheticSecond", "SyntheticThird"],
    totalDamage: ["SyntheticThird", "SyntheticSecond", "SyntheticFirst"],
    dps: ["SyntheticThird", "SyntheticSecond", "SyntheticFirst"],
    heal: ["SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    healPerSecond: ["SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    damageTaken: ["SyntheticSecond", "SyntheticFirst", "SyntheticThird"],
    dtps: ["SyntheticSecond", "SyntheticFirst", "SyntheticThird"],
  };
  const allAscending = {
    ...killAscending,
    damageTaken: ["SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    dtps: ["SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
  };
  const fullAscending = {
    name: ["SyntheticFirst", "SyntheticSecond", "SyntheticThird", "SyntheticTrashOnly"],
    totalDamage: ["SyntheticThird", "SyntheticTrashOnly", "SyntheticSecond", "SyntheticFirst"],
    dps: ["SyntheticThird", "SyntheticTrashOnly", "SyntheticSecond", "SyntheticFirst"],
    heal: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    healPerSecond: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    damageTaken: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    dtps: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
  };
  // Keep the fixture display oracle independent of production formatters.
  const fixtureDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fixtureAmount = amount => amount >= 1000 ? `${fixtureDecimal.format(amount / 1000)}K` : fixtureDecimal.format(amount);
  const rate = (amount, durationMs = policyKill.durationMs) => {
    const value = amount / (durationMs / 1000);
    assert.ok(value >= 0.01 && value < 1000, "Synthetic rates must stay in the unsuffixed range");
    return fixtureDecimal.format(value);
  };
  const allPlayers = [
    { name: "SyntheticFirst", damage: 2500, heal: 100, taken: 150 },
    { name: "SyntheticSecond", damage: 1400, heal: 1500, taken: 1050 },
    { name: "SyntheticThird", damage: 200, heal: 300, taken: 250 },
  ];
  const assertAllPlayerValues = async width => {
    const view = playerView("All boss attempt player metrics", width);
    const names = await playerNames(view, width);
    assert.deepEqual([...names].sort(), allPlayers.map(player => player.name));
    await assertPlayerValues(view, width, names.map(name => {
      const player = allPlayers.find(value => value.name === name);
      return [fixtureAmount(player.damage), rate(player.damage, policyAllDurationMs), fixtureAmount(player.heal), rate(player.heal, policyAllDurationMs),
        fixtureAmount(player.taken), rate(player.taken, policyAllDurationMs)];
    }));
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    // Sorting/value coverage deliberately opts into all seven metric columns.
    await page.goto(new URL(`${policyReport}?raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertScopeSelection("All Boss Attempts");
    await assertAllCards();
    const allView = playerView("All boss attempt player metrics", width);
    assert.deepEqual(await playerNames(allView, width), allPlayers.map(player => player.name));
    await assertAllPlayerValues(width);
    assert.equal(await allView.getByRole("link", { name: /SyntheticTrashOnly/ }).count(), 0, "Boss-attempt totals exclude the between-fight-only player");
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 2, "Short pull is initially hidden from the list, while all metrics retain its 1,200 damage");
    await assertSorting("All boss attempt player metrics", width, allAscending);
    const allMobToggle = page.getByRole("button", { name: /^Mob Damage - All Boss Attempts/ });
    if (await allMobToggle.getAttribute("aria-expanded") === "false") await allMobToggle.click();
    const allMobContent = page.locator(`[id="${await allMobToggle.getAttribute("aria-controls")}"]`);
    for (const [target, damage] of [["Lord Marrowgar", "3.60K"], ["Synthetic Kill Add", "300.00"], ["Synthetic Wipe Add", "200.00"]]) {
      const targetRow = allMobContent.getByRole("button", { name: new RegExp(target) });
      assert.match(await targetRow.innerText(), new RegExp(damage.replace(".", "\\.")));
    }
    assert.doesNotMatch(await allMobContent.innerText(), /Synthetic Between-Fight Trash/);
    await auditOpenMetrics(width, policyReport, allMobToggle);
    await page.screenshot({ path: path.join(out, `${width}-all-boss-attempts.png`), fullPage: true });
    await toggleShortPulls(page, "Include short pulls");
    await page.waitForURL(new URL(`${policyReport}?includeShortPulls=1&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertAllCards();
    await assertAllPlayerValues(width);
    await assertScopeSelection("All Boss Attempts");
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 3);
    await toggleShortPulls(page, "Exclude short pulls");
    await page.waitForURL(new URL(`${policyReport}?raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertAllCards();
    await assertAllPlayerValues(width);
    // Both scope links must support native keyboard navigation on mobile and desktop.
    const scopeNavigation = page.getByRole("navigation", { name: "Boss fight scope", exact: true });
    await scopeNavigation.getByRole("link", { name: "All Boss Attempts", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await scopeNavigation.getByRole("link", { name: "Successful Boss Fights", exact: true }).evaluate(element => document.activeElement === element), true);
    await page.keyboard.press("Enter");
    await page.waitForURL(new URL(`${policyReport}?scope=kills&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertScopeSelection("Successful Boss Fights");
    const defaultText = await page.locator("main").innerText();
    assert.match(defaultText, /1 short pull excluded/);
    await assertKillCards();
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 2);
    const killView = playerView("Boss kill player metrics", width);
    assert.deepEqual(await playerNames(killView, width), killPlayers.map(player => player.name));
    await assertPlayerValues(killView, width, killPlayers.map(player => [
      fixtureDecimal.format(player.damage), rate(player.damage), fixtureDecimal.format(player.heal), rate(player.heal), fixtureDecimal.format(player.taken), rate(player.taken),
    ]));
    assert.equal(await killView.getByRole("link", { name: "View SyntheticFirst's all-attempt raid report", exact: true }).getAttribute("href"), `${policyReport}/players/SyntheticFirst?scope=kills&raidMetrics=all`);
    await assertSorting("Boss kill player metrics", width, killAscending);
    const fullToggle = page.getByRole("button", { name: /^Full Session Breakdown/ });
    const fullContent = page.locator(`[id="${await fullToggle.getAttribute("aria-controls")}"]`);
    // Query-only scope changes may preserve accordion state; explicitly prepare
    // the collapsed panel before checking that its controls cannot receive focus.
    if (await fullToggle.getAttribute("aria-expanded") === "true") await fullToggle.click();
    assert.equal(await fullToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await fullContent.getAttribute("aria-hidden"), "true");
    assert.equal(await fullContent.evaluate(element => element.inert), true);
    const hiddenControl = fullContent.locator(width < 1280 ? "select" : "table button").first();
    await hiddenControl.evaluate(element => element.focus());
    assert.equal(await hiddenControl.evaluate(element => document.activeElement === element), false, "Collapsed metrics cannot receive keyboard focus");
    if (await fullToggle.getAttribute("aria-expanded") === "false") await fullToggle.click();
    assert.equal(await fullContent.getAttribute("aria-hidden"), "false");
    assert.equal(await fullContent.evaluate(element => element.inert), false);
    const fullView = playerView("Full session player metrics", width);
    await fullView.waitFor();
    const fullTotals = fullContent.locator('[aria-label="Full session totals"]');
    assert.equal(await cardValue(fullTotals, "Total Damage"), "4.80K");
    assert.equal(await cardValue(fullTotals, "Healing + absorbs"), "1.90K");
    assert.equal(await cardValue(fullTotals, "Damage Taken"), "1.45K");
    assert.deepEqual(await playerNames(fullView, width), ["SyntheticFirst", "SyntheticSecond", "SyntheticTrashOnly", "SyntheticThird"]);
    assert.equal(await fullView.getByRole("link", { name: /SyntheticTrashOnly/ }).count(), 0, "A trash-only player has no boss-attempt link");
    await assertSorting("Full session player metrics", width, fullAscending);
    assert.deepEqual(await playerNames(killView, width), ["SyntheticThird", "SyntheticFirst", "SyntheticSecond"], "The two breakdowns keep independent sorting");
    await fullToggle.click();
    assert.equal(await fullContent.evaluate(element => element.inert), true);
    const mobToggle = page.getByRole("button", { name: /^Mob Damage - Boss Kills/ });
    if (await mobToggle.getAttribute("aria-expanded") === "false") await mobToggle.click();
    const mobContent = page.locator(`[id="${await mobToggle.getAttribute("aria-controls")}"]`);
    assert.match(await mobContent.innerText(), /Lord Marrowgar/);
    assert.match(await mobContent.innerText(), /Synthetic Kill Add/);
    assert.doesNotMatch(await mobContent.innerText(), /Synthetic Wipe Add|Synthetic Between-Fight Trash/);
    await auditOpenMetrics(width, `${policyReport}?scope=kills`, mobToggle);
    await page.screenshot({ path: path.join(out, `${width}-short-pulls-default.png`), fullPage: true });
    await toggleShortPulls(page, "Include short pulls");
    await page.waitForURL(new URL(`${policyReport}?scope=kills&includeShortPulls=1&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    const includedText = await page.locator("main").innerText();
    assert.match(includedText, /1 short pull included/);
    await assertKillCards();
    const includedKillView = playerView("Boss kill player metrics", width);
    assert.deepEqual((await playerNames(includedKillView, width)).sort(), killPlayers.map(player => player.name).sort(), "Including short pulls cannot add wipe-only players to kill metrics");
    const scopedPlayerPath = `${policyReport}/players/SyntheticFirst?scope=kills&includeShortPulls=1&raidMetrics=all`;
    assert.equal(await includedKillView.getByRole("link", { name: "View SyntheticFirst's all-attempt raid report", exact: true }).getAttribute("href"), scopedPlayerPath);
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 3);
    await page.screenshot({ path: path.join(out, `${width}-short-pulls-included.png`), fullPage: true });
    await includedKillView.getByRole("link", { name: "View SyntheticFirst's all-attempt raid report", exact: true }).click();
    await page.waitForURL(new URL(scopedPlayerPath, base).href);
    await waitForPageContent(page);
    await page.locator(`a[href="${policyReport}?scope=kills&includeShortPulls=1&raidMetrics=all"]`).first().click();
    await page.waitForURL(new URL(`${policyReport}?scope=kills&includeShortPulls=1&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertKillCards();
    const scopedEncounterPath = `/encounters/${policyKill.id}?scope=kills&includeShortPulls=1&raidMetrics=all`;
    await page.locator(`a[href="${scopedEncounterPath}"]`).click();
    await page.waitForURL(new URL(scopedEncounterPath, base).href);
    await waitForPageContent(page);
    await page.locator(`a[href="${policyReport}?scope=kills&includeShortPulls=1&raidMetrics=all"]`).first().click();
    await page.waitForURL(new URL(`${policyReport}?scope=kills&includeShortPulls=1&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertKillCards();
    await page.getByRole("navigation", { name: "Boss fight scope", exact: true }).getByRole("link", { name: "All Boss Attempts", exact: true }).click();
    await page.waitForURL(new URL(`${policyReport}?includeShortPulls=1&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertAllCards();
    await assertAllPlayerValues(width);
    await page.getByRole("navigation", { name: "Boss fight scope", exact: true }).getByRole("link", { name: "Successful Boss Fights", exact: true }).click();
    await page.waitForURL(new URL(`${policyReport}?scope=kills&includeShortPulls=1&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await toggleShortPulls(page, "Exclude short pulls");
    await page.waitForURL(new URL(`${policyReport}?scope=kills&raidMetrics=all`, base).href);
    await waitForPageContent(page);
    await assertKillCards();
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 2);
  }
  const legacyPolicyReport = `/uploads/${policyUpload.uploadId}/sessions/${policyKill.sessionIndex}`;
  for (const suffix of ["", "?scope=kills", "?includeShortPulls=1", "?scope=kills&includeShortPulls=1"]) {
    await page.goto(new URL(`${legacyPolicyReport}${suffix}`, base).href);
    await page.waitForURL(new URL(`${policyReport}${suffix}`, base).href);
    await waitForPageContent(page);
    if (suffix.includes("scope=kills")) await assertKillCards();
    else await assertAllCards();
    await page.goto(new URL(`${legacyPolicyReport}/players/SyntheticFirst${suffix}`, base).href);
    await page.waitForURL(new URL(`${policyReport}/players/SyntheticFirst${suffix}`, base).href);
    await waitForPageContent(page);
    assert.equal(await page.locator(`a[href="${policyReport}${suffix}"]`).count(), 1, "Legacy player redirects retain report scope and short-pull preferences in the return link");
  }
  const briefAttempt = policyEncounters.find(value => value.outcome === "WIPE" && value.durationMs < 10000);
  assert.ok(briefAttempt);
  assert.equal((await page.goto(new URL(`/encounters/${briefAttempt.id}`, base).href)).status(), 200);
  await waitForPageContent(page);
  for (const route of ["/", "/raids", "/bosses", "/bosses/lord-marrowgar", "/weekly", "/players?class=Rogue", "/players/SyntheticFirst", `${policyReport}/players/SyntheticFirst`, `/encounters/${briefAttempt.id}`]) {
    const original = new URL(route, base);
    for (const included of [false, true]) {
      if (included) original.searchParams.set("includeShortPulls", "1");
      else original.searchParams.delete("includeShortPulls");
      await page.goto(original.href);
      await waitForPageContent(page);
      assert.equal(await page.getByRole("link", { name: /^(Include|Exclude) short pulls$/, includeHidden: true }).count(), 0, `Short-pull controls belong only on the raid session page: ${original.pathname}`);
      assert.doesNotMatch(await page.locator("main").innerText(), /\d+ short pulls? (included|excluded)/, `Short-pull disclaimers belong only on the raid session page: ${original.pathname}`);
    }
  }
  observations.push({ check: "all-attempt and kill-only totals, duration denominators, player contributions and targets; retained full-session trash/wipes; sorting, keyboard scope selection, axe and overflow at 390/1440px", status: "pass" });
  observations.push({ check: "short-pull list toggles preserve both aggregate scopes; scope selection preserves short-pull preferences; player/encounter return links and legacy redirects retain scope", status: "pass" });
  observations.push({ check: "short-pull controls and exclusion disclaimers appear only on individual raid session pages, with either query preference", status: "pass" });
  await page.goto(new URL(report, base).href);
  await waitForPageContent(page);
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY");
  await page.goto(base.href);
  await waitForPageContent(page);
  await page.getByRole("textbox", { name: "Character (required)", exact: true }).fill("Synthetic Auditor");
  await page.getByRole("checkbox", { name: /I have permission to share this log/ }).check();
  await context.route("**/api/upload?**", async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose File", exact: true }).click();
  await (await chooser).setFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: input });
  await page.getByRole("progressbar", { name: "Combat log upload" }).waitFor();
  await page.screenshot({ path: path.join(out, "1920-upload-progress.png"), fullPage: true });
  await page.getByText("Report Already Exists", { exact: true }).waitFor();
  await page.getByRole("link", { name: "View raid report", exact: true }).click();
  await page.waitForURL(new URL(report, base).href);
  await waitForPageContent(page);
  assert.match(await page.locator("main").innerText(), /54\.00K/);
  observations.push({ check: "native file chooser, announced progress and duplicate report navigation", status: "pass" });
  await page.goto(base.href);
  await waitForPageContent(page);
  await page.getByRole("textbox", { name: "Character (required)", exact: true }).fill("Synthetic Auditor");
  await page.getByRole("checkbox", { name: /I have permission to share this log/ }).check();
  const invalidChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose File", exact: true }).click();
  await (await invalidChooser).setFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("This is deliberately not a combat log.") });
  const uploadError = page.getByRole("alert").filter({ hasText: "Upload Failed" });
  await uploadError.waitFor();
  assert.doesNotMatch(await uploadError.innerText(), /Traceback|postgresql:|node_modules/);
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await page.getByRole("button", { name: "Choose File", exact: true }).waitFor();
  observations.push({ check: "invalid log error announcement and retry", status: "pass" });
  const fixture = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/admin-e2e-fixture.ts"], {
    encoding: "utf8", env: process.env, timeout: 30_000,
  });
  assert.equal(fixture.status, 0, "Provision the synthetic admin only in the dedicated loopback database");
  const credentials = JSON.parse(fixture.stdout);
  const loginPassword = async () => {
    await page.goto(new URL("/admin/login", base).href);
    await waitForPageContent(page);
    await page.getByLabel("Email address", { exact: true }).fill(credentials.email);
    await page.getByLabel("Password", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  };
  const cookieHeader = async () => (await context.cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
  const assertPrivateDenied = async cookies => {
    for (const route of ["/admin", "/admin/uploads", `/admin/uploads/${first.uploadId}`]) {
      const response = await fetch(new URL(route, base), { redirect: "manual", headers: { cookie: cookies } });
      assert.equal(response.status, 307, "A session without full MFA must be redirected before private data is loaded");
      assert.doesNotMatch(await response.text(), /synthetic\.txt/);
    }
  };
  await assertPrivateDenied("pizza-logs-auth.session_token=forged");
  assert.equal((await fetch(new URL("/admin", base), { redirect: "manual", headers: { "x-admin-secret": process.env.ADMIN_SECRET } })).status, 307);
  assert.equal((await fetch(new URL("/api/guild-roster/sync", base), {
    method: "POST", headers: { origin: base.origin, "content-type": "application/json" }, body: JSON.stringify({ secret: process.env.ADMIN_SECRET }),
  })).status, 401);
  assert.equal((await fetch(new URL("/api/auth/sign-up/email", base), {
    method: "POST", headers: { origin: base.origin, "content-type": "application/json" }, body: "{}",
  })).status, 404);
  await loginPassword();
  await page.waitForURL(new URL("/admin/enroll", base).href);
  await waitForPageContent(page);
  const enrollmentCookie = await cookieHeader();
  await assertPrivateDenied(enrollmentCookie);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
  const setupKey = await page.locator("dt").filter({ hasText: /^Setup key$/ }).locator("xpath=following-sibling::dd").innerText();
  await page.getByLabel("Authenticator code", { exact: true }).fill(authenticatorCode(setupKey));
  await page.getByRole("button", { name: "Verify authenticator", exact: true }).click();
  const recoveryList = page.getByRole("list", { name: "Recovery codes", exact: true });
  await recoveryList.waitFor();
  const recoveryCodes = await recoveryList.getByRole("listitem").allTextContents();
  assert.equal(recoveryCodes.length, 10);
  await assertPrivateDenied(enrollmentCookie);
  await page.getByRole("checkbox", { name: "I have saved these recovery codes somewhere safe." }).check();
  await page.getByRole("button", { name: "Finish and sign in", exact: true }).click();
  await page.waitForURL(new URL("/admin/login", base).href);
  await waitForPageContent(page);
  await loginPassword();
  await page.getByRole("button", { name: "Use a recovery code", exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(recoveryCodes[0]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(new URL("/admin", base).href);
  await waitForPageContent(page);
  assert.match(await page.locator("main").innerText(), /Diagnostics/i);
  await page.evaluate(axe);
  const adminViolations = await page.evaluate(async () => (await window.axe.run(document,
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) })));
  failures.push(...adminViolations.map(item => ({ route: "/admin", width: 1920, ...item })));
  await page.screenshot({ path: path.join(out, "1920-admin-authenticated.png"), fullPage: true });
  observations.push({ check: "password-only denial, MFA enrollment, enrollment revocation and fresh recovery-code login", status: "pass" });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/admin", "/admin/uploads", `/admin/uploads/${first.uploadId}`, "/admin/security"]) {
      await page.goto(new URL(route, base).href, { waitUntil: "load" });
      await waitForPageContent(page);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(new URL(page.url()).pathname, route, "Authenticated admin route remains accessible");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Admin overflow: ${width} ${route}`);
      await page.evaluate(axe);
      const violations = await page.evaluate(async () => (await window.axe.run(document,
        { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })));
      failures.push(...violations.map(item => ({ route, width, ...item })));
      const screenshot = `${width}-${route.replaceAll("/", "_")}-authenticated.png`;
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
      observations.push({ check: "private history, details, diagnostics and security layout", route, width, screenshot });
    }
  }
  const fullCookie = await cookieHeader();
  await page.goto(new URL("/admin/security", base).href);
  await waitForPageContent(page);
  await page.getByRole("button", { name: "Sign out all devices", exact: true }).click();
  await page.waitForURL(new URL("/admin/login", base).href);
  await waitForPageContent(page);
  await assertPrivateDenied(fullCookie);
  await loginPassword();
  await page.getByRole("button", { name: "Use a recovery code", exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(recoveryCodes[0]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(new URL(page.url()).pathname, "/admin/login", "a consumed recovery code cannot grant access again");
  await page.getByLabel("Recovery code", { exact: true }).fill(recoveryCodes[1]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(new URL("/admin", base).href);
  await waitForPageContent(page);
  await page.goto(new URL("/admin/security", base).href);
  await waitForPageContent(page);
  await page.getByRole("button", { name: "Sign out this device", exact: true }).click();
  await page.waitForURL(new URL("/admin/login", base).href);
  await waitForPageContent(page);
  observations.push({ check: "admin diagnostics, revoked-session denial, one-use recovery codes and logout; no raid mutations", status: "pass" });
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({ author: "Neil Mitchell", modifier: "Neil Mitchell", observations, failures }, null, 2));
}
assert.equal(failures.length, 0, JSON.stringify(failures));
console.log(`E2E passed: text/ZIP upload, duplicate persistence, API validation, admin isolation and login, ${observations.filter(item => item.route).length} responsive renders, accessibility.`);
