import assert from "node:assert/strict";
import { isMatchingArmorySource, playerIdentityKey, resolvePlayerIdentity, type PlayerIdentityObservation } from "../lib/player-identity";

const player = { name: "Lausudo", realmName: "Lordaeron", class: "mage" };
const observation: PlayerIdentityObservation = {
  characterName: "LAUSUDO", realm: "lordaeron", className: "PALADIN", observedAt: "2026-09-01T12:00:00Z",
  source: "armory", sourceUrl: "https://armory.warmane.com/character/Lausudo/Lordaeron/summary", raceName: "Human", guildName: "Pizza Warriors",
};
assert.equal(playerIdentityKey(" Lausudo ", " lORDAERON "), "lausudo@lordaeron");
assert.equal(resolvePlayerIdentity(player, [observation]).className, "Paladin");
assert.equal(resolvePlayerIdentity(player, [observation]).classSource, "armory");
const newerRoster = { ...observation, source: "roster" as const, className: "DeathKnight", observedAt: "2026-09-02T12:00:00Z" };
assert.equal(resolvePlayerIdentity(player, [observation, newerRoster]).className, "Death Knight", "Newest validated evidence wins over source preference");
assert.equal(resolvePlayerIdentity(player, [observation, newerRoster]).classSource, "roster");
for (const invalid of [
  { ...observation, characterName: "Someone" },
  { ...observation, realm: "Icecrown" },
  { ...observation, sourceUrl: "https://armory.warmane.com/character/Lausudo/Icecrown/summary" },
  { ...observation, sourceUrl: "https://example.test/character/Lausudo/Lordaeron/summary" },
  { ...observation, observedAt: "not a date" },
  { ...observation, className: "Monk" },
]) assert.equal(resolvePlayerIdentity(player, [invalid]).className, "Mage", "Unusable evidence cannot override log class");
assert.equal(resolvePlayerIdentity(player, [observation, { ...newerRoster, className: "UNKNOWN" }]).className, "Paladin", "A newer missing class cannot erase a healthy observation");
assert.equal(resolvePlayerIdentity(player, [observation, { ...observation, className: "Warrior", source: "roster" }]).className, null, "Same-time contradictory observations remain unknown");
assert.equal(resolvePlayerIdentity({ ...player, class: "unknown" }, []).classSource, "unknown");
assert.equal(isMatchingArmorySource(observation.sourceUrl, "Lausudo", "Lordaeron"), true);
assert.equal(isMatchingArmorySource("https://user@armory.warmane.com/character/Lausudo/Lordaeron/summary", "Lausudo", "Lordaeron"), false);
console.log("player identity tests passed");
