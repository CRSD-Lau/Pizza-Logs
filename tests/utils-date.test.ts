import assert from "node:assert/strict";
import { formatDuration, formatDurationPrecise, formatShortDateUtc } from "../lib/utils";

// The server and browser must render the same calendar day even when the
// browser is west of UTC and the encounter is close to midnight.
assert.equal(formatShortDateUtc("2026-05-16T00:30:00.000Z"), "May 16, 2026");
assert.equal(formatShortDateUtc(new Date("2026-12-31T23:59:59.000Z")), "Dec 31, 2026");
assert.equal(formatDuration(1244.960000000000036), "20:44");
assert.equal(formatDurationPrecise(2_594_892), "0:43:14.892");

console.log("UTC short-date tests passed");
