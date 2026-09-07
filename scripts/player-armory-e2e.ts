// Author: Neil Mitchell
// Last Modified By: Neil Mitchell
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";
import { db } from "../lib/db";
import { parseArmorySection, parseArmorySpell } from "../lib/armory-profile-parser";
import type { ArmorySection } from "../lib/armory-profile";

async function main() {
  const base = process.env.PIZZA_ARMORY_E2E_URL ?? process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000";
  const url = new URL(base), database = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && ["localhost", "127.0.0.1"].includes(database.hostname), "Loopback only");
  const name = "Qzarmorydemo", realm = "Lordaeron", prefix = `armory-e2e-${randomUUID()}`;
  const out = path.resolve(".test-artifacts/player-armory");
  await mkdir(out, { recursive: true });
  const ownedCache: string[] = [];
  let playerId: string | undefined, gearId: string | undefined;
  const fixture = async (file: string) => (await readFile(`tests/fixtures/armory/${file}`, "utf8")).replaceAll("Mothrmonster", name);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  try {
    assert.equal(await db.player.count({ where: { name } }), 0, "Refuse an existing fixture player");
    const realmRow = await db.realm.findFirstOrThrow({ where: { name: realm, host: "warmane" } });
    const player = await db.player.create({ data: { id: `${prefix}-player`, name, class: "Paladin", realmId: realmRow.id } });
    playerId = player.id;
    const gear = { characterName: name, realm, className: "Paladin", raceName: "Draenei", guildName: "Illustrative preview",
      sourceUrl: `https://armory.warmane.com/character/${name}/${realm}/summary`, fetchedAt: new Date().toISOString(), appearance: null,
      items: [{ slot: "Head", itemId: "51162", name: "Sanctified Lightsworn Helmet", itemLevel: 264, equipLoc: "INVTYPE_HEAD",
        quality: "Epic", iconUrl: "https://cdn.warmane.com/wotlk/icons/large/inv_helmet_154.jpg" }] };
    gearId = `${prefix}-gear`;
    await db.armoryGearCache.create({ data: { id: gearId, characterKey: name.toLowerCase(), characterName: name, realm, sourceUrl: gear.sourceUrl, gear, fetchedAt: new Date() } });
    const sections: [ArmorySection, string, string, string?][] = [
      ["summary", "summary.html", "summary"], ["talents", "talents.html", "summary"],
      ["achievements", "achievements.html", "summary", "achievements-summary.json"],
      ["achievements", "achievements.html", "92", "achievements-category.json"],
      ["statistics", "statistics.html", "summary", "statistics-summary.json"],
      ["reputation", "reputation.html", "summary"], ["collections", "mounts-and-companions.html", "summary"], ["pvp", "match-history.html", "summary"],
    ];
    for (const [section, file, category, fragment] of sections) {
      const payload = parseArmorySection(await fixture(file), name, realm, section, category,
        fragment ? JSON.parse(await fixture(fragment)).content : undefined, section === "summary" ? JSON.parse(await fixture("api.json")) : undefined);
      const id = `${prefix}-cache-${ownedCache.length}`;
      await db.armoryProfileCache.create({ data: { id, characterKey: name.toLowerCase(), realm: realm.toLowerCase(), sectionKey: `v1:${section}:${category}`, payload, fetchedAt: new Date() } });
      ownedCache.push(id);
    }
    const spellIdentity = { characterKey: "_spell", realm: "wotlk", sectionKey: "v1:20332" };
    if (!await db.armoryProfileCache.findUnique({ where: { characterKey_realm_sectionKey: spellIdentity } })) {
      const id = `${prefix}-spell`;
      await db.armoryProfileCache.create({ data: { id, ...spellIdentity, payload: parseArmorySpell(await fixture("spell.html"), 20332), fetchedAt: new Date() } });
      ownedCache.push(id);
    }
    const requests: string[] = [];
    page.on("request", request => { if (request.url().includes("/armory?")) requests.push(request.url()); });
    await page.goto(`${base}/players/${name}?realm=${realm}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Warmane Armory", exact: true }).waitFor();
    await page.getByText("2,623", { exact: true }).waitFor();
    assert.equal(requests.length, 0, "Initial profile uses streamed overview; unopened categories do not fetch");
    await page.screenshot({ path: path.join(out, "desktop-overview.png"), fullPage: true });
    const section = page.locator("#armory");
    await section.getByRole("button", { name: "Talents & glyphs", exact: true }).click();
    await section.getByRole("button", { name: /Build 2 · Holy/ }).waitFor();
    assert.equal(await section.getByRole("button", { name: /points, spell/ }).count(), 78);
    await section.getByRole("button", { name: "Holy, row 1, column 3: 5 of 5 points, spell 20332", exact: true }).click();
    await section.getByRole("heading", { name: /Seals of the Pure/ }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, "desktop-talents.png"), fullPage: true });
    await section.getByRole("button", { name: /Build 2 · Holy/ }).click();
    await section.getByRole("link", { name: "Glyph of Holy Light ↗", exact: true }).waitFor();
    await section.getByRole("button", { name: "Achievements", exact: true }).click();
    await section.getByText("Achievements completed: 261 / 1058", { exact: true }).waitFor();
    await section.getByLabel("Category", { exact: true }).selectOption("92");
    await section.getByRole("searchbox").fill("Master of Arms");
    await section.getByRole("link", { name: "Master of Arms ↗" }).waitFor();
    await section.getByRole("button", { name: "Statistics", exact: true }).click();
    await section.getByRole("searchbox").fill("Largest heal cast");
    await section.getByText("8,500,000", { exact: true }).waitFor();
    await section.getByRole("button", { name: "Reputation", exact: true }).click();
    await section.getByRole("searchbox").fill("Booty Bay");
    await section.getByText("446 / 6,000", { exact: true }).waitFor();
    await section.getByRole("button", { name: "Mounts & companions", exact: true }).click();
    await section.getByRole("link", { name: "Perky Pug ↗", exact: true }).waitFor();
    await section.getByRole("button", { name: "Arena history", exact: true }).click();
    await section.getByText("None listed by Warmane.", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await section.getByRole("button", { name: "Overview", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, "mobile-overview.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "No mobile horizontal overflow");
    await section.getByRole("button", { name: "Talents & glyphs", exact: true }).click();
    await section.getByRole("button", { name: /Build 1 · Retribution/ }).waitFor();
    await section.getByRole("group", { name: "Talent tree", exact: true }).getByRole("button", { name: "Retribution · 52", exact: true }).click();
    assert.equal(await section.getByRole("button", { name: /^Holy, row/ }).count(), 0, "Mobile displays one selected tree");
    await section.getByRole("group", { name: "Talent tree", exact: true }).getByRole("button", { name: "Holy · 13", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, "mobile-talents.png"), fullPage: true });
    const smallTargets = await section.locator("button").evaluateAll(nodes => nodes.filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && (rect.width < 44 || rect.height < 44); }).length);
    assert.equal(smallTargets, 0, "All visible buttons meet the 44px target");
    const firstNode = section.getByRole("button", { name: "Holy, row 1, column 3: 5 of 5 points, spell 20332", exact: true });
    await firstNode.focus(); await page.keyboard.press("Enter");
    await section.getByRole("heading", { name: /Seals of the Pure/ }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("tabindex")), "-1", "Keyboard selection focuses details");
    assert.equal((await page.request.get(`${base}/api/players/Unknownzz/armory?realm=Lordaeron`)).status(), 404);
    assert.equal((await page.request.get(`${base}/api/players/${name}/armory?realm=Lordaeron&section=achievements&category=999999`)).status(), 400);
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const accessibility = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (element: Element, options: unknown) => Promise<{ violations: { id: string; impact: string; description: string }[] }> } }).axe;
      return axe.run(document.querySelector("#armory")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    });
    assert.deepEqual(accessibility.violations.map(value => ({ id: value.id, impact: value.impact, description: value.description })), [], "Armory accessibility checks");
    assert.deepEqual(errors, []);
    await writeFile(path.join(out, "verification.json"), JSON.stringify({ author: "Neil Mitchell", lastModifiedBy: "Neil Mitchell", passed: true, screenshots: 4, sections: 7, requests: requests.length, errors }, null, 2));
    console.log("Player Armory E2E passed: seven sections, dual specs, spell details, category search, keyboard, mobile, route guards");
  } finally {
    await browser.close();
    await db.armoryProfileCache.deleteMany({ where: { id: { in: ownedCache } } });
    if (gearId) await db.armoryGearCache.deleteMany({ where: { id: gearId } });
    if (playerId) await db.player.deleteMany({ where: { id: playerId } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
