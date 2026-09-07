import { z } from "zod";

const label = z.string().min(1).max(256);
const amount = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER);
const combatAmount = amount.int();
const count = z.number().int().nonnegative().max(2_147_483_647);
const percentage = z.number().min(0).max(100);
const timestamp = z.iso.datetime({ offset: true });
const difficulty = z.enum(["10N", "10H", "25N", "25H", "UNKNOWN"]);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const sessionKey = z.string().regex(/^\d{1,10}$/);
const versionToken = z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const ParserProvenanceSchema = z.object({
  parserVersion: versionToken,
  metricSchemaVersion: versionToken,
  compatibilityProfile: versionToken,
  referenceSha: z.string().regex(/^[0-9a-f]{40}$/).nullable(),
  parsedAt: timestamp,
});

const uploadLabel = (max: number) => z.string().regex(/^[^\p{Cc}\p{Cf}<>]+$/u).trim().min(1).max(max);

export const UploadRequestSchema = z.object({
  uploaderName: uploadLabel(32),
  guildName:    uploadLabel(64).optional(),
  realmName:    uploadLabel(64).default("Lordaeron"),
  realmHost:    uploadLabel(64).default("warmane"),
  expansion:    z.enum(["wotlk", "cata", "mop", "retail"]).default("wotlk"),
});
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

// ── Shapes returned by the Python parser ──────────────────────

export const SpellBreakdownSchema = z.record(
  label,
  z.object({
    damage:  combatAmount,
    healing: combatAmount,
    hits:    count,
    crits:   count,
    school:  count,
  })
);

export const TargetBreakdownSchema = z.record(
  label,
  z.object({
    damage: combatAmount,
    hits:   count,
    crits:  count,
  })
);
export type TargetBreakdown = z.infer<typeof TargetBreakdownSchema>;

export const AbsorbBreakdownSchema = z.record(
  label,
  z.object({
    amount: combatAmount,
    hits: count,
    ambiguousHits: count,
  }),
);

export const AuraBreakdownSchema = z.record(
  label,
  z.object({
    uptimeSeconds: amount,
    uptimePct: percentage,
    applications: count,
  }),
);

export const PowerBreakdownSchema = z.record(
  label,
  z.object({
    amount,
    events: count,
    powerType: z.number().int().min(-1).max(255),
  }),
);

export const ParticipantResultSchema = z.object({
  name:            label,
  class:           label.nullable().optional(),
  spec:            label.nullable().optional(),
  role:            z.enum(["DPS", "HEALER", "TANK", "UNKNOWN"]).optional(),
  totalDamage:     combatAmount,
  totalHealing:    combatAmount,
  totalAbsorbs:    combatAmount.default(0),
  damageTaken:     combatAmount,
  dps:             amount,
  hps:             amount,
  aps:             amount.default(0),
  deaths:          count,
  deathEvents:     z.array(z.object({
    offsetSeconds: amount,
    recentDamage: z.array(z.object({
      offsetSeconds: amount,
      secondsBeforeDeath: amount,
      source: label,
      spell: label,
      amount: combatAmount,
    })).max(10_000).default([]),
  })).max(10_000).default([]),
  critPct:         percentage,
  spellBreakdown:  SpellBreakdownSchema.optional(),
  targetBreakdown: TargetBreakdownSchema.optional(),
  absorbBreakdown: AbsorbBreakdownSchema.optional(),
  auraBreakdown:   AuraBreakdownSchema.optional(),
  powerBreakdown:  PowerBreakdownSchema.optional(),
  consumableBreakdown: AuraBreakdownSchema.optional(),
});
export type ParticipantResult = z.infer<typeof ParticipantResultSchema>;

export const EncounterResultSchema = z.object({
  bossName:        label,
  bossId:          count.nullable().optional(),
  difficulty,
  groupSize:       z.number().int().min(1).max(40),
  outcome:         z.enum(["KILL", "WIPE", "UNKNOWN"]),
  durationSeconds: z.number().nonnegative().max(2_147_483.647),
  durationMs:      count.default(0),
  startedAt:       timestamp,
  endedAt:         timestamp,
  totalDamage:     combatAmount,
  totalHealing:    combatAmount,
  totalAbsorbs:    combatAmount.default(0),
  unattributedAbsorbs: combatAmount.default(0),
  totalDamageTaken:combatAmount,
  fingerprint:     sha256,
  participants:    z.array(ParticipantResultSchema).max(1_000).refine(
    rows => new Set(rows.map(row => row.name)).size === rows.length,
    "Participant names must be unique within an encounter",
  ),
  sessionIndex:    count.default(0),
  difficultyDetection: z.object({
    mode:            difficulty,
    confidence:      label,
    evidence:        z.array(z.string().max(2_048)).max(1_000),
    reason:          z.string().max(2_048),
    detectorVersion: versionToken,
  }).optional(),
});
export type EncounterResult = z.infer<typeof EncounterResultSchema>;

export const SessionPlayerAnalyticsSchema = z.object({
  totalDamage: combatAmount.default(0),
  totalHealing: combatAmount.default(0),
  totalAbsorbs: combatAmount.default(0),
  heal: combatAmount.default(0),
  damageTaken: combatAmount.default(0),
});

export const SessionAnalyticsSchema = z.object({
  startedAt: timestamp,
  endedAt: timestamp,
  durationMs: amount.int(),
  totalDamage: combatAmount.default(0),
  totalHealing: combatAmount.default(0),
  totalAbsorbs: combatAmount.default(0),
  heal: combatAmount.default(0),
  totalDamageTaken: combatAmount.default(0),
  unattributedAbsorbs: combatAmount.default(0),
  players: z.record(label, SessionPlayerAnalyticsSchema).default({}),
});

export const ParseResultSchema = z.object({
  filename:      label,
  fileHash:      sha256,
  rawLineCount:  count,
  encounters:    z.array(EncounterResultSchema).max(10_000).refine(
    rows => new Set(rows.map(row => row.fingerprint)).size === rows.length,
    "Encounter fingerprints must be unique within a parser response",
  ),
  warnings:      z.array(z.string().max(2_048)).max(1_000).optional(),
  sessionDamage: z.record(sessionKey, combatAmount).optional().default({}),
  sessionAnalytics: z.record(sessionKey, SessionAnalyticsSchema).optional().default({}),
  uploadId:      z.string().uuid().optional(),
  receivedBytes: count.max(100 * 1024 * 1024).optional(),
  uploadTimings: z.record(label, amount).optional(),
  provenance: ParserProvenanceSchema.optional(),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

// ── Upload API response ────────────────────────────────────────

export const UploadResponseSchema = z.object({
  uploadId:           z.string(),
  publicReportSlug:   z.string(),
  firstSessionSlug:   z.string().optional(),
  status:             z.enum(["DONE", "FAILED", "DUPLICATE", "PARTIAL"]),
  encountersFound:    z.number(),
  encountersInserted: z.number(),
  encountersDuplicate:z.number(),
  milestones:         z.array(z.object({
    playerName: z.string(),
    bossName:   z.string(),
    difficulty: z.string(),
    metric:     z.string(),
    value:      z.number(),
    rank:       z.number(),
    type:       z.string(),
  })).optional(),
  warnings:           z.array(z.string()).optional(),
  errorMessage:       z.string().optional(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
