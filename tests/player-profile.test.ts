import assert from "node:assert/strict";
import {
  buildPlayerPerBossSummary,
  buildPlayerRecentEncounters,
  resolvePlayerProfile,
} from "../lib/player-profile";

const rosterOnlyProfile = resolvePlayerProfile({
  player: null,
  rosterMember: {
    characterName: "Maximusboom",
    realm: "Lordaeron",
    guildName: "PizzaWarriors",
    className: "Druid",
    raceName: "Night Elf",
    level: 80,
    rankName: "First of Equals",
  },
});

assert.deepEqual(rosterOnlyProfile, {
  name: "Maximusboom",
  realmName: "Lordaeron",
  guildName: "PizzaWarriors",
  className: "Druid",
  raceName: "Night Elf",
  level: 80,
  rankName: "First of Equals",
  isRosterOnly: true,
  milestones: [],
});

const combatLogProfile = resolvePlayerProfile({
  player: {
    name: "Lausudo",
    class: "Paladin",
    realm: { name: "Lordaeron" },
    milestones: [{ id: "m1" }],
  },
  rosterMember: {
    characterName: "Lausudo",
    realm: "Lordaeron",
    guildName: "PizzaWarriors",
    className: "Paladin",
    raceName: "Human",
    level: 80,
    rankName: "Core 1",
  },
});

assert.ok(combatLogProfile);
assert.equal(combatLogProfile.isRosterOnly, false);
assert.equal(combatLogProfile.name, "Lausudo");
assert.equal(combatLogProfile.guildName, "PizzaWarriors");
assert.equal(combatLogProfile.rankName, "Core 1");
assert.deepEqual(combatLogProfile.milestones, [{ id: "m1" }]);

const perBossSummary = buildPlayerPerBossSummary([
  {
    dps: 11920,
    hps: 1230,
    encounter: {
      outcome: "KILL",
      boss: { name: "Blood-Queen Lana'thel", slug: "blood-queen-lanathel" },
    },
  },
  {
    dps: 10420,
    hps: 0,
    encounter: {
      outcome: "KILL",
      boss: { name: "Deathbringer Saurfang", slug: "deathbringer-saurfang" },
    },
  },
  {
    dps: 2180,
    hps: 0,
    encounter: {
      outcome: "KILL",
      boss: { name: "Gunship Battle", slug: "gunship-battle" },
    },
  },
  {
    dps: 7830,
    hps: 0,
    encounter: {
      outcome: "WIPE",
      boss: { name: "Professor Putricide", slug: "professor-putricide" },
    },
  },
  {
    dps: 6500,
    hps: 0,
    encounter: {
      outcome: "KILL",
      boss: { name: "The Lich King", slug: "the-lich-king" },
    },
  },
  {
    dps: 2100,
    hps: 0,
    encounter: {
      outcome: "WIPE",
      boss: { name: "Gunship Battle", slug: "gunship-battle" },
    },
  },
]);

assert.deepEqual(
  perBossSummary.map((boss) => boss.bossName),
  [
    "Gunship Battle",
    "Deathbringer Saurfang",
    "Professor Putricide",
    "Blood-Queen Lana'thel",
    "The Lich King",
  ],
);
assert.equal(perBossSummary[0].kills, 1);
assert.equal(perBossSummary[0].bestDps, 2180);
assert.equal(perBossSummary[3].bestHps, 1230);

const recentEncounters = buildPlayerRecentEncounters(
  [
    {
      id: "lich-king-recent",
      dps: 5940,
      hps: 0,
      encounter: {
        startedAt: new Date("2026-09-04T20:05:00Z"),
        outcome: "KILL",
        boss: { name: "The Lich King", slug: "the-lich-king" },
      },
    },
    {
      id: "sindragosa-recent",
      dps: 8140,
      hps: 0,
      encounter: {
        startedAt: new Date("2026-09-04T20:04:00Z"),
        outcome: "KILL",
        boss: { name: "Sindragosa", slug: "sindragosa" },
      },
    },
    {
      id: "gunship-recent",
      dps: 5500,
      hps: 0,
      encounter: {
        startedAt: new Date("2026-09-04T20:02:00Z"),
        outcome: "KILL",
        boss: { name: "Gunship Battle", slug: "gunship-battle" },
      },
    },
    {
      id: "saurfang-recent",
      dps: 12980,
      hps: 0,
      encounter: {
        startedAt: new Date("2026-09-04T20:03:00Z"),
        outcome: "KILL",
        boss: { name: "Deathbringer Saurfang", slug: "deathbringer-saurfang" },
      },
    },
    {
      id: "marrowgar-older",
      dps: 1000,
      hps: 0,
      encounter: {
        startedAt: new Date("2026-09-04T20:01:00Z"),
        outcome: "KILL",
        boss: { name: "Lord Marrowgar", slug: "lord-marrowgar" },
      },
    },
  ],
  4,
);

assert.deepEqual(
  recentEncounters.map((encounter) => encounter.id),
  ["lich-king-recent", "sindragosa-recent", "saurfang-recent", "gunship-recent"],
);

const shuffledHistory = Array.from({ length: 55 }, (_, index) => ({
  id: String(index), dps: 0, hps: 0,
  encounter: { startedAt: new Date(Date.UTC(2026, 8, 4, 20, index)), outcome: "KILL", boss: { name: "Lord Marrowgar", slug: "lord-marrowgar" } },
}));
const latestFifty = buildPlayerRecentEncounters(shuffledHistory);
assert.equal(latestFifty.length, 50);
assert.equal(latestFifty[0].id, "54", "Sort by recorded time before selecting the latest window");
assert.equal(latestFifty[49].id, "5");
assert.equal(shuffledHistory[0].id, "0", "Do not mutate caller order");
const sameTime = shuffledHistory.slice(0, 2).map(row => ({ ...row, encounter: { ...row.encounter, startedAt: "2026-09-04T20:00:00Z" } }));
assert.deepEqual(buildPlayerRecentEncounters(sameTime).map(row => row.id), ["0", "1"], "Preserve source order for simultaneous attempts");

console.log("player-profile tests passed");
