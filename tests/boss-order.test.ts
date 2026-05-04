import assert from "node:assert/strict";
import {
  ICC_BOSS_ORDER_NAMES,
  normalizeIccBossName,
  sortBossesByICCOrder,
  sortByICCOrder,
  WOTLK_BOSSES,
} from "../lib/constants/bosses";

const alphabeticalIccBosses = [
  "Blood Prince Council",
  "Blood-Queen Lana'thel",
  "Deathbringer Saurfang",
  "Festergut",
  "Gunship Battle",
  "Lady Deathwhisper",
  "Lord Marrowgar",
  "Professor Putricide",
  "Rotface",
  "Sindragosa",
  "The Lich King",
  "Valithria Dreamwalker",
].map((name) => ({ name }));

assert.deepEqual(
  sortBossesByICCOrder(alphabeticalIccBosses).map((boss) => boss.name),
  ICC_BOSS_ORDER_NAMES,
);

assert.deepEqual(
  sortBossesByICCOrder([
    { name: "Professor Putricide" },
    { name: "Lord Marrowgar" },
    { name: "Deathbringer Saurfang" },
  ]).map((boss) => boss.name),
  ["Lord Marrowgar", "Deathbringer Saurfang", "Professor Putricide"],
);

assert.deepEqual(
  sortBossesByICCOrder([
    { name: "Halion" },
    { name: "Gunship Battle" },
    { name: "Lord Jaraxxus" },
    { name: "Lord Marrowgar" },
  ]).map((boss) => boss.name),
  ["Lord Marrowgar", "Gunship Battle", "Halion", "Lord Jaraxxus"],
);

assert.deepEqual(
  sortByICCOrder(
    [
      { id: "rotface-wipe", boss: { name: "Rotface" } },
      { id: "festergut-kill", boss: { name: "Festergut" } },
      { id: "rotface-kill", boss: { name: "Rotface" } },
    ],
    (encounter) => encounter.boss.name,
  ).map((encounter) => encounter.id),
  ["festergut-kill", "rotface-wipe", "rotface-kill"],
);

assert.equal(normalizeIccBossName("Gunship"), "Gunship Battle");
assert.equal(normalizeIccBossName("Gunship Battle - Alliance"), "Gunship Battle");
assert.equal(normalizeIccBossName("Lich King"), "The Lich King");
assert.equal(normalizeIccBossName("Blood Queen Lanathel"), "Blood-Queen Lana'thel");
assert.equal(normalizeIccBossName("Halion"), "Halion");

const seededIccBossNames = WOTLK_BOSSES
  .filter((boss) => boss.raidSlug === "icecrown-citadel")
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((boss) => boss.name);

assert.deepEqual(seededIccBossNames, ICC_BOSS_ORDER_NAMES);

console.log("boss-order tests passed");
