import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("E2E uploads are restricted to an isolated loopback test stack.");
}
const out = path.resolve(process.env.PIZZA_TEST_ARTIFACTS ?? ".test-artifacts/e2e");
await fs.mkdir(out, { recursive: true });
const observations = [];
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
async function upload(bytes, filename = "synthetic.txt") {
  const params = new URLSearchParams({ filename, fileSize: String(bytes.length), uploaderName: "Audit", guildName: "Synthetic Audit" });
  const response = await fetch(new URL(`/api/upload?${params}`, base), {
    method: "POST", body: bytes, signal: AbortSignal.timeout(120000),
    headers: { "content-type": "application/octet-stream", "x-upload-id": randomUUID() },
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.some(event => event.type === "error"), false, JSON.stringify(events));
  const complete = events.find(event => event.type === "complete");
  assert.ok(complete, "Upload must complete and persist");
  return complete.result;
}
const input = await fs.readFile(new URL("../parser/tests/fixtures/icc-25n-synthetic/combatlog.txt", import.meta.url));
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
assert.equal(policyKill.totalDamage, 1500, "Winning-fight damage includes its add, without wipes or between-fight trash");
assert.equal(policyKill.totalHealing, 900, "Winning-fight healing excludes overheal");
assert.equal(policyKill.totalDamageTaken, 450);
assert.ok(policyKill.durationMs > 0);
const routes = ["/", "/raids", "/bosses", "/leaderboards", "/players", "/weekly", "/guild-roster", "/admin/login", report, `/encounters/${encounter.id}`, "/players/Phyre"];
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
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
  assert.match(await page.locator("main").innerText(), /54[.,]0K|54,000/, "UI must display the same damage primitive");
  const metricColumns = [
    ["name", "Player"], ["totalDamage", "Total Damage"], ["dps", "DPS"],
    ["heal", "Heal"], ["healPerSecond", "H+A PS"], ["damageTaken", "Damage Taken"], ["dtps", "DTPS"],
  ];
  const playerView = (label, width) => page.getByRole(width < 768 ? "list" : "table", { name: label, exact: true });
  const playerNames = (view, width) => width < 768
    ? view.locator(":scope > li > div:first-child").allTextContents()
    : view.locator("tbody th[scope='row']").allTextContents();
  const cardValue = (scope, label) => scope.getByText(label, { exact: true }).locator("..").locator(":scope > div").nth(1).innerText();
  const assertKillCards = async () => {
    const scope = page.getByRole("region", { name: "Boss kill summary", exact: true });
    assert.equal(await cardValue(scope, "Total Damage"), "1.5K");
    assert.equal(await cardValue(scope, "Heal"), "900");
    assert.equal(await cardValue(scope, "Damage Taken"), "450");
  };
  const assertPlayerValues = async (view, width, expected) => {
    for (const [index, values] of expected.entries()) {
      const row = width < 768 ? view.locator(":scope > li").nth(index) : view.locator("tbody tr").nth(index);
      assert.deepEqual(await row.locator(width < 768 ? "dd" : "td").allTextContents(), values);
    }
  };
  const assertSorting = async (label, width, ascending) => {
    const view = playerView(label, width);
    const controls = view.locator("..").locator("..");
    for (const [key, column] of metricColumns) {
      for (const direction of ["ascending", "descending"]) {
        const status = `${label}: sorted by ${column}, ${direction}.`;
        if (width < 768) {
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
  const fullAscending = {
    name: ["SyntheticFirst", "SyntheticSecond", "SyntheticThird", "SyntheticTrashOnly"],
    totalDamage: ["SyntheticThird", "SyntheticTrashOnly", "SyntheticSecond", "SyntheticFirst"],
    dps: ["SyntheticThird", "SyntheticTrashOnly", "SyntheticSecond", "SyntheticFirst"],
    heal: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    healPerSecond: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    damageTaken: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
    dtps: ["SyntheticTrashOnly", "SyntheticFirst", "SyntheticThird", "SyntheticSecond"],
  };
  const rate = amount => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount / (policyKill.durationMs / 1000));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(new URL(policyReport, base).href);
    const defaultText = await page.locator("main").innerText();
    assert.match(defaultText, /1K \/ 1W/);
    assert.match(defaultText, /1 short pull excluded/);
    await assertKillCards();
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 2);
    const killView = playerView("Boss kill player metrics", width);
    assert.deepEqual(await playerNames(killView, width), killPlayers.map(player => player.name));
    await assertPlayerValues(killView, width, killPlayers.map(player => [
      String(player.damage), rate(player.damage), String(player.heal), rate(player.heal), String(player.taken), rate(player.taken),
    ]));
    assert.equal(await killView.getByRole("link", { name: "View SyntheticFirst's all-attempt raid report", exact: true }).getAttribute("href"), `${policyReport}/players/SyntheticFirst`);
    await assertSorting("Boss kill player metrics", width, killAscending);
    const fullToggle = page.getByRole("button", { name: /^Full Session Breakdown/ });
    const fullContent = page.locator(`[id="${await fullToggle.getAttribute("aria-controls")}"]`);
    assert.equal(await fullToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await fullContent.getAttribute("aria-hidden"), "true");
    assert.equal(await fullContent.evaluate(element => element.inert), true);
    const hiddenControl = fullContent.locator(width < 768 ? "select" : "table button").first();
    await hiddenControl.evaluate(element => element.focus());
    assert.equal(await hiddenControl.evaluate(element => document.activeElement === element), false, "Collapsed metrics cannot receive keyboard focus");
    await fullToggle.click();
    assert.equal(await fullContent.getAttribute("aria-hidden"), "false");
    assert.equal(await fullContent.evaluate(element => element.inert), false);
    const fullView = playerView("Full session player metrics", width);
    await fullView.waitFor();
    const fullTotals = fullContent.locator('[aria-label="Full session totals"]');
    assert.equal(await cardValue(fullTotals, "Total Damage"), "4.8K");
    assert.equal(await cardValue(fullTotals, "Heal"), "1.9K");
    assert.equal(await cardValue(fullTotals, "Damage Taken"), "1.4K");
    assert.deepEqual(await playerNames(fullView, width), ["SyntheticFirst", "SyntheticSecond", "SyntheticTrashOnly", "SyntheticThird"]);
    assert.equal(await fullView.getByRole("link", { name: /SyntheticTrashOnly/ }).count(), 0, "A trash-only player has no boss-attempt link");
    await assertSorting("Full session player metrics", width, fullAscending);
    assert.deepEqual(await playerNames(killView, width), ["SyntheticThird", "SyntheticFirst", "SyntheticSecond"], "The two breakdowns keep independent sorting");
    await fullToggle.click();
    assert.equal(await fullContent.evaluate(element => element.inert), true);
    const mobToggle = page.getByRole("button", { name: /^Mob Damage - Boss Kills/ });
    await mobToggle.click();
    const mobContent = page.locator(`[id="${await mobToggle.getAttribute("aria-controls")}"]`);
    assert.match(await mobContent.innerText(), /Lord Marrowgar/);
    assert.match(await mobContent.innerText(), /Synthetic Kill Add/);
    assert.doesNotMatch(await mobContent.innerText(), /Synthetic Wipe Add|Synthetic Between-Fight Trash/);
    // Contrast must be measured after the accordion's opening opacity transition.
    await page.waitForFunction(id => {
      const panel = document.getElementById(id);
      return panel && !panel.inert && getComputedStyle(panel).opacity === "1";
    }, await mobToggle.getAttribute("aria-controls"));
    await page.evaluate(axe);
    const policyViolations = await page.evaluate(async () => (await window.axe.run(document,
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(item => ({
        id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
      })));
    failures.push(...policyViolations.map(item => ({ route: policyReport, width, ...item })));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, `${width}-short-pulls-default.png`), fullPage: true });
    await page.getByRole("link", { name: "Include short pulls", exact: true }).click();
    await page.waitForURL(new URL(`${policyReport}?includeShortPulls=1`, base).href);
    const includedText = await page.locator("main").innerText();
    assert.match(includedText, /1K \/ 2W/);
    assert.match(includedText, /1 short pull included/);
    await assertKillCards();
    const includedKillView = playerView("Boss kill player metrics", width);
    assert.deepEqual((await playerNames(includedKillView, width)).sort(), killPlayers.map(player => player.name).sort(), "Including short pulls cannot add wipe-only players to kill metrics");
    assert.equal(await includedKillView.getByRole("link", { name: "View SyntheticFirst's all-attempt raid report", exact: true }).getAttribute("href"), `${policyReport}/players/SyntheticFirst?includeShortPulls=1`);
    assert.equal(await page.locator('a[href^="/encounters/"]').count(), 3);
    await page.screenshot({ path: path.join(out, `${width}-short-pulls-included.png`), fullPage: true });
    await page.getByRole("link", { name: "Exclude short pulls", exact: true }).click();
    await page.waitForURL(new URL(policyReport, base).href);
    assert.match(await page.locator("main").innerText(), /1K \/ 1W/);
  }
  const briefAttempt = policyEncounters.find(value => value.outcome === "WIPE" && value.durationMs < 10000);
  assert.ok(briefAttempt);
  assert.equal((await page.goto(new URL(`/encounters/${briefAttempt.id}`, base).href)).status(), 200);
  for (const route of ["/", "/raids", "/bosses", "/bosses/lord-marrowgar", "/weekly", "/players?class=Rogue", "/players/SyntheticFirst", `${policyReport}/players/SyntheticFirst`]) {
    const original = new URL(route, base);
    await page.goto(original.href);
    await page.getByRole("link", { name: "Include short pulls", exact: true }).click();
    await page.waitForURL(url => url.pathname === original.pathname && url.searchParams.get("includeShortPulls") === "1");
    if (original.searchParams.has("class")) assert.equal(new URL(page.url()).searchParams.get("class"), original.searchParams.get("class"));
    await page.getByRole("link", { name: "Exclude short pulls", exact: true }).click();
    await page.waitForURL(url => url.pathname === original.pathname && !url.searchParams.has("includeShortPulls"));
  }
  observations.push({ check: "kill-only totals and targets, retained full-session trash/wipes, all-column sorting in both directions at 390/1440px, independent scopes and collapsed-control focus exclusion", status: "pass" });
  observations.push({ check: "short-pull counting, include-all without changing kill metrics, short kill and death-bearing wipe retention, direct access", status: "pass" });
  await page.goto(new URL(report, base).href);
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY");
  await page.goto(base.href);
  await page.getByLabel("Character", { exact: false }).fill("Synthetic Auditor");
  await context.route("**/api/upload?**", async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose File", exact: true }).click();
  await (await chooser).setFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: input });
  await page.getByRole("progressbar", { name: "Combat log upload" }).waitFor();
  await page.screenshot({ path: path.join(out, "1920-upload-progress.png"), fullPage: true });
  await page.getByText("Already Parsed", { exact: true }).waitFor();
  await page.getByRole("link", { name: /View your raid report/ }).click();
  await page.waitForURL(new URL(report, base).href);
  assert.match(await page.locator("main").innerText(), /54[.,]0K|54,000/);
  observations.push({ check: "native file chooser, announced progress and duplicate report navigation", status: "pass" });
  await page.goto(base.href);
  await page.getByLabel("Character", { exact: false }).fill("Synthetic Auditor");
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
  await loginPassword();
  await page.getByRole("button", { name: "Use a recovery code", exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(recoveryCodes[0]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(new URL("/admin", base).href);
  assert.match(await page.locator("main").innerText(), /Diagnostics/i);
  await page.evaluate(axe);
  const adminViolations = await page.evaluate(async () => (await window.axe.run(document,
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) })));
  failures.push(...adminViolations.map(item => ({ route: "/admin", width: 1920, ...item })));
  await page.screenshot({ path: path.join(out, "1920-admin-authenticated.png"), fullPage: true });
  observations.push({ check: "password-only denial, MFA enrollment, enrollment revocation and fresh recovery-code login", status: "pass" });
  const fullCookie = await cookieHeader();
  await page.goto(new URL("/admin/security", base).href);
  await page.getByRole("button", { name: "Sign out all devices", exact: true }).click();
  await page.waitForURL(new URL("/admin/login", base).href);
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
  await page.goto(new URL("/admin/security", base).href);
  await page.getByRole("button", { name: "Sign out this device", exact: true }).click();
  await page.waitForURL(new URL("/admin/login", base).href);
  observations.push({ check: "admin diagnostics, revoked-session denial, one-use recovery codes and logout; no raid mutations", status: "pass" });
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({ author: "Neil Mitchell", modifier: "Neil Mitchell", observations, failures }, null, 2));
}
assert.equal(failures.length, 0, JSON.stringify(failures));
console.log(`E2E passed: text/ZIP upload, duplicate persistence, API validation, admin isolation and login, ${observations.filter(item => item.route).length} responsive renders, accessibility.`);
