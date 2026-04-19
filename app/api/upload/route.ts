import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ParseResultSchema, UploadRequestSchema } from "@/lib/schema";
import { computeMilestones } from "@/lib/actions/milestones";

export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Read metadata from query params ──────────────────────────
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename") ?? "WoWCombatLog.txt";
    const fileSize = parseInt(searchParams.get("fileSize") ?? "0", 10);

    const meta = UploadRequestSchema.safeParse({
      guildName: searchParams.get("guildName") ?? undefined,
      realmName: searchParams.get("realmName") ?? "Lordaeron",
      realmHost: searchParams.get("realmHost") ?? "warmane",
      expansion: searchParams.get("expansion") ?? "wotlk",
    });
    if (!meta.success) {
      return NextResponse.json({ error: meta.error.message }, { status: 400 });
    }
    const { guildName, realmName, realmHost, expansion } = meta.data;

    // ── Stream body directly to Python parser ─────────────────────
    const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
    const contentType = req.headers.get("content-type") ?? "";

    let parseResult;
    try {
      const parserRes = await fetch(`${parserUrl}/parse`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: req.body,
        duplex: "half",
        signal: AbortSignal.timeout(240_000),
      } as RequestInit & { duplex: string });
      if (!parserRes.ok) {
        const errText = await parserRes.text();
        throw new Error(`Parser returned ${parserRes.status}: ${errText}`);
      }
      const raw = await parserRes.json();
      parseResult = ParseResultSchema.parse(raw);
    } catch (err) {
      console.error("[upload] parser error:", err);
      return NextResponse.json(
        { error: "Parser service error: " + String(err) },
        { status: 502 }
      );
    }

    // ── Dedup: file hash ──────────────────────────────────────────
    const existingUpload = await db.upload.findUnique({
      where: { fileHash: parseResult.fileHash },
      select: { id: true },
    });
    if (existingUpload) {
      return NextResponse.json({
        uploadId:            existingUpload.id,
        status:              "DUPLICATE",
        encountersFound:     parseResult.encounters.length,
        encountersInserted:  0,
        encountersDuplicate: parseResult.encounters.length,
        warnings:            ["This exact file has already been uploaded."],
      });
    }

    // ── Ensure realm / guild exist ────────────────────────────────
    const realm = await db.realm.upsert({
      where:  { name_host: { name: realmName, host: realmHost } },
      update: {},
      create: { name: realmName, host: realmHost, expansion },
    });

    let guildId: string | undefined;
    if (guildName) {
      const guild = await db.guild.upsert({
        where:  { name_realmId: { name: guildName, realmId: realm.id } },
        update: {},
        create: { name: guildName, realmId: realm.id },
      });
      guildId = guild.id;
    }

    // ── Create upload record ──────────────────────────────────────
    const upload = await db.upload.create({
      data: {
        filename:     filename,
        fileHash:     parseResult.fileHash,
        fileSize:     fileSize || 0,
        status:       "PARSING",
        realmId:      realm.id,
        guildId:      guildId ?? null,
        rawLineCount: parseResult.rawLineCount,
      },
    });

    // ── Batch pre-fetch: bosses + existing fingerprints ───────────
    const bossNames = [...new Set(parseResult.encounters.map(e => e.bossName))];
    const fingerprints = parseResult.encounters.map(e => e.fingerprint);

    const [dbBosses, existingEncounters] = await Promise.all([
      db.boss.findMany({ where: { name: { in: bossNames } } }),
      db.encounter.findMany({
        where:  { fingerprint: { in: fingerprints } },
        select: { fingerprint: true },
      }),
    ]);

    const bossMap = new Map(dbBosses.map(b => [b.name, b]));
    const existingFps = new Set(existingEncounters.map(e => e.fingerprint));

    // ── Batch upsert all players mentioned in new encounters ──────
    const newEncounters = parseResult.encounters.filter(
      enc => bossMap.has(enc.bossName) && !existingFps.has(enc.fingerprint)
    );

    const allPlayerNames = [...new Set(
      newEncounters.flatMap(enc => enc.participants.map(p => p.name))
    )];

    // Upsert players in parallel chunks of 20
    const playerClassMap = new Map(
      newEncounters.flatMap(enc =>
        enc.participants
          .filter(p => p.class)
          .map(p => [p.name, p.class!] as [string, string])
      )
    );

    // Prisma doesn't support bulk upsert, so we batch parallel upserts
    // in chunks of 20 to avoid overwhelming the connection pool
    const BATCH = 20;
    for (let i = 0; i < allPlayerNames.length; i += BATCH) {
      await Promise.all(
        allPlayerNames.slice(i, i + BATCH).map(name =>
          db.player.upsert({
            where:  { name_realmId: { name, realmId: realm.id } },
            update: { class: playerClassMap.get(name) ?? undefined },
            create: { name, class: playerClassMap.get(name) ?? null, realmId: realm.id },
          })
        )
      );
    }

    // Fetch all players in one query for ID lookup
    const dbPlayers = await db.player.findMany({
      where: { name: { in: allPlayerNames }, realmId: realm.id },
      select: { id: true, name: true },
    });
    const playerMap = new Map(dbPlayers.map(p => [p.name, p.id]));

    // ── Create encounters + participants in parallel ───────────────
    let encountersInserted = 0;
    const encountersDuplicate = parseResult.encounters.length - newEncounters.length;
    const milestoneChecks: Parameters<typeof computeMilestones>[0] = [];

    await Promise.all(
      newEncounters.map(async enc => {
        const boss = bossMap.get(enc.bossName);
        if (!boss) return;

        const encounter = await db.encounter.create({
          data: {
            uploadId:         upload.id,
            bossId:           boss.id,
            fingerprint:      enc.fingerprint,
            outcome:          enc.outcome as "KILL" | "WIPE" | "UNKNOWN",
            difficulty:       enc.difficulty,
            groupSize:        enc.groupSize,
            durationSeconds:  enc.durationSeconds,
            startedAt:        new Date(enc.startedAt),
            endedAt:          new Date(enc.endedAt),
            totalDamage:      enc.totalDamage,
            totalHealing:     enc.totalHealing,
            totalDamageTaken: enc.totalDamageTaken,
          },
        });

        // Participants: build all at once then createMany
        const participantData = enc.participants.flatMap(p => {
          const playerId = playerMap.get(p.name);
          if (!playerId) return [];
          const role = inferRole(p);
          return [{
            encounterId:    encounter.id,
            playerId,
            role,
            totalDamage:    p.totalDamage,
            totalHealing:   p.totalHealing,
            damageTaken:    p.damageTaken,
            dps:            p.dps,
            hps:            p.hps,
            deaths:         p.deaths,
            critPct:        p.critPct,
            spellBreakdown: (p.spellBreakdown ?? {}) as object,
          }];
        });

        await db.participant.createMany({
          data: participantData,
          skipDuplicates: true,
        });

        // Collect milestone checks
        for (const p of enc.participants) {
          const playerId = playerMap.get(p.name);
          if (!playerId) continue;
          if (p.dps > 0) {
            milestoneChecks.push({
              playerId, playerName: p.name,
              encounterId: encounter.id,
              bossId: boss.id, bossName: boss.name,
              difficulty: enc.difficulty,
              metric: "DPS", value: p.dps,
            });
          }
          if (p.hps > 100) {
            milestoneChecks.push({
              playerId, playerName: p.name,
              encounterId: encounter.id,
              bossId: boss.id, bossName: boss.name,
              difficulty: enc.difficulty,
              metric: "HPS", value: p.hps,
            });
          }
        }

        encountersInserted++;
      })
    );

    const milestones = await computeMilestones(milestoneChecks);

    await db.upload.update({
      where: { id: upload.id },
      data:  { status: "DONE", parsedAt: new Date() },
    });

    return NextResponse.json({
      uploadId:            upload.id,
      status:              "DONE",
      encountersFound:     parseResult.encounters.length,
      encountersInserted,
      encountersDuplicate,
      milestones,
      warnings:            parseResult.warnings ?? [],
    });
  } catch (err) {
    console.error("[upload] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}

function inferRole(p: { totalDamage: number; totalHealing: number }): "DPS" | "HEALER" | "TANK" | "UNKNOWN" {
  const ratio = p.totalHealing / Math.max(1, p.totalDamage + p.totalHealing);
  if (ratio > 0.6) return "HEALER";
  if (ratio > 0.3) return "UNKNOWN";
  return "DPS";
}
