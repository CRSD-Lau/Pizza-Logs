import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatBytes, formatCompactNumber, formatCountLabel, formatDateTimeRangeUtc,
  formatDateTimeUtc, formatDateUtc, formatDecimal, formatDps, formatDuration, formatDurationPrecise,
  formatInteger, formatNumber, formatPercent, formatRate, formatSeconds, formatTimeUtc,
  getRecordedDurationSeconds,
} from "../lib/utils";

test("metrics consistently use two decimals and K/M while discrete counts stay whole", () => {
  assert.equal(formatInteger(40_960_709), "40,960,709");
  for (const format of [formatNumber, formatDps, formatRate, formatCompactNumber]) {
    assert.equal(format(13_931.25), "13.93K");
    assert.equal(format(4_200_000), "4.20M");
    assert.equal(format(1_234_567_890), "1,234.57M");
    assert.equal(format(58), "58.00");
    assert.equal(format(999.96), "999.96");
    assert.equal(format(-1240.75), "-1.24K");
    assert.equal(format(-0), "0.00");
  }
  assert.equal(formatInteger(-0), "0");
  assert.equal(formatDecimal(1234.5), "1,234.50");
});

test("zero, small contributions and unavailable evidence remain distinct", () => {
  for (const format of [formatInteger, formatDecimal, formatNumber, formatRate, formatPercent, formatCompactNumber]) {
    for (const invalid of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(format(invalid), "-");
  }
  assert.equal(formatPercent(0), "0.00%");
  assert.equal(formatPercent(0.0001), "<0.01%");
  assert.equal(formatPercent(0.009), "<0.01%");
  assert.equal(formatPercent(0.01), "0.01%");
  assert.equal(formatPercent(0.099), "0.10%");
  assert.equal(formatPercent(7.26), "7.26%");
  assert.equal(formatPercent(100), "100.00%");
  assert.equal(formatPercent(1234.5), "1,234.50%");
  assert.equal(formatRate(0.003), "<0.01");
  assert.equal(formatRate(-0.003), ">-0.01");
  assert.equal(formatSeconds(0), "0.00 s");
  assert.equal(formatSeconds(1234.5), "1,234.50 s");
  assert.equal(formatSeconds(null), "-");
});

test("rounding promotes K/M boundaries and preserves grouped millions", () => {
  assert.equal(formatCompactNumber(999.994), "999.99");
  assert.equal(formatCompactNumber(999.995), "1.00K");
  assert.equal(formatCompactNumber(1000), "1.00K");
  assert.equal(formatCompactNumber(999_994), "999.99K");
  assert.equal(formatCompactNumber(999_995), "1.00M");
  assert.equal(formatCompactNumber(999_999), "1.00M");
  assert.equal(formatCompactNumber(1_000_000), "1.00M");
  assert.equal(formatCompactNumber(1_000_000_000), "1,000.00M");
  assert.equal(formatCompactNumber(-999_999), "-1.00M");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1023), "1,023 B");
  assert.equal(formatBytes(1024), "1.00 KiB");
  assert.equal(formatBytes(1536), "1.50 KiB");
  assert.equal(formatBytes(1024 ** 2 - 1), "1.00 MiB");
  assert.equal(formatBytes(1024 ** 3), "1.00 GiB");
  assert.equal(formatBytes(-1), "-");
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
    assert.equal(formatDateUtc(badDate), "-");
    assert.equal(formatDateTimeUtc(badDate), "-");
  }
});

test("elapsed time supports hours and does not invent a valid rate denominator", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(59.999), "0:59");
  assert.equal(formatDuration(3600), "1:00:00");
  assert.equal(formatDuration(7503), "2:05:03");
  assert.equal(formatDurationPrecise(3_599_999.6), "1:00:00.000");
  assert.equal(formatDuration(null), "-");
  assert.equal(formatDuration(Infinity), "-");
  assert.equal(getRecordedDurationSeconds({ durationMs: 1244.96, durationSeconds: 1 }), 1.24496);
  assert.equal(getRecordedDurationSeconds({ durationMs: 0, durationSeconds: 20 }), 20);
  assert.equal(getRecordedDurationSeconds({ durationSeconds: 20 }), 20);
  assert.equal(getRecordedDurationSeconds({ durationMs: -1, durationSeconds: 20 }), null);
  assert.equal(getRecordedDurationSeconds({ durationMs: NaN, durationSeconds: 20 }), null);
  assert.equal(getRecordedDurationSeconds({ durationMs: 0, durationSeconds: 0 }), null);
  assert.equal(getRecordedDurationSeconds({}), null);
});
