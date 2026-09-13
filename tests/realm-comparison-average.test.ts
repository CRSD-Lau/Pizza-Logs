import assert from "node:assert/strict";
import { getAverageLeaderboards } from "../lib/average-leaderboards";

type GroupByQuery = { where: { encounter: { upload?: { realmId: string } } } };
const calls: GroupByQuery[] = [];

const database = {
  participant: {
    groupBy: async (query: GroupByQuery) => {
      calls.push(query);
      return [];
    },
  },
  player: { findMany: async () => [] },
};

async function main() {
  await getAverageLeaderboards(database as never, "all", undefined, "realm-a");
  assert.equal(calls.length, 2, "Both average metrics must use the selected realm scope");
  assert.ok(calls.every(call => call.where.encounter.upload?.realmId === "realm-a"));

  calls.length = 0;
  await getAverageLeaderboards(database as never, "all");
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.where.encounter.upload === undefined), "All realms preserves the pooled query");
  console.log("realm comparison average tests passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
