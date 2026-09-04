import { createHash } from "node:crypto";
import { ParseResultSchema } from "../../lib/schema";

export const testUploadId = "01234567-89ab-4cde-8f01-23456789abcd";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function parserPayload(id = "fixture") {
  return ParseResultSchema.parse({
    filename: "synthetic.txt", fileHash: hash(`file-${id}`), rawLineCount: 3,
    uploadId: testUploadId, receivedBytes: 128,
    provenance: {
      parserVersion: "1.1.0", metricSchemaVersion: "1", compatibilityProfile: "canonical-v1",
      referenceSha: null, parsedAt: "2026-09-04T12:00:00Z",
    },
    encounters: [{
      bossName: "Lord Marrowgar", difficulty: "25N", groupSize: 25, outcome: "KILL",
      durationSeconds: 30.125, durationMs: 30_125,
      startedAt: "2026-09-04T10:00:00Z", endedAt: "2026-09-04T10:00:30.125Z",
      totalDamage: 100, totalHealing: 0, totalDamageTaken: 10, fingerprint: hash(`encounter-${id}`),
      participants: [{ name: "Example", class: "MAGE", role: "DPS", totalDamage: 100,
        totalHealing: 0, damageTaken: 10, dps: 3.32, hps: 0, deaths: 0, critPct: 0 }],
    }],
  });
}
