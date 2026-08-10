import assert from "node:assert/strict";
import { formatShortDateUtc } from "../lib/utils";

// The server and browser must render the same calendar day even when the
// browser is west of UTC and the encounter is close to midnight.
assert.equal(formatShortDateUtc("2026-05-16T00:30:00.000Z"), "May 16");
assert.equal(formatShortDateUtc(new Date("2026-12-31T23:59:59.000Z")), "Dec 31");

console.log("UTC short-date tests passed");
