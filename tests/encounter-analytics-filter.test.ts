import assert from "node:assert/strict";
import {
  filterEncounterAnalyticsRows,
  getContextualEncounterAnalyticsFilterOptions,
  getEncounterAnalyticsFilterOptions,
  type EncounterAnalyticsFilterRow,
} from "../lib/encounter-analytics-filter";

const rows: EncounterAnalyticsFilterRow[] = [
  {
    id: "lausudo-sacred-shield",
    player: "Lausudo",
    ability: "Sacred Shield",
    value: "96.2%",
    occurrences: "8 applications",
  },
  {
    id: "shadowcake-slice-and-dice",
    player: "Shadowcake",
    ability: "Slice and Dice",
    value: "91.4%",
    occurrences: "12 applications",
  },
  {
    id: "lausudo-spiritual-attunement",
    player: "Lausudo",
    ability: "Spiritual Attunement",
    value: "37.5K",
    occurrences: "160 events",
  },
  {
    id: "aerie-sacred-shield",
    player: "Aérie",
    ability: "Sacred Shield",
    value: "44.0%",
    occurrences: "3 applications",
  },
];

assert.deepEqual(
  getEncounterAnalyticsFilterOptions(rows, "player"),
  ["Aérie", "Lausudo", "Shadowcake"],
  "suggestions are unique and alphabetized",
);

assert.deepEqual(
  getContextualEncounterAnalyticsFilterOptions(rows, "ability", "Lausudo"),
  ["Sacred Shield", "Spiritual Attunement"],
  "player selection narrows ability suggestions",
);
assert.deepEqual(
  getContextualEncounterAnalyticsFilterOptions(rows, "player", "Sacred Shield"),
  ["Aérie", "Lausudo"],
  "ability selection narrows player suggestions",
);

const empty = filterEncounterAnalyticsRows(rows, "", "");
assert.deepEqual(empty.rows, rows, "empty filters preserve the original sort order");
assert.equal(empty.playerValid, true);
assert.equal(empty.abilityValid, true);
assert.equal(empty.combinationValid, true);

const normalized = filterEncounterAnalyticsRows(rows, "  LAUSUDO ", "shield");
assert.deepEqual(normalized.rows.map(row => row.id), ["lausudo-sacred-shield"]);
assert.equal(normalized.playerValid, true);
assert.equal(normalized.abilityValid, true);

const accentInsensitive = filterEncounterAnalyticsRows(rows, "aerie", "sacred");
assert.deepEqual(accentInsensitive.rows.map(row => row.id), ["aerie-sacred-shield"]);

const invalidPlayer = filterEncounterAnalyticsRows(rows, "Lausdoo", "shield");
assert.equal(invalidPlayer.playerValid, false);
assert.equal(invalidPlayer.rows.length, 0);

const invalidAbility = filterEncounterAnalyticsRows(rows, "Lausudo", "Divine Plea");
assert.equal(invalidAbility.abilityValid, false);
assert.equal(invalidAbility.rows.length, 0);

const emptyCombination = filterEncounterAnalyticsRows(rows, "Shadowcake", "Sacred Shield");
assert.equal(emptyCombination.playerValid, true);
assert.equal(emptyCombination.abilityValid, true);
assert.equal(emptyCombination.combinationValid, false);
assert.equal(emptyCombination.rows.length, 0);

console.log("encounter analytics filter tests passed");
