import assert from "node:assert/strict";
import { resolvePlayerProfile } from "../lib/player-profile";

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

console.log("player-profile tests passed");
