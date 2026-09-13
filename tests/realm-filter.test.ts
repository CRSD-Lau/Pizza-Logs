import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseRealmFilter, realmFilterWhere, encounterRealmWhere, realmScopeLabel, realmBrowseHref, isRealmBrowsePath } from "../lib/realm-filter";
import { RealmFilter } from "../components/reports/RealmFilter";
import { DifficultyFilter } from "../components/reports/DifficultyFilter";
import { PlayerDirectoryFilters } from "../components/players/PlayerDirectoryFilters";
import { LeaderboardBar } from "../components/charts/LeaderboardBar";
import { AverageLeaderboards } from "../components/charts/AverageLeaderboards";

const realms = [{ id: "realm-a", name: "Lordaeron", host: "warmane" }, { id: "realm-b", name: "Lordaeron", host: "example" }];

test("realm queries keep stale selections scoped and distinguish realm hosts", () => {
  for (const value of [undefined, null, "", " ", []]) assert.equal(parseRealmFilter(value), undefined);
  assert.equal(parseRealmFilter([" realm-a ", "realm-b"]), "realm-a");
  assert.equal(parseRealmFilter("missing"), "missing");
  assert.deepEqual(realmFilterWhere(), {});
  assert.deepEqual(realmFilterWhere("missing"), { realmId: "missing" });
  assert.deepEqual(encounterRealmWhere("realm-a"), { upload: { realmId: "realm-a" } });
  assert.equal(realmScopeLabel(realms), "All realms");
  assert.equal(realmScopeLabel(realms, "realm-b"), "Lordaeron · example");
  assert.equal(realmScopeLabel(realms, "missing"), "Unavailable realm");
  assert.equal(realmBrowseHref("/raids", "a&b"), "/raids?realmId=a%26b");
  assert.ok(isRealmBrowsePath("/bosses/lord-marrowgar"));
  assert.ok(!isRealmBrowsePath("/guild-roster"));
  assert.ok(!isRealmBrowsePath("/players-other"));
});

test("record and average leaderboard links identify the stored realm", () => {
  const entry = { playerName: "Sharedname", realmId: "realm-b", class: "Mage", value: 2000 };
  const records = renderToStaticMarkup(React.createElement(LeaderboardBar, {
    metric: "dps", entries: [{ ...entry, rank: 1, bossName: "Lord Marrowgar", bossSlug: "lord-marrowgar", difficulty: "25H", encounterId: "fight", date: "2026-09-09T10:00:00Z" }],
  }));
  assert.match(records, /href="\/players\/Sharedname\?realmId=realm-b"/);
  const averages = renderToStaticMarkup(React.createElement(AverageLeaderboards, {
    dps: [{ ...entry, playerId: "player-b", realm: "Lordaeron", fights: 10 }], hps: [],
  }));
  assert.match(averages, /href="\/players\/Sharedname\?realm=Lordaeron&amp;realmId=realm-b"/);
});

test("realm forms preserve other filters, reset pagination and retain unknown selection", () => {
  const markup = renderToStaticMarkup(React.createElement(RealmFilter, {
    action: "/raids", id: "raids", realms, realmId: "missing",
    searchParams: { realmId: "missing", page: "4", includeShortPulls: "1" },
  }));
  assert.match(markup, /<option value="missing" selected="">Unavailable realm/);
  assert.match(markup, /Lordaeron · warmane/);
  assert.match(markup, /Lordaeron · example/);
  assert.match(markup, /name="includeShortPulls" value="1"/);
  assert.doesNotMatch(markup, /name="page"/);
  assert.equal((markup.match(/name="realmId"/g) ?? []).length, 1);
  const comparisons = renderToStaticMarkup(React.createElement(DifficultyFilter, {
    action: "/bosses", id: "bosses", realms, realmId: "realm-a", difficulty: "25H",
    searchParams: { realmId: "realm-a", difficulty: "25H", page: "3", includeShortPulls: "1" },
  }));
  assert.equal((comparisons.match(/name="realmId"/g) ?? []).length, 1);
  assert.doesNotMatch(comparisons, /name="page"/);
  assert.match(comparisons, /<option value="25H" selected="">/);
  const players = renderToStaticMarkup(React.createElement(PlayerDirectoryFilters, {
    query: "Lau", classFilter: "Paladin", includeShortPulls: true, realms, realmId: "realm-a",
  }));
  assert.match(players, /name="realmId"/);
  for (const [, href] of players.matchAll(/<a[^>]*href="([^\"]+)"/g)) {
    assert.match(href, /realmId=realm-a/, "Every class/reset link retains the realm");
  }
});
