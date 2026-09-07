import assert from "node:assert/strict";
import { test } from "node:test";
import { getReportDamageTakenPerSecond, getReportMetricView, getReportRoleLabel, parseShowAllMetrics } from "../lib/report-metric-view";

test("metric defaults use consistent recorded roles and unambiguous short or full specs", () => {
  assert.equal(getReportMetricView([{ role: "DPS", spec: "Combat Rogue" }]), "damage");
  assert.equal(getReportMetricView([{ role: "DPS", spec: null }]), "damage");
  assert.equal(getReportMetricView([{ role: "HEALER", spec: "Discipline" }]), "healing");
  assert.equal(getReportMetricView([{ role: "UNKNOWN", spec: "Restoration Druid" }, { spec: "Holy" }]), "healing");
  assert.equal(getReportMetricView([{ role: "UNKNOWN", spec: "Combat" }]), "damage");
  assert.equal(getReportMetricView([{ spec: "Protection Warrior" }, { spec: "Protection" }]), "tank");
  assert.equal(getReportMetricView([{ role: "tank", spec: "Feral Druid" }]), "tank");
  assert.equal(getReportMetricView([{ role: "DPS", spec: "Blood Death Knight" }]), "damage");
});

test("mixed, missing, ambiguous and contradictory evidence keeps every metric available", () => {
  for (const evidence of [[], [{}], [{ role: "UNKNOWN" }], [{ role: "DPS" }, {}],
    [{ role: "DPS", spec: "Combat" }, { role: "HEALER", spec: "Restoration" }],
    [{ role: "DPS", spec: "Holy Paladin" }], [{ spec: "Frost" }], [{ spec: "Blood" }],
    [{ spec: "Feral Druid" }], [{ spec: "Frost Death Knight" }], [{ spec: "Unholy Death Knight" }],
    [{ spec: "__proto__" }], [{ spec: "constructor" }],
  ]) assert.equal(getReportMetricView(evidence), "all");
  assert.equal(getReportRoleLabel({ role: "UNKNOWN", spec: "Holy Paladin" }), "Unknown", "Do not relabel the recorded role from a default-view inference");
});

test("Show all metrics only uses the explicit first URL value", () => {
  assert.equal(parseShowAllMetrics("all"), true);
  assert.equal(parseShowAllMetrics(["all", "relevant"]), true);
  assert.equal(parseShowAllMetrics(["relevant", "all"]), false);
  for (const value of [undefined, "", "ALL", "true", "1"]) assert.equal(parseShowAllMetrics(value), false);
});

test("DTPS requires valid recorded duration and preserves zero damage taken", () => {
  assert.equal(getReportDamageTakenPerSecond(0, { durationMs: 2000 }), 0);
  assert.equal(getReportDamageTakenPerSecond(300, { durationMs: 1500, durationSeconds: 2 }), 200);
  assert.equal(getReportDamageTakenPerSecond(300, { durationMs: 0, durationSeconds: 3 }), 100);
  for (const duration of [{}, { durationMs: 0, durationSeconds: 0 }, { durationMs: -1, durationSeconds: 3 }, { durationMs: NaN }]) {
    assert.equal(getReportDamageTakenPerSecond(300, duration), null);
  }
  assert.equal(getReportDamageTakenPerSecond(null, { durationSeconds: 3 }), null);
  assert.equal(getReportDamageTakenPerSecond(-1, { durationSeconds: 3 }), null);
});
