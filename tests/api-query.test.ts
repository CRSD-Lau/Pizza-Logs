import assert from "node:assert/strict";
import { EncounterQuerySchema, LeaderboardQuerySchema } from "../lib/api-query";
import { getWeekBounds } from "../lib/utils";

for (const take of ["-1", "0", "1.5", "NaN", "Infinity", "201", "1e2", ""]) {
  assert.equal(EncounterQuerySchema.safeParse({ take }).success, false, take);
}
assert.equal(EncounterQuerySchema.parse({}).take, 50);
assert.equal(EncounterQuerySchema.parse({ take: "200", skip: "10000" }).skip, 10000);
assert.equal(EncounterQuerySchema.safeParse({ skip: "10001" }).success, false);
assert.equal(EncounterQuerySchema.safeParse({ outcome: "invented" }).success, false);
assert.equal(LeaderboardQuerySchema.safeParse({ metric: "totalDamage" }).success, false);
assert.equal(getWeekBounds(new Date("2026-09-02T08:59:59Z")).start.toISOString(), "2026-08-26T09:00:00.000Z");
assert.equal(getWeekBounds(new Date("2026-09-02T09:00:00Z")).start.toISOString(), "2026-09-02T09:00:00.000Z");
