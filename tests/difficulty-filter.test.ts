import assert from "node:assert/strict";
import { difficultyFilterWhere, difficultyScopeLabel, parseDifficultyFilter, reportQueryString } from "../lib/difficulty-filter";

for (const mode of ["10N", "10H", "25N", "25H", "UNKNOWN"] as const) {
  assert.equal(parseDifficultyFilter(mode), mode);
  assert.deepEqual(difficultyFilterWhere(mode), { difficulty: mode });
}
for (const value of [undefined, "", "all", "10", "25h", "retail", "25H OR true"]) {
  assert.equal(parseDifficultyFilter(value), "all");
}
assert.equal(parseDifficultyFilter(["10N", "25H"]), "10N");
assert.deepEqual(difficultyFilterWhere("all"), {}, "The default must preserve the existing pooled query");
assert.equal(difficultyScopeLabel("all"), "All difficulties pooled");
assert.match(difficultyScopeLabel("25H"), /25-player heroic/);
assert.match(difficultyScopeLabel("UNKNOWN"), /Unknown difficulty/);

const query = new URLSearchParams(reportQueryString({ difficulty: ["10N", "25H"], includeShortPulls: "1", boss: "lord-marrowgar", tag: ["one", "two"] }, { difficulty: "25H", boss: null }));
assert.deepEqual(query.getAll("difficulty"), ["25H"]);
assert.equal(query.get("includeShortPulls"), "1");
assert.deepEqual(query.getAll("tag"), ["one", "two"]);
assert.equal(query.has("boss"), false);
assert.equal(reportQueryString({ difficulty: "25H" }, { difficulty: null }), "");
console.log("difficulty-filter tests passed");
