import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDirectoryHref, directoryNameMatches, getDirectoryPagination, parseDirectoryFilters, parseDirectoryPage } from "../lib/directory-pagination";

test("directory filters normalize names and canonical class values", () => {
  assert.deepEqual(parseDirectoryFilters({ q: ["  Synthetic   Player  ", "ignored"], class: "rogue" }), { query: "Synthetic Player", classFilter: "Rogue" });
  assert.deepEqual(parseDirectoryFilters({ class: "not-a-class" }), { query: "", classFilter: undefined });
  assert.equal(parseDirectoryFilters({ q: "x".repeat(100) }).query.length, 64);
  assert.equal(directoryNameMatches("SyntheticPlayer", "THETICp"), true);
  assert.equal(directoryNameMatches("SyntheticPlayer", "other"), false);
});

test("pagination rejects malformed values and clamps after filtering", () => {
  for (const value of [undefined, "0", "-1", "1.5", "2extra", "1e2", "Infinity", "9007199254740992"]) assert.equal(parseDirectoryPage(value), 1);
  assert.equal(parseDirectoryPage(["3", "4"]), 3);
  assert.deepEqual(getDirectoryPagination(0, 100, 20), { currentPage: 1, totalPages: 1, startIndex: 0, firstVisible: 0, lastVisible: 0 });
  assert.deepEqual(getDirectoryPagination(41, 2, 20), { currentPage: 2, totalPages: 3, startIndex: 20, firstVisible: 21, lastVisible: 40 });
  assert.equal(getDirectoryPagination(3, 9, 30).currentPage, 1);
});

test("pagination URLs preserve filters and the short-pull preference", () => {
  const href = buildDirectoryHref("/players", { query: "Name & One", classFilter: "Death Knight", page: 3, includeShortPulls: true });
  const url = new URL(href, "https://example.test");
  assert.equal(url.searchParams.get("q"), "Name & One");
  assert.equal(url.searchParams.get("class"), "Death Knight");
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(url.searchParams.get("includeShortPulls"), "1");
  assert.equal(buildDirectoryHref("/guild-roster", { page: 1 }), "/guild-roster");
  assert.equal(buildDirectoryHref("/raids", { page: 2, includeShortPulls: true }), "/raids?page=2&includeShortPulls=1");
});
