import assert from "node:assert/strict";
import { test } from "node:test";
import { ParseResultSchema } from "../lib/schema";
import { parserPayload } from "./helpers/parser-payload";
import { MAX_UPLOAD_BYTES } from "../lib/upload-security";

test("parser contract accepts fractional durations and explicit unknown provenance", () => {
  const payload = parserPayload();
  assert.equal(payload.encounters[0].durationSeconds, 30.125);
  assert.equal(payload.provenance?.referenceSha, null);
  delete payload.provenance;
  assert.equal(ParseResultSchema.parse(payload).provenance, undefined);
});

test("parser contract rejects malformed persistence primitives before database work", () => {
  const changes: ((data: ReturnType<typeof parserPayload>) => void)[] = [
    p => { p.fileHash = "not-a-hash"; },
    p => { p.rawLineCount = -1; },
    p => { p.encounters[0].startedAt = "not-a-date"; },
    p => { p.encounters[0].totalDamage = -100; },
    p => { p.encounters[0].totalDamage = 1.5; },
    p => { p.encounters[0].totalHealing = Infinity; },
    p => { p.encounters[0].participants[0].deaths = 1.5; },
    p => { p.encounters[0].participants[0].critPct = 101; },
    p => { p.encounters[0].participants.push(p.encounters[0].participants[0]); },
    p => { p.encounters.push(p.encounters[0]); },
    p => { p.encounters[0].sessionIndex = -1; },
    p => { p.encounters[0].durationMs = 2 ** 31; },
    p => { p.receivedBytes = MAX_UPLOAD_BYTES + 1; },
    p => { p.provenance!.referenceSha = "current"; },
  ];
  for (const change of changes) {
    const payload = parserPayload();
    change(payload);
    assert.equal(ParseResultSchema.safeParse(payload).success, false, change.toString());
  }
});
