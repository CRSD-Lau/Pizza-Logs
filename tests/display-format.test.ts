import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatBytes, formatCompactNumber, formatCountLabel, formatDateTimeRangeUtc,
  formatDateTimeUtc, formatDateUtc, formatDps, formatDuration, formatDurationPrecise,
  formatInteger, formatNumber, formatPercent, formatRate, formatSeconds, formatTimeUtc,
  getRecordedDurationSeconds,
} from "../lib/utils";

test("comparison numbers use the same precision regardless of magnitude", () => {
  assert.equal(formatInteger(40_960_709), "40,960,709");
  assert.equal(formatNumber(999_999), "999,999");
  assert.equal(formatRate(13_931.25), "13,931.3");
  assert.equal(formatDps(13_931.25), "13,931.3");
  assert.equal(formatRate(58), "58");
  assert.equal(formatRate(999.96), "1,000");
  assert.equal(formatRate(-1240.75), "-1,240.8");
  assert.equal(formatInteger(-0), "0");
  assert.equal(formatRate(-0), "0");
});

test("zero, small contributions and unavailable evidence remain distinct", () => {
  for (const format of [formatInteger, formatRate, formatPercent, formatCompactNumber]) {
    for (const invalid of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(format(invalid), "—");
  }
  assert.equal(formatPercent(0), "0%");
  assert.equal(formatPercent(0.0001), "<0.1%");
  assert.equal(formatPercent(0.099), "<0.1%");
  assert.equal(formatPercent(0.1), "0.1%");
  assert.equal(formatPercent(7.26), "7.3%");
  assert.equal(formatPercent(100), "100%");
  assert.equal(formatRate(0.003), "<0.1");
  assert.equal(formatRate(-0.003), ">-0.1");
  assert.equal(formatSeconds(0), "0 s");
  assert.equal(formatSeconds(null), "—");
});

test("compact axes and binary file sizes roll over without misleading suffixes", () => {
  assert.equal(formatCompactNumber(999_999), "1M");
  assert.equal(formatCompactNumber(1_000_000_000), "1B");
  assert.equal(formatCompactNumber(-999_999), "-1M");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1023), "1,023 B");
  assert.equal(formatBytes(1024), "1 KiB");
  assert.equal(formatBytes(1536), "1.5 KiB");
  assert.equal(formatBytes(1024 ** 2 - 1), "1 MiB");
  assert.equal(formatBytes(1024 ** 3), "1 GiB");
  assert.equal(formatBytes(-1), "—");
  assert.equal(formatCountLabel(1, "application"), "1 application");
  assert.equal(formatCountLabel(1234, "application"), "1,234 applications");
  assert.equal(formatCountLabel(0, "entry", "entries"), "0 entries");
});

test("UTC dates, years and midnight crossings are explicit", () => {
  const beforeMidnight = "2026-12-31T23:59:59.000Z";
  const afterMidnight = "2027-01-01T00:04:00.000Z";
  assert.equal(formatDateUtc(beforeMidnight), "Dec 31, 2026");
  assert.equal(formatDateTimeUtc(beforeMidnight), "Dec 31, 2026, 23:59:59 UTC");
  assert.equal(formatTimeUtc(afterMidnight), "00:04 UTC");
  assert.equal(formatDateTimeRangeUtc(beforeMidnight, afterMidnight), "Dec 31, 2026, 23:59 – Jan 1, 2027, 00:04 UTC");
  assert.equal(formatDateTimeRangeUtc("2027-01-01T00:04:00Z", "2027-01-01T01:30:00Z"), "Jan 1, 2027, 00:04 – 01:30 UTC");
  for (const badDate of ["", "invalid", null, undefined]) {
    assert.equal(formatDateUtc(badDate), "—");
    assert.equal(formatDateTimeUtc(badDate), "—");
  }
});

test("elapsed time supports hours and does not invent a valid rate denominator", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(59.999), "0:59");
  assert.equal(formatDuration(3600), "1:00:00");
  assert.equal(formatDuration(7503), "2:05:03");
  assert.equal(formatDurationPrecise(3_599_999.6), "1:00:00.000");
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(Infinity), "—");
  assert.equal(getRecordedDurationSeconds({ durationMs: 1244.96, durationSeconds: 1 }), 1.24496);
  assert.equal(getRecordedDurationSeconds({ durationMs: 0, durationSeconds: 20 }), 20);
  assert.equal(getRecordedDurationSeconds({ durationSeconds: 20 }), 20);
  assert.equal(getRecordedDurationSeconds({ durationMs: -1, durationSeconds: 20 }), null);
  assert.equal(getRecordedDurationSeconds({ durationMs: NaN, durationSeconds: 20 }), null);
  assert.equal(getRecordedDurationSeconds({ durationMs: 0, durationSeconds: 0 }), null);
  assert.equal(getRecordedDurationSeconds({}), null);
});
