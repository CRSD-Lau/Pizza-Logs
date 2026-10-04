import assert from "node:assert/strict";
import test from "node:test";
import { findRaidSessionAnalytics } from "../lib/raid-session-analytics";
import {
  buildRaidSessionRoutes,
  buildRaidSessionRoutesWithAnalytics,
  formatRaidDateLabel,
  formatRaidSessionTitle,
  getRaidSessionPath,
  resolveRaidSessionParam,
} from "../lib/raid-session-slug";

test("builds stable ISO date slugs from each session start", () => {
  const routes = buildRaidSessionRoutes([
    { sessionIndex: 1, startedAt: "2026-08-15T01:00:00.000Z" },
    { sessionIndex: 0, startedAt: "2026-08-14T23:00:00.000Z" },
    { sessionIndex: 0, startedAt: "2026-08-14T22:00:00.000Z" },
  ]);

  assert.deepEqual(
    routes.map(route => ({
      sessionIndex: route.sessionIndex,
      startedAt: route.startedAt.toISOString(),
      slug: route.slug,
      dateOrdinal: route.dateOrdinal,
    })),
    [
      {
        sessionIndex: 0,
        startedAt: "2026-08-14T22:00:00.000Z",
        slug: "2026-08-14",
        dateOrdinal: 1,
      },
      {
        sessionIndex: 1,
        startedAt: "2026-08-15T01:00:00.000Z",
        slug: "2026-08-15",
        dateOrdinal: 1,
      },
    ],
  );
});

test("disambiguates multiple sessions on the same date without changing the first slug", () => {
  const routes = buildRaidSessionRoutes([
    { sessionIndex: 0, startedAt: new Date("2026-08-14T02:00:00.000Z") },
    { sessionIndex: 1, startedAt: new Date("2026-08-14T18:00:00.000Z") },
    { sessionIndex: 2, startedAt: new Date("2026-08-15T00:30:00.000Z") },
  ]);

  assert.deepEqual(routes.map(route => route.slug), [
    "2026-08-14",
    "2026-08-14-2",
    "2026-08-15",
  ]);
  assert.equal(formatRaidSessionTitle(routes[0]), "August 14, 2026 Raid");
  assert.equal(formatRaidSessionTitle(routes[1]), "August 14, 2026 Raid 2");
});

test("uses the full raid start from stored session analytics when it predates the first pull", () => {
  const routes = buildRaidSessionRoutesWithAnalytics(
    [{ sessionIndex: 0, startedAt: "2026-08-15T00:05:00.000Z" }],
    {
      0: { startedAt: "2026-08-14T23:00:00.000Z", endedAt: "2026-08-15T01:00:00.000Z" },
      1: { startedAt: "2026-08-13T23:00:00.000Z" },
    },
  );

  assert.equal(routes.length, 1, "analytics without encounters cannot create a public raid route");
  assert.equal(routes[0].startedAt.toISOString(), "2026-08-14T23:00:00.000Z");
  assert.equal(routes[0].slug, "2026-08-14");
});

test("resolves canonical slugs and strict legacy numeric indexes", () => {
  const routes = buildRaidSessionRoutes([
    { sessionIndex: 0, startedAt: "2026-08-14T23:00:00.000Z" },
    { sessionIndex: 1, startedAt: "2026-08-15T23:00:00.000Z" },
  ]);

  assert.deepEqual(resolveRaidSessionParam("0", routes), {
    route: routes[0],
    isLegacyIndex: true,
  });
  assert.deepEqual(resolveRaidSessionParam("2026-08-15", routes), {
    route: routes[1],
    isLegacyIndex: false,
  });
  assert.equal(resolveRaidSessionParam("2026-08-16", routes), null);
  assert.equal(resolveRaidSessionParam("0-extra", routes), null);
});

test("formats canonical public paths and dates deterministically in UTC", () => {
  const [route] = buildRaidSessionRoutes([
    { sessionIndex: 0, startedAt: "2026-08-14T23:00:00.000Z" },
  ]);

  assert.equal(formatRaidDateLabel(route.startedAt), "August 14, 2026");
  assert.equal(
    getRaidSessionPath("pizza-warriors-7k2m9x4", route),
    "/raids/pizza-warriors-7k2m9x4/sessions/2026-08-14",
  );
});

const octoberFights = [
  { sessionIndex: 0, startedAt: "2026-10-02T23:10:04.450Z" },
  { sessionIndex: 0, startedAt: "2026-10-03T01:49:54.000Z" },
];
const appendedLogAnalytics = {
  0: { startedAt: "2026-09-26T16:42:31.271Z", endedAt: "2026-09-26T16:43:37.776Z", totalDamage: 0 },
  1: { startedAt: "2026-09-26T18:49:05.360Z", endedAt: "2026-09-26T18:49:40.755Z", totalDamage: 0 },
  2: { startedAt: "2026-10-02T22:45:22.738Z", endedAt: "2026-10-03T02:07:16.801Z", totalDamage: 123456 },
};

test("an appended log uses the raid event window, not an earlier nonraid session", () => {
  const [route] = buildRaidSessionRoutesWithAnalytics(octoberFights, appendedLogAnalytics);
  assert.equal(route.startedAt.toISOString(), "2026-10-02T22:45:22.738Z");
  assert.equal(route.slug, "2026-10-02");
  assert.equal(route.legacySlug, "2026-09-26");
  assert.equal(route.analyticsIndex, "2");
  assert.equal(findRaidSessionAnalytics(octoberFights, appendedLogAnalytics, 0), appendedLogAnalytics[2]);
  assert.deepEqual(resolveRaidSessionParam("2026-09-26", [route]), {
    route, isLegacyIndex: false, isLegacyDateSlug: true,
  });
});

test("missing, invalid, partial, or overlapping analytics fall back to the first recorded fight", () => {
  for (const analytics of [
    {},
    { 0: appendedLogAnalytics[0] },
    { 0: { startedAt: "invalid", endedAt: "2026-10-03T03:00:00Z" } },
    { 0: { startedAt: "2026-10-02T22:45:00Z" } },
    { 0: { startedAt: "2026-10-02T22:45:00Z", endedAt: "2026-10-02T23:30:00Z" } },
    { 0: appendedLogAnalytics[2], 1: appendedLogAnalytics[2] },
  ]) {
    const [route] = buildRaidSessionRoutesWithAnalytics(octoberFights, analytics);
    assert.equal(route.startedAt.toISOString(), octoberFights[0].startedAt);
    assert.equal(findRaidSessionAnalytics<unknown>(octoberFights, analytics, 0), undefined);
  }
});

test("correctly indexed sessions retain their pre-pull start and distinct same-day routes", () => {
  const starts = [
    { sessionIndex: 1, startedAt: "2026-10-03T01:00:00Z" },
    { sessionIndex: 3, startedAt: "2026-10-03T21:00:00Z" },
  ];
  const analytics = {
    1: { startedAt: "2026-10-03T00:30:00Z", endedAt: "2026-10-03T02:00:00Z" },
    2: { startedAt: "2026-10-03T16:00:00Z", endedAt: "2026-10-03T16:01:00Z" },
    3: { startedAt: "2026-10-03T20:30:00Z", endedAt: "2026-10-03T22:00:00Z" },
  };
  const routes = buildRaidSessionRoutesWithAnalytics(starts, analytics);
  assert.deepEqual(routes.map(route => route.slug), ["2026-10-03", "2026-10-03-2"]);
  assert.equal(routes[0].startedAt.toISOString(), "2026-10-03T00:30:00.000Z");
  assert.equal(routes[1].startedAt.toISOString(), "2026-10-03T20:30:00.000Z");
  assert.ok(routes.every(route => route.legacySlug === undefined));
});

test("canonical date links take precedence over historical aliases", () => {
  const routes = buildRaidSessionRoutes([
    { sessionIndex: 0, startedAt: "2026-10-02T20:00:00Z" },
    { sessionIndex: 1, startedAt: "2026-10-03T20:00:00Z" },
  ]);
  routes[1].legacySlug = routes[0].slug;
  assert.equal(resolveRaidSessionParam(routes[0].slug, routes)?.route.sessionIndex, 0);
});

test("historical encounter groups cannot each claim the same full-session totals", () => {
  const starts = [
    { sessionIndex: 0, startedAt: "2026-10-03T10:00:00Z" },
    { sessionIndex: 1, startedAt: "2026-10-03T12:00:00Z" },
  ];
  const analytics = {
    0: { startedAt: "2026-10-03T09:30:00Z", endedAt: "2026-10-03T13:00:00Z" },
  };
  const routes = buildRaidSessionRoutesWithAnalytics(starts, analytics);
  for (const route of routes) {
    assert.equal(route.analyticsIndex, undefined);
    assert.equal(findRaidSessionAnalytics(starts, analytics, route.sessionIndex), undefined);
    assert.equal(route.startedAt.getTime(), new Date(starts[route.sessionIndex].startedAt).getTime());
  }
});
