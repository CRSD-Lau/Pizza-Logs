import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { waitForPageContent } from "./browser-page-ready.mjs";

// Synthetic uploads only, against the same disposable loopback stack as test:e2e.
const base = new URL(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
assert.equal(base.username + base.password, "");
const out = path.resolve(".test-artifacts/display-consistency");
await fs.mkdir(out, { recursive: true });
const observations = [];
const failures = [];
const boss = '0xF130008F98000001,"Lord Marrowgar",0xa48';
const mage = '0x06000000000000C1,"Numbermage",0x514';
const priest = '0x06000000000000C2,"Tinypriest",0x514';
const lines = ['5/20 23:59:00.000  ENCOUNTER_START,1084,"Lord Marrowgar",4,25'];
for (let index = 1; index <= 18; index++) {
  lines.push(`5/20 23:59:${String(index).padStart(2, "0")}.000  SPELL_DAMAGE,${mage},${boss},${900100 + index},"Synthetic spell ${String(index).padStart(2, "0")}",0x4,2000001,0,4,0,0,0,${index === 1 ? "1" : "nil"},nil,nil`);
}
lines.push(`5/20 23:59:19.000  SPELL_DAMAGE,${priest},${boss},585,"Smite",0x2,1,0,2,0,0,0,nil,nil,nil`);
lines.push(`5/20 23:59:20.000  SPELL_DAMAGE,${boss},${mage},900200,"Synthetic strike",0x1,1234567,0,1,0,0,0,nil,nil,nil`);
lines.push(`5/20 23:59:21.000  UNIT_DIED,0x0000000000000000,nil,0x80000000,${mage},0`);
lines.push(`5/21 00:01:00.000  UNIT_DIED,0x0000000000000000,nil,0x80000000,${boss},0`);
lines.push('5/21 00:01:01.000  ENCOUNTER_END,1084,"Lord Marrowgar",4,25,1');
lines.push('5/21 00:02:00.000  ENCOUNTER_START,1084,"Lord Marrowgar",4,25');
for (let index = 1; index <= 12; index++) {
  lines.push(`5/21 00:02:${String(index).padStart(2, "0")}.000  SPELL_DAMAGE,${mage},${boss},133,"Fireball",0x4,1,0,4,0,0,0,nil,nil,nil`);
}
lines.push(`5/21 00:02:30.000  UNIT_DIED,0x0000000000000000,nil,0x80000000,${boss},0`);
lines.push('5/21 00:02:31.000  ENCOUNTER_END,1084,"Lord Marrowgar",4,25,1');
const input = Buffer.from(lines.join("\n") + "\n");
const query = new URLSearchParams({ filename: "synthetic-display-consistency.txt", fileSize: String(input.length), uploaderName: "Audit", guildName: "Synthetic Display" });
const response = await fetch(new URL(`/api/upload?${query}`, base), {
  method: "POST", body: input, headers: { "content-type": "application/octet-stream", "x-upload-id": randomUUID() }, signal: AbortSignal.timeout(120000),
});
assert.equal(response.status, 200);
const events = (await response.text()).split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
assert.equal(events.some(event => event.type === "error"), false);
const upload = events.find(event => event.type === "complete")?.result;
assert.ok(upload, "Synthetic large-number report must persist");
const inventory = await (await fetch(new URL("/api/encounters?take=200", base))).json();
const encounter = inventory.find(value => value.uploadId === upload.uploadId && value.totalDamage === 36_000_019);
assert.ok(encounter);
assert.equal(encounter.totalDamage, 36_000_019);
const subject = encounter.participants.find(value => value.player.name === "Numbermage");
assert.ok(subject);
// The synthetic rate is in thousands. Derive only this fixture's expected presentation,
// independently of production helpers, while keeping the API's raw DPS intact.
assert.ok(subject.dps >= 1000 && subject.dps < 1_000_000);
const expectedRate = `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(subject.dps / 1000)}K`;
const report = `/raids/${upload.publicReportSlug}/sessions/${upload.firstSessionSlug}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce", locale: "de-DE", timezoneId: "America/Halifax" });
await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [`/encounters/${encounter.id}`, report, `${report}/players/Numbermage`, "/players/Numbermage", "/leaderboards?boss=lord-marrowgar", "/bosses/lord-marrowgar", "/bosses"]) {
      await page.goto(new URL(route, base).href, { waitUntil: "load" });
      await waitForPageContent(page);
      await page.evaluate(() => document.fonts.ready);
      if (route === report) {
        const year = new Date(encounter.startedAt).getUTCFullYear();
        assert.ok((await page.locator("main").innerText()).includes(`May 20, ${year}, 23:59 – May 21, ${year}, 00:02 UTC`), "Midnight range must show both dates in UTC");
      }
      if (route === `/encounters/${encounter.id}`) {
        const meter = page.locator("#damage");
        const row = meter.getByRole("button").filter({ hasText: "Numbermage" });
        await row.waitFor();
        assert.ok((await row.innerText()).includes("36.00M"));
        assert.ok((await row.innerText()).includes(expectedRate));
        assert.match(await row.innerText(), /1 death\s*·/);
        assert.match(await meter.getByRole("button").filter({ hasText: "Tinypriest" }).innerText(), /<0\.01%/);
        if (width < 1024) {
          assert.equal(await row.getByText("Damage", { exact: true }).isVisible(), true);
          assert.equal(await row.getByText("DPS", { exact: true }).isVisible(), true);
          assert.equal(await row.getByText("Share of total", { exact: true }).isVisible(), true);
        }
        await row.click();
        const more = meter.getByRole("button", { name: /Show.*more/i });
        await more.waitFor();
        assert.equal(await meter.getByText("Synthetic spell 18", { exact: true }).count(), 0);
        await more.click();
        await meter.getByText("Synthetic spell 18", { exact: true }).waitFor();
        assert.equal(await more.count(), 0);
        assert.match(await page.locator("main").innerText(), /UTC/);
        observations.push({ check: "compact two-decimal rates, tiny share, separated death count and all 18 spells", width, expectedRate });
      }
      if (route === `${report}/players/Numbermage`) {
        const values = page.getByText("View DPS chart values", { exact: true });
        await values.click();
        const table = page.getByRole("region", { name: "DPS chart values", exact: true }).getByRole("table");
        await table.waitFor();
        assert.ok((await table.innerText()).includes(expectedRate));
        observations.push({ check: "chart values use the same compact two-decimal format and are reachable without hover", width, expectedRate });
      }
      const geometry = await page.evaluate(() => ({
        width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        clippedNumbers: [...document.querySelectorAll("main .tabular-nums")].filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && /[0-9]/.test(element.textContent ?? "") && element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).display !== "inline";
        }).map(element => ({ text: element.textContent, width: element.clientWidth, required: element.scrollWidth })),
      }));
      if (geometry.documentWidth > width || geometry.clippedNumbers.length) failures.push({ route, ...geometry });
      const screenshot = `${width}-${route.replaceAll(/[^a-z0-9-]/gi, "_")}.png`;
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true, animations: "disabled" });
      await page.screenshot({ path: path.join(out, `viewport-${screenshot}`), animations: "disabled" });
      observations.push({ check: "compact two-decimal metric geometry in comparison surfaces", route, width, screenshot, ...geometry });
    }
  }
} catch (error) {
  failures.push({ error: error.stack ?? String(error) });
} finally {
  failures.push(...errors.map(error => ({ issue: "browser exception", error })));
  await browser.close();
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell", observations, failures }, null, 2) + "\n");
}
console.log(JSON.stringify({ observations: observations.length, failures: failures.length, out }));
assert.equal(failures.length, 0, "Display consistency checks must pass");
