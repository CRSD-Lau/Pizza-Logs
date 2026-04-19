import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ParseResultSchema, UploadRequestSchema } from "@/lib/schema";
import { computeMilestones } from "@/lib/actions/milestones";

export const maxDuration = 300; // 5 min timeout for large files

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse metadata fields
    const meta = UploadRequestSchema.safeParse({
      guildName: formData.get("guildName") ?? undefined,
      realmName: formData.get("realmName") ?? "Lordaeron",
      realmHost: formData.get("realmHost") ?? "warmane",
      expansion: formData.get("expansion") ?? "wotlk",
    });
    if (!meta.success) {
      return NextResponse.json({ error: meta.error.message }, { status: 400 });
    }
    const { guildName, realmName, realmHost, expansion } = meta.data;

    // ── Forward file to Python parser ─────────────────────────────
    const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
    const parserForm = new FormData();
    parserForm.append("file", file, file.name);
    parserForm.append("year_hint", String(new Date().getFullYear()));

    let parseResult;
    try {
      const parserRes = await fetch(`${parserUrl}/parse`, {
        method: "POST",
        body: parserForm,
        signal: AbortSignal.timeout(240_000),
      });
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
        filename:  file.name,
        fileHash:  parseResult.fileHash,
        fileSize:  file.size,
        status:    "PARSING",
        realmId:   realm.id,
        guildId:   guildId ?? null,
        rawLineCount: parseResult.rawLineCount,
      },
    });

    let encountersInserted = 0;
    let encountersDuplicate = 0;
    const milestoneChecks: Parameters<typeof computeMilestones>[0] = [];

    // ── Persist each encounter ────────────────────────────────────
    for (const enc of parseResult.encounters) {
      // Find or validate boss
      const boss = await db.boss.findFirst({
        where: {
          OR: [
            { name: enc.bossName },
            enc.bossId ? { wowBossId: enc.bossId } : {},
          ].filter(c => Object.keys(c).length > 0),
        },
      });
      if (!boss) {
        console.warn(`[upload] Unknown boss: ${enc.bossName} — skipping`);
        continue;
      }

      // Encounter dedup by fingerprint
      const existing = await db.encounter.findUnique({
        where: { fingerprint: enc.fingerprint },
        select: { id: true },
      });
      if (existing) {
        encountersDuplicate++;
        continue;
      }

      // Persist encounter
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

      // Persist participants
      for (const p of enc.participants) {
        const player = await db.player.upsert({
          where: { name_realmId: { name: p.name, realmId: realm.id } },
          update: { class: p.class ?? undefined },
          create: { name: p.name, class: p.class ?? null, realmId: realm.id },
        });

        const role = inferRole(p);

        await db.participant.upsert({
          where: { encounterId_playerId: { encounterId: encounter.id, playerId: player.id } },
          update: {
            totalDamage:   p.totalDamage,
            totalHealing:  p.totalHealing,
            damageTaken:   p.damageTaken,
            dps:           p.dps,
            hps:           p.hps,
            deaths:        p.deaths,
            critPct:       p.critPct,
            role,
            spellBreakdown: p.spellBreakdown ?? {},
          },
          create: {
            encounterId:   encounter.id,
            playerId:      player.id,
            role,
            totalDamage:   p.totalDamage,
            totalHealing:  p.totalHealing,
            damageTaken:   p.damageTaken,
            dps:           p.dps,
            hps:           p.hps,
            deaths:        p.deaths,
            critPct:       p.critPct,
            spellBreakdown: p.spellBreakdown ?? {},
          },
        });

        // Queue milestone checks
        if (p.dps > 0) {
          milestoneChecks.push({
            playerId:    player.id,
            playerName:  p.name,
            encounterId: encounter.id,
            bossId:      boss.id,
            bossName:    boss.name,
            difficulty:  enc.difficulty,
            metric:      "DPS",
            value:       p.dps,
          });
        }
        if (p.hps > 100) {
          milestoneChecks.push({
            playerId:    player.id,
            playerName:  p.name,
            encounterId: encounter.id,
            bossId:      boss.id,
            bossName:    boss.name,
            difficulty:  enc.difficulty,
            metric:      "HPS",
            value:       p.hps,
          });
        }
      }

      encountersInserted++;
    }

    // ── Compute milestones ────────────────────────────────────────
    const milestones = await computeMilestones(milestoneChecks);

    // ── Finalise upload ───────────────────────────────────────────
    await db.upload.update({
      where: { id: upload.id },
      data: {
        status:   encountersInserted > 0 ? "DONE" : "DONE",
        parsedAt: new Date(),
      },
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
  if (ratio > 0.3) return "UNKNOWN"; // mixed — could be tank
  return "DPS";
}
