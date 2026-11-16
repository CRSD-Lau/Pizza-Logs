import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { computeMilestones } from "../lib/actions/milestones";

type Check = Parameters<typeof computeMilestones>[0][number];
type Database = NonNullable<Parameters<typeof computeMilestones>[1]>;
const now = new Date("2026-09-04T12:00:00Z");
const candidate = (index: number): Check => ({
  playerId: `player-${index}`, playerName: `Player${index}`, encounterId: `encounter-${index}`,
  bossId: "boss", bossName: "Boss", difficulty: "25N", metric: "DPS", value: 1000,
  startedAt: new Date("2026-08-20T10:00:00Z"),
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function deadline(promise: Promise<unknown>) {
  let timer!: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Workers did not start concurrently")), 1000);
    })]);
  } finally { clearTimeout(timer); }
}
function database(hooks: {
  before?: () => Promise<void>;
  candidate?: (playerId: string, value: number) => void;
  after?: (playerId?: string) => void;
}): Database {
  return {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      let playerId: string | undefined;
      try {
        await hooks.before?.();
        return await work({
          participant: {
            findFirst: async ({ where }: { where: { playerId?: string; dps?: { gt: number } } }) => {
              if (!playerId && where.playerId) {
                playerId = where.playerId;
                hooks.candidate?.(playerId, where.dps!.gt);
              }
              return null;
            },
            groupBy: async () => [],
          },
          milestone: { findFirst: async () => null, create: async () => ({ id: "award" }) },
        });
      } finally { hooks.after?.(playerId); }
    },
  } as unknown as Database;
}

test("milestone concurrency is bounded across uploads and results preserve candidate order", async () => {
  const gate = deferred();
  const started = deferred();
  let active = 0, peak = 0, entered = 0;
  const db = database({
    before: async () => {
      active++; entered++; peak = Math.max(peak, active);
      if (active === 4) started.resolve();
      await gate.promise;
    },
    after: () => { active--; },
  });
  const first = Array.from({ length: 6 }, (_, index) => candidate(index));
  const second = Array.from({ length: 6 }, (_, index) => candidate(index + 10));
  const pending = Promise.all([computeMilestones(first, db, now), computeMilestones(second, db, now)]);
  try {
    await deadline(started.promise);
    assert.equal(active, 4);
    assert.equal(entered, 4);
  } finally { gate.resolve(); }
  const awards = await pending;
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.deepEqual(awards.map(batch => batch.map(award => award.playerName)),
    [first, second].map(batch => batch.map(check => check.playerName)));
});

test("historical and weekly candidates for the same award key stay sequential", async () => {
  const active = new Set<string>();
  const values: number[] = [];
  const db = database({
    before: async () => { await setImmediate(); },
    candidate: (playerId, value) => {
      assert.ok(!active.has(playerId), "Same award key must not overlap");
      active.add(playerId);
      if (playerId === "player-0") values.push(value);
    },
    after: playerId => { if (playerId) active.delete(playerId); },
  });
  const old = { ...candidate(0), value: 5000 };
  const week = { ...candidate(0), encounterId: "weekly", value: 3000, startedAt: new Date("2026-09-03T10:00:00Z") };
  await computeMilestones([old, week, candidate(1), candidate(2), candidate(3)], db, now);
  assert.deepEqual(values, [5000, 3000]);
  assert.equal(active.size, 0);
});

test("milestone failure stops queued candidates and drains active transactions before returning", async () => {
  const fail = deferred(), drain = deferred(), started = deferred();
  const error = new Error("Synthetic transaction failure");
  let entered = 0, active = 0, settled = false;
  const db = database({
    before: async () => {
      const index = entered++;
      active++;
      if (entered === 4) started.resolve();
      await (index === 0 ? fail.promise : drain.promise);
      if (index === 0) throw error;
    },
    after: () => { active--; },
  });
  const pending = computeMilestones(Array.from({ length: 12 }, (_, index) => candidate(index)), db, now);
  void pending.then(() => { settled = true; }, () => { settled = true; });
  const rejected = assert.rejects(pending, error);
  try {
    await deadline(started.promise);
    fail.resolve();
    await setImmediate();
    assert.equal(settled, false);
  } finally { fail.resolve(); drain.resolve(); }
  await rejected;
  assert.equal(entered, 4);
  assert.equal(active, 0);
});

test("pg adapter commit conflicts retry the transaction with a bounded attempt count", async () => {
  const conflict = new Error("Synthetic commit conflict", { cause: { kind: "TransactionWriteConflict", originalCode: "40001" } });
  conflict.name = "DriverAdapterError";
  let attempts = 0;
  const succeeds = { $transaction: async () => { if (++attempts < 3) throw conflict; return []; } } as unknown as Database;
  assert.deepEqual(await computeMilestones([candidate(0)], succeeds, now), []);
  assert.equal(attempts, 3);
  attempts = 0;
  const fails = { $transaction: async () => { attempts++; throw conflict; } } as unknown as Database;
  await assert.rejects(computeMilestones([candidate(0)], fails, now), conflict);
  assert.equal(attempts, 6);
});
