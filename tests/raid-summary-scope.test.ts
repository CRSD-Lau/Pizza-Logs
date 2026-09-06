import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRaidSummaryQuery, parseRaidSummaryScope } from "../lib/raid-summary-scope";

test("only the explicit kills query value selects successful fights", () => {
  assert.equal(parseRaidSummaryScope("kills"), "kills");
  for (const value of [undefined, null, "", "all", "KILL", "KILLS", " kills", "kills ", true, 1,
    [], ["kills"], ["kills", "all"], { scope: "kills" }, "kills&includeShortPulls=1", "?scope=kills"]) {
    assert.equal(parseRaidSummaryScope(value), "all");
  }
});

test("summary links omit the default scope and preserve the short-pull count toggle", () => {
  assert.equal(buildRaidSummaryQuery("all", false), "");
  assert.equal(buildRaidSummaryQuery("kills", false), "?scope=kills");
  assert.equal(buildRaidSummaryQuery("all", true), "?includeShortPulls=1");
  assert.equal(buildRaidSummaryQuery("kills", true), "?scope=kills&includeShortPulls=1");
});

test("malformed and repeated scope input becomes a canonical default link", () => {
  for (const value of [["kills"], ["kills", "all"], "kills&redirect=https://example.com", "<script>", "%6bills"]) {
    const scope = parseRaidSummaryScope(value);
    assert.equal(buildRaidSummaryQuery(scope, false), "");
    assert.equal(buildRaidSummaryQuery(scope, true), "?includeShortPulls=1");
  }
});
