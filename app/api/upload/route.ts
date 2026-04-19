import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ParseResultSchema, UploadRequestSchema } from "@/lib/schema";
import { computeMilestones } from "@/lib/actions/milestones";

export const maxDuration = 300;

const enc = new TextEncoder();
const sse = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`);

export async function POST(req: NextRequest) {
  // ── Parse metadata from query params ─────────────────────────
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
    return new Response(
      sse({ type: "error", msg: meta.error.message }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }
  const { guildName, realmName, realmHost, expansion } = meta.data;
  const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
  const contentType = req.headers.get("content-type") ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(sse(data));

      try {
        // ── Forward to parser SSE endpoint ──────────────────────
        let parserRes: Response;
        try {
          parserRes = await fetch(`${parserUrl}/parse-stream`, {
            method:  "POST",
            headers: { "content-type": contentType },
            body:    req.body,
            duplex:  "half",
            signal:  AbortSignal.timeout(240_000),
          } as RequestInit & { duplex: string });
        } catch (err) {
          send({ type: "error", msg: `Parser unreachable: ${String(err)}` });
          controller.close();
          return;
        }

        if (!parserRes.ok || !parserRes.body) {
          const text = await parserRes.text().catch(() => "");
          send({ type: "error", msg: `Parser ${parserRes.status}: ${text}` });
          controller.close();
          return;
        }

        // ── Stream SSE from parser, intercept "done" event ──────
        const reader  = parserRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";
        let parseResult: ReturnType<typeof ParseResultSchema.parse> | null = null;

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              let event: { type: string; pct?: number; msg?: string; data?: unknown; };
              try { event = JSON.parse(line.slice(6)); }
              catch { continue; }

              if (event.type === "done") {
                // Validate parser payload
                const validated = ParseResultSchema.safeParse(event.data);
                if (!validated.success) {
                  send({ type: "error", msg: "Invalid parser response" });
                  break outer;
                }
                parseResult = validated.data;
                send({ type: "progress", pct: 91, msg: "Saving to database…" });
              } else if (event.type === "error") {
                send({ type: "error", msg: event.msg ?? "Parser error" });
                break outer;
              } else {
                // Forward progress straight through
                send(event);
              }
            }
          }
        }

        if (!parseResult) {
          controller.close();
          return;
        }

        // ── Dedup check ─────────────────────────────────────────
        const existingUpload = await db.upload.findUnique({
          where:  { fileHash: parseResult.fileHash },
          select: { id: true },
        });
        if (existingUpload) {
          send({
            type: "complete",
            result: {
              uploadId:            existingUpload.id,
              status:              "DUPLICATE",
              encountersFound:     parseResult.encounters.length,
              encountersInserted:  0,
              encountersDuplicate: parseResult.encounters.length,
              warnings:            ["This exact file has already been uploaded."],
            },
          });
          controller.close();
          return;
        }

        // ── Ensure realm / guild ─────────────────────────────────
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

        // ── Upload record ────────────────────────────────────────
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

        send({ type: "progress", pct: 93, msg: "Saving to database…" });

        // ── Batch pre-fetch ──────────────────────────────────────
        const bossNames    = [...new Set(parseResult.encounters.map(e => e.bossName))];
        const fingerprints = parseResult.encounters.map(e => e.fingerprint);

        const [dbBosses, existingEncounters] = await Promise.all([
          db.boss.findMany({ where: { name: { in: bossNames } } }),
          db.encounter.findMany({
            where:  { fingerprint: { in: fingerprints } },
            select: { fingerprint: true },
          }),
        ]);

        const bossMap      = new Map(dbBosses.map(b => [b.name, b]));
        const existingFps  = new Set(existingEncounters.map(e => e.fingerprint));
        const newEncounters = parseResult.encounters.filter(
          enc => bossMap.has(enc.bossName) && !existingFps.has(enc.fingerprint)
        );

        // ── Batch player upserts ─────────────────────────────────
        const playerClassMap = new Map(
          newEncounters.flatMap(enc =>
            enc.participants
              .filter(p => p.class)
              .map(p => [p.name, p.class!] as [string, string])
          )
        );
        const allPlayerNames = [...new Set(newEncounters.flatMap(e => e.participants.map(p => p.name)))];

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

        const dbPlayers = await db.player.findMany({
          where:  { name: { in: allPlayerNames }, realmId: realm.id },
          select: { id: true, name: true },
        });
        const playerMap = new Map(dbPlayers.map(p => [p.name, p.id]));

        // ── Create encounters + participants in parallel ──────────
        let encountersInserted = 0;
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

            await db.participant.createMany({
              data: enc.participants.flatMap(p => {
                const playerId = playerMap.get(p.name);
                if (!playerId) return [];
                return [{
                  encounterId:    encounter.id,
                  playerId,
                  role:           inferRole(p),
                  totalDamage:    p.totalDamage,
                  totalHealing:   p.totalHealing,
                  damageTaken:    p.damageTaken,
                  dps:            p.dps,
                  hps:            p.hps,
                  deaths:         p.deaths,
                  critPct:        p.critPct,
                  spellBreakdown:  (p.spellBreakdown  ?? {}) as object,
                  targetBreakdown: (p.targetBreakdown ?? {}) as object,
                }];
              }),
              skipDuplicates: true,
            });

            for (const p of enc.participants) {
              const playerId = playerMap.get(p.name);
              if (!playerId) continue;
              if (p.dps > 0)   milestoneChecks.push({ playerId, playerName: p.name, encounterId: encounter.id, bossId: boss.id, bossName: boss.name, difficulty: enc.difficulty, metric: "DPS", value: p.dps });
              if (p.hps > 100) milestoneChecks.push({ playerId, playerName: p.name, encounterId: encounter.id, bossId: boss.id, bossName: boss.name, difficulty: enc.difficulty, metric: "HPS", value: p.hps });
            }

            encountersInserted++;
          })
        );

        const milestones = await computeMilestones(milestoneChecks);

        await db.upload.update({
          where: { id: upload.id },
          data:  { status: "DONE", parsedAt: new Date() },
        });

        send({
          type: "complete",
          result: {
            uploadId:            upload.id,
            status:              "DONE",
            encountersFound:     parseResult.encounters.length,
            encountersInserted,
            encountersDuplicate: parseResult.encounters.length - newEncounters.length,
            milestones,
            warnings:            parseResult.warnings ?? [],
          },
        });
      } catch (err) {
        console.error("[upload] unhandled error:", err);
        send({ type: "error", msg: "Internal server error: " + String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":     "text/event-stream",
      "Cache-Control":    "no-cache, no-transform",
      "X-Accel-Buffering":"no",
    },
  });
}

function inferRole(p: { totalDamage: number; totalHealing: number }): "DPS" | "HEALER" | "TANK" | "UNKNOWN" {
  const ratio = p.totalHealing / Math.max(1, p.totalDamage + p.totalHealing);
  if (ratio > 0.6) return "HEALER";
  if (ratio > 0.3) return "UNKNOWN";
  return "DPS";
}
