import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getRevealClassName,
  getRevealStyle,
  orderBossDisplayEntries,
} from "../lib/ui-animation";

const root = process.cwd();
const globals = readFileSync(path.join(root, "app", "globals.css"), "utf8");

assert.match(globals, /animation: revealItem 420ms ease-out both/);
assert.match(globals, /var\(--reveal-index, 0\) \* 70ms/);
assert.match(globals, /translateY\(14px\)/);

const revealStyle = getRevealStyle(7);
assert.equal(revealStyle["--reveal-index"], 7);
assert.equal(getRevealStyle(-4)["--reveal-index"], 0);
assert.equal(getRevealStyle(99)["--reveal-index"], 24);

assert.equal(getRevealClassName(), "reveal-item");
assert.equal(getRevealClassName({ boss: true, className: "custom-row" }), "reveal-item boss-reveal-item custom-row");

type TimestampedEncounter = {
  id: string;
  bossName: string;
  startedAt: Date;
};

type BossEncounter = {
  id: string;
  bossName: string;
};

const timestampedEncounters: TimestampedEncounter[] = [
  { id: "rotface", bossName: "Rotface", startedAt: new Date("2026-05-04T01:30:00.000Z") },
  { id: "festergut", bossName: "Festergut", startedAt: new Date("2026-05-04T01:10:00.000Z") },
  { id: "putricide", bossName: "Professor Putricide", startedAt: new Date("2026-05-04T01:50:00.000Z") },
];

assert.deepEqual(
  orderBossDisplayEntries(
    timestampedEncounters,
    (encounter: TimestampedEncounter) => encounter.bossName,
    (encounter: TimestampedEncounter) => encounter.startedAt,
  ).map((encounter: TimestampedEncounter) => encounter.id),
  ["festergut", "rotface", "putricide"],
);

const fallbackEncounters: BossEncounter[] = [
  { id: "rotface", bossName: "Rotface" },
  { id: "festergut", bossName: "Festergut" },
  { id: "putricide", bossName: "Professor Putricide" },
];

assert.deepEqual(
  orderBossDisplayEntries(fallbackEncounters, (encounter: BossEncounter) => encounter.bossName)
    .map((encounter: BossEncounter) => encounter.id),
  ["festergut", "rotface", "putricide"],
);

console.log("ui-animation tests passed");
