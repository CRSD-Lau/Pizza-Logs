import { z } from "zod";

export const UploadRequestSchema = z.object({
  guildName:  z.string().min(1).max(64).optional(),
  realmName:  z.string().min(1).max(64).default("Lordaeron"),
  realmHost:  z.string().min(1).max(64).default("warmane"),
  expansion:  z.enum(["wotlk", "cata", "mop", "retail"]).default("wotlk"),
});
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

// ── Shapes returned by the Python parser ──────────────────────

export const SpellBreakdownSchema = z.record(
  z.string(),
  z.object({
    damage:  z.number(),
    healing: z.number(),
    hits:    z.number(),
    crits:   z.number(),
    school:  z.number(),
  })
);

export const TargetBreakdownSchema = z.record(
  z.string(),
  z.object({
    damage: z.number(),
    hits:   z.number(),
    crits:  z.number(),
  })
);
export type TargetBreakdown = z.infer<typeof TargetBreakdownSchema>;

export const ParticipantResultSchema = z.object({
  name:            z.string(),
  class:           z.string().nullable().optional(),
  totalDamage:     z.number(),
  totalHealing:    z.number(),
  damageTaken:     z.number(),
  dps:             z.number(),
  hps:             z.number(),
  deaths:          z.number(),
  critPct:         z.number(),
  spellBreakdown:  SpellBreakdownSchema.optional(),
  targetBreakdown: TargetBreakdownSchema.optional(),
});
export type ParticipantResult = z.infer<typeof ParticipantResultSchema>;

export const EncounterResultSchema = z.object({
  bossName:        z.string(),
  bossId:          z.number().optional(),
  difficulty:      z.string(),
  groupSize:       z.number(),
  outcome:         z.enum(["KILL", "WIPE", "UNKNOWN"]),
  durationSeconds: z.number(),
  startedAt:       z.string(), // ISO timestamp
  endedAt:         z.string(),
  totalDamage:     z.number(),
  totalHealing:    z.number(),
  totalDamageTaken:z.number(),
  fingerprint:     z.string(),
  participants:    z.array(ParticipantResultSchema),
  sessionIndex:    z.number().int().default(0),
});
export type EncounterResult = z.infer<typeof EncounterResultSchema>;

export const ParseResultSchema = z.object({
  filename:     z.string(),
  fileHash:     z.string(),
  rawLineCount: z.number(),
  encounters:   z.array(EncounterResultSchema),
  warnings:     z.array(z.string()).optional(),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

// ── Upload API response ────────────────────────────────────────

export const UploadResponseSchema = z.object({
  uploadId:           z.string(),
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
