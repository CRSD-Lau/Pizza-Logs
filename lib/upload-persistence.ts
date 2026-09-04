import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { computeMilestones } from "@/lib/actions/milestones";
import { createPublicReportSlug } from "@/lib/public-report-slug";
import { buildRaidSessionRoutesWithAnalytics } from "@/lib/raid-session-slug";
import type { ParseResult, ParticipantResult, UploadRequest, UploadResponse } from "@/lib/schema";

export class IncompleteStoredUploadError extends Error {
  constructor() {
    super("An earlier upload of this file is incomplete. Please contact the maintainer before retrying.");
    this.name = "IncompleteStoredUploadError";
  }
}

type MilestoneChecks = Parameters<typeof computeMilestones>[0];
type PersistenceResult = { result: UploadResponse; milestoneChecks: MilestoneChecks };

interface UploadInput {
  parsed: ParseResult;
  metadata: UploadRequest;
  filename: string;
  fileSize: number;
}

function inferRole(p: ParticipantResult): "DPS" | "HEALER" | "TANK" | "UNKNOWN" {
  if (p.role) return p.role;
  const ratio = p.totalHealing / Math.max(1, p.totalDamage + p.totalHealing);
  if (ratio > 0.6) return "HEALER";
  if (ratio > 0.3) return "UNKNOWN";
  if (p.damageTaken > Math.max(1, p.totalDamage * 0.25)) return "TANK";
  return "DPS";
}

/** All report rows become visible together, or none of the upload is stored. */
export async function persistParsedUpload(database: PrismaClient, input: UploadInput): Promise<PersistenceResult> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await database.$transaction(async tx => persistTransaction(tx, input), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 60_000,
      });
    } catch (error) {
      // A competing file, fingerprint, player, or slug insert can invalidate the
      // snapshot. Retry the entire rolled-back transaction, including dedup.
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1) + Math.random() * 25));
    }
  }
}

async function persistTransaction(tx: Prisma.TransactionClient, input: UploadInput): Promise<PersistenceResult> {
  const { parsed, metadata, filename, fileSize } = input;
  const { uploaderName, guildName, realmName, realmHost, expansion } = metadata;
  const existing = await tx.upload.findUnique({
    where: { fileHash: parsed.fileHash },
    select: {
      id: true, publicSlug: true, status: true, sessionAnalytics: true,
      encounters: { select: { sessionIndex: true, startedAt: true } },
    },
  });
  if (existing) {
    if (existing.status !== "DONE") throw new IncompleteStoredUploadError();
    return {
      milestoneChecks: [],
      result: {
        uploadId: existing.id,
        publicReportSlug: existing.publicSlug,
        firstSessionSlug: buildRaidSessionRoutesWithAnalytics(existing.encounters, existing.sessionAnalytics)[0]?.slug,
        status: "DUPLICATE",
        encountersFound: parsed.encounters.length,
        encountersInserted: 0,
        encountersDuplicate: parsed.encounters.length,
        warnings: ["This exact file has already been uploaded."],
      },
    };
  }

  const realm = await tx.realm.upsert({
    where: { name_host: { name: realmName, host: realmHost } },
    update: {},
    create: { name: realmName, host: realmHost, expansion },
  });
  const guild = guildName ? await tx.guild.upsert({
    where: { name_realmId: { name: guildName, realmId: realm.id } },
    update: {},
    create: { name: guildName, realmId: realm.id },
  }) : null;

  const bosses = await tx.boss.findMany({ where: { name: { in: [...new Set(parsed.encounters.map(e => e.bossName))] } } });
  const bossMap = new Map(bosses.map(b => [b.name, b]));
  const existingEncounters = await tx.encounter.findMany({
    where: { fingerprint: { in: parsed.encounters.map(e => e.fingerprint) } },
    select: { fingerprint: true },
  });
  const existingFingerprints = new Set(existingEncounters.map(e => e.fingerprint));
  const newEncounters = parsed.encounters.filter(e => bossMap.has(e.bossName) && !existingFingerprints.has(e.fingerprint));
  const unsupportedCount = parsed.encounters.filter(e => !bossMap.has(e.bossName)).length;
  const warnings = [...(parsed.warnings ?? [])];
  if (unsupportedCount) warnings.push(`${unsupportedCount} encounter(s) could not be stored because boss metadata is unavailable.`);

  const upload = await tx.upload.create({
    data: {
      publicSlug: createPublicReportSlug(guildName ?? realmName),
      filename, fileHash: parsed.fileHash, fileSize, status: "DONE",
      realmId: realm.id, guildId: guild?.id ?? null, uploaderName,
      rawLineCount: parsed.rawLineCount, parsedAt: new Date(),
      sessionDamage: parsed.sessionDamage,
      sessionAnalytics: parsed.sessionAnalytics,
      parserVersion: parsed.provenance?.parserVersion ?? null,
      metricSchemaVersion: parsed.provenance?.metricSchemaVersion ?? null,
      compatibilityProfile: parsed.provenance?.compatibilityProfile ?? null,
      referenceSha: parsed.provenance?.referenceSha ?? null,
      parserParsedAt: parsed.provenance ? new Date(parsed.provenance.parsedAt) : null,
    },
    select: { id: true, publicSlug: true },
  });

  const classes = new Map(newEncounters.flatMap(e => e.participants.filter(p => p.class).map(p => [p.name, p.class!] as const)));
  const names = [...new Set([
    ...newEncounters.flatMap(e => e.participants.map(p => p.name)),
    ...Object.values(parsed.sessionAnalytics).flatMap(session => Object.keys(session.players)),
  ])].sort();
  const playerMap = new Map<string, string>();
  for (const name of names) {
    const player = await tx.player.upsert({
      where: { name_realmId: { name, realmId: realm.id } },
      update: { class: classes.get(name) ?? undefined },
      create: { name, class: classes.get(name) ?? null, realmId: realm.id },
      select: { id: true },
    });
    playerMap.set(name, player.id);
  }

  const milestoneChecks: MilestoneChecks = [];
  for (const enc of newEncounters) {
    const boss = bossMap.get(enc.bossName)!;
    const encounter = await tx.encounter.create({
      data: {
        uploadId: upload.id, bossId: boss.id, fingerprint: enc.fingerprint,
        outcome: enc.outcome, difficulty: enc.difficulty, groupSize: enc.groupSize,
        sessionIndex: enc.sessionIndex,
        // The legacy column is integral; the millisecond column preserves the
        // parser's duration for analytics and display without truncating rates.
        durationSeconds: Math.round(enc.durationSeconds),
        durationMs: enc.durationMs > 0 ? enc.durationMs : Math.round(enc.durationSeconds * 1000),
        startedAt: new Date(enc.startedAt), endedAt: new Date(enc.endedAt),
        totalDamage: enc.totalDamage, totalHealing: enc.totalHealing,
        totalAbsorbs: enc.totalAbsorbs, unattributedAbsorbs: enc.unattributedAbsorbs,
        totalDamageTaken: enc.totalDamageTaken,
      },
    });
    await tx.participant.createMany({
      data: enc.participants.map(p => ({
        encounterId: encounter.id, playerId: playerMap.get(p.name)!, role: inferRole(p), spec: p.spec ?? null,
        totalDamage: p.totalDamage, totalHealing: p.totalHealing, totalAbsorbs: p.totalAbsorbs,
        damageTaken: p.damageTaken, dps: p.dps, hps: p.hps, aps: p.aps, deaths: p.deaths, critPct: p.critPct,
        spellBreakdown: p.spellBreakdown ?? {}, targetBreakdown: p.targetBreakdown ?? {},
        absorbBreakdown: p.absorbBreakdown ?? {}, auraBreakdown: p.auraBreakdown ?? {},
        powerBreakdown: p.powerBreakdown ?? {}, consumableBreakdown: p.consumableBreakdown ?? {},
        deathEvents: p.deathEvents,
      })),
    });
    for (const p of enc.participants) {
      const common = { playerId: playerMap.get(p.name)!, playerName: p.name, encounterId: encounter.id, bossId: boss.id, bossName: boss.name, difficulty: enc.difficulty, startedAt: new Date(enc.startedAt) };
      if (enc.outcome === "KILL" && enc.difficulty !== "UNKNOWN") {
        if (p.dps > 0) milestoneChecks.push({ ...common, metric: "DPS", value: p.dps });
        if (inferRole(p) === "HEALER" && p.hps > 100) milestoneChecks.push({ ...common, metric: "HPS", value: p.hps });
      }
    }
  }

  return {
    milestoneChecks,
    result: {
      uploadId: upload.id, publicReportSlug: upload.publicSlug,
      firstSessionSlug: buildRaidSessionRoutesWithAnalytics(newEncounters, parsed.sessionAnalytics)[0]?.slug,
      status: "DONE", encountersFound: parsed.encounters.length,
      encountersInserted: newEncounters.length,
      encountersDuplicate: parsed.encounters.filter(e => existingFingerprints.has(e.fingerprint)).length,
      warnings,
    },
  };
}
