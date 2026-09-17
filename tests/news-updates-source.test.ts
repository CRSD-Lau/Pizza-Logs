import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/upload/NewsUpdates.tsx", "utf8");

test("homepage announces the Lich King attempt segmentation fix", () => {
  assert.match(source, /Lich King attempts now stay together/);
  assert.match(source, /Harvest Souls and Fury of Frostmourne/);
  assert.match(source, /single kill or wipe instead of extra UNKNOWN fragments/);
  assert.match(source, /Affected reports need to be uploaded again/);
});

test("homepage announces the Icecrown parser fix without retaining the active warning", () => {
  assert.match(source, /Icecrown combat logs now show player metrics/);
  assert.match(source, /Affected Icecrown reports need to be uploaded again/);
  assert.doesNotMatch(source, /Icecrown player metrics may show zero/);
  assert.doesNotMatch(source, /Active warning/);
});
