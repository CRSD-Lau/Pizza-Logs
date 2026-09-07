import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseArmorySection, parseArmorySpell } from "../lib/armory-profile-parser";
import { ArmorySectionDataSchema, isArmoryCategory } from "../lib/armory-profile";

const fixture = (name: string) => readFileSync(`tests/fixtures/armory/${name}`, "utf8");
const fragment = (name: string) => JSON.parse(fixture(name)).content as string;
const name = "Mothrmonster", realm = "Lordaeron";

test("live summary preserves all six stat groups, zero values, professions and both specs", () => {
  const result = parseArmorySection(fixture("summary.html"), name, realm, "summary", "summary", undefined, JSON.parse(fixture("api.json")));
  const group = (title: string) => result.groups.find(group => group.title === title)!;
  for (const title of ["Melee", "Ranged", "Spell", "Attributes", "Defense", "Resistances"]) assert.ok(group(title), title);
  assert.equal(group("Attributes").rows.find(row => row.label === "Strength")?.value, "2623");
  assert.equal(group("Spell").rows.find(row => row.label === "Critical")?.value, "0%");
  assert.equal(group("Resistances").rows.find(row => row.label === "Arcane")?.value, "0");
  assert.equal(group("Specializations").rows.length, 2);
  assert.equal(group("Secondary skills").rows.length, 2);
  assert.equal(group("Recent activity").rows.length, 8);
  assert.equal(group("Character").rows.find(row => row.label === "Achievement points")?.value, "2660");
});

test("live dual spec trees retain every node, position, allocation and glyph", () => {
  const result = parseArmorySection(fixture("talents.html"), name, realm, "talents");
  assert.equal(result.specs.length, 2);
  assert.deepEqual(result.specs.map(spec => spec.name), ["Retribution", "Holy"]);
  assert.deepEqual(result.specs.map(spec => spec.trees.map(tree => tree.points)), [[13, 6, 52], [51, 20, 0]]);
  assert.deepEqual(result.specs.map(spec => spec.trees.map(tree => tree.name)), [["Holy", "Protection", "Retribution"], ["Holy", "Protection", "Retribution"]]);
  assert.ok(result.specs[0].trees.every(tree => tree.nodes.length > 20));
  const node = result.specs[0].trees[0].nodes.find(node => node.spellId === 20332)!;
  assert.deepEqual([node.row, node.column, node.rank, node.maxRank], [0, 2, 5, 5]);
  assert.ok(result.specs[1].trees[2].nodes.every(node => node.rank === 0));
  assert.equal(result.specs[0].glyphs.length, 6);
  assert.equal(result.specs[1].glyphs.length, 5);
  assert.equal(result.specs[0].glyphs[0].name, "Glyph of Seal of Vengeance");
});

test("category fragments preserve progress, earned and unearned achievements, and missing statistics", () => {
  const achievements = parseArmorySection(fixture("achievements.html"), name, realm, "achievements", "summary", fragment("achievements-summary.json"));
  assert.ok(achievements.categories.some(category => category.id === "15042"));
  assert.equal(achievements.groups[0].rows.length, 10);
  assert.match(achievements.groups[0].rows[0].value, /261 \/ 1058/);
  const list = parseArmorySection(fixture("achievements.html"), name, realm, "achievements", "92", fragment("achievements-category.json"));
  assert.ok(list.groups[0].rows.some(row => row.value === "Not earned"));
  assert.ok(list.groups[0].rows.some(row => row.label === "Master of Arms" && row.value === "Earned 09/05/2026"));
  const statistics = parseArmorySection(fixture("statistics.html"), name, realm, "statistics", "summary", fragment("statistics-summary.json"));
  assert.equal(statistics.groups[0].rows.length, 57);
  assert.ok(statistics.groups[0].rows.some(row => row.value === "- -"));
});

test("a second live class keeps class-specific tree layouts and missing glyph slots", () => {
  const result = parseArmorySection(fixture("druid-talents.html"), "Azyva", realm, "talents");
  assert.equal(result.specs.length, 2);
  assert.deepEqual(result.specs[0].trees.map(tree => tree.name), ["Balance", "Feral Combat", "Restoration"]);
  assert.ok(result.specs.every(spec => spec.trees.length === 3));
  assert.ok(result.specs[0].trees[0].nodes.some(node => node.row === 10));
});

test("reputation, collections and empty arena history remain independently usable", () => {
  const reputation = parseArmorySection(fixture("reputation.html"), name, realm, "reputation");
  assert.equal(reputation.groups[0].rows[0].label, "Booty Bay");
  assert.equal(reputation.groups[0].rows[0].detail, "446 / 6000");
  assert.equal(reputation.groups[0].rows.length, 41);
  const collections = parseArmorySection(fixture("mounts-and-companions.html"), name, realm, "collections");
  assert.deepEqual(collections.groups.map(group => group.rows.length), [5, 1]);
  assert.equal(parseArmorySection(fixture("match-history.html"), name, realm, "pvp").groups[0].rows.length, 0);
});

test("wrong identity, markup drift and oversized or hostile documents never become fresh snapshots", () => {
  assert.throws(() => parseArmorySection(fixture("talents.html"), name, "Icecrown", "talents"));
  assert.throws(() => parseArmorySection(fixture("talents.html"), "Another", realm, "talents"));
  assert.throws(() => parseArmorySection("<title>Challenge</title>", name, realm, "talents"));
  assert.throws(() => parseArmorySection(fixture("talents.html").replace("5/5", "9/5"), name, realm, "talents"));
  assert.throws(() => parseArmorySection(fixture("talents.html").replace('id="spec-1"', 'id="spec-0"'), name, realm, "talents"));
  assert.throws(() => parseArmorySection("x".repeat(2 * 1024 * 1024 + 1), name, realm, "summary"));
  assert.throws(() => parseArmorySection(fixture("achievements.html"), name, realm, "achievements", "999999", fragment("achievements-summary.json")));
  const talents = parseArmorySection(fixture("talents.html").replaceAll("//cdn.warmane.com", "//evil.invalid"), name, realm, "talents");
  assert.ok(talents.specs.every(spec => spec.trees.every(tree => tree.nodes.every(node => !node.iconUrl))));
  assert.equal(isArmoryCategory("talents", "92"), false);
  assert.equal(isArmoryCategory("achievements", "92"), true);
  assert.equal(ArmorySectionDataSchema.safeParse({ ...talents, groups: [{ title: "Bad", rows: [{ label: "X", value: "Y", url: "javascript:alert(1)" }] }] }).success, false);
});

test("talent descriptions use verified spell identity", () => {
  const spell = parseArmorySpell(fixture("spell.html"), 20332);
  assert.equal(spell.name, "Seals of the Pure");
  assert.match(spell.description, /by 15%/);
  assert.throws(() => parseArmorySpell(fixture("spell.html"), 1));
});
