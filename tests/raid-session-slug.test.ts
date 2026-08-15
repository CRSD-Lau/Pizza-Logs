import assert from "node:assert/strict";
import test from "node:test";
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
      0: { startedAt: "2026-08-14T23:00:00.000Z" },
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
    getRaidSessionPath("upload-123", route),
    "/raids/upload-123/sessions/2026-08-14",
  );
});
