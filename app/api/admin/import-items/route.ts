import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseSqlTuple, QUALITY_MAP, INVENTORY_TYPE_MAP, buildStatsFromTemplate } from "@/lib/item-template";

// Allow up to 5 minutes for the import
export const maxDuration = 300;

const ITEM_TEMPLATE_URL =
  "https://raw.githubusercontent.com/azerothcore/database-wotlk/refs/heads/master/sql/base/item_template.sql";

const BATCH_SIZE = 500;

const COL = {
  entry: 0, itemClass: 1, itemSubclass: 2, name: 4, displayId: 5,
  Quality: 6, InventoryType: 12, ItemLevel: 15, RequiredLevel: 16,
  dmg_min1: 50, dmg_max1: 51, armor: 56, delay: 63,
  bonding: 101, description: 102,
  socketColor_1: 119, socketColor_2: 121, socketColor_3: 123, socketBonus: 125,
} as const;

const MIN_COLS = 126;

function parseNum(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function parseFloat_(v: string | null): number | null {
  if (v === null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

type ItemRow = {
  itemId: string; name: string; quality: string | null; itemLevel: number | null;
  itemClass: number | null; itemSubclass: number | null; displayId: number | null;
  equipLoc: string | null; requiredLevel: number | null; armor: number | null;
  dmgMin: number | null; dmgMax: number | null; delay: number | null;
  bonding: number | null; description: string | null;
  stats: Record<string, number> | null;
  socketColors: number[] | null; socketBonus: number | null; importedAt: Date;
};

function parseRow(values: (string | null)[]): ItemRow | null {
  if (values.length < MIN_COLS) return null;
  const entryStr = values[COL.entry];
  const nameStr = values[COL.name];
  if (!entryStr || !nameStr?.trim()) return null;
  const entry = parseInt(entryStr, 10);
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const statTypes: number[] = [];
  const statValues: number[] = [];
  for (let i = 0; i < 10; i++) {
    statTypes.push(parseNum(values[28 + i * 2]) ?? 0);
    statValues.push(parseNum(values[29 + i * 2]) ?? 0);
  }
  const stats = buildStatsFromTemplate(statTypes, statValues);

  const socketColors = [
    parseNum(values[COL.socketColor_1]) ?? 0,
    parseNum(values[COL.socketColor_2]) ?? 0,
    parseNum(values[COL.socketColor_3]) ?? 0,
  ];
  const hasSocket = socketColors.some(c => c !== 0);
  const qualityId = parseNum(values[COL.Quality]);
  const inventoryId = parseNum(values[COL.InventoryType]);

  return {
    itemId: String(entry),
    name: nameStr.trim(),
    quality: qualityId != null ? (QUALITY_MAP[qualityId] ?? null) : null,
    itemLevel: parseNum(values[COL.ItemLevel]),
    itemClass: parseNum(values[COL.itemClass]),
    itemSubclass: parseNum(values[COL.itemSubclass]),
    displayId: parseNum(values[COL.displayId]),
    equipLoc: inventoryId != null ? (INVENTORY_TYPE_MAP[inventoryId] ?? null) : null,
    requiredLevel: parseNum(values[COL.RequiredLevel]),
    armor: parseNum(values[COL.armor]),
    dmgMin: parseFloat_(values[COL.dmg_min1]),
    dmgMax: parseFloat_(values[COL.dmg_max1]),
    delay: parseNum(values[COL.delay]),
    bonding: parseNum(values[COL.bonding]),
    description: values[COL.description]?.trim() || null,
    stats: Object.keys(stats).length > 0 ? stats : null,
    socketColors: hasSocket ? socketColors : null,
    socketBonus: parseNum(values[COL.socketBonus]),
    importedAt: new Date(),
  };
}

async function upsertBatch(db: PrismaClient, batch: ItemRow[]): Promise<number> {
  if (batch.length === 0) return 0;
  const values = batch.map(row =>
    Prisma.sql`(
      ${row.itemId}, ${row.name}, ${row.quality}, ${row.itemLevel},
      ${row.itemClass}, ${row.itemSubclass}, ${row.displayId}, ${row.equipLoc},
      ${row.requiredLevel}, ${row.armor}, ${row.dmgMin}, ${row.dmgMax},
      ${row.delay}, ${row.bonding}, ${row.description},
      ${row.stats !== null ? JSON.stringify(row.stats) : null}::jsonb,
      ${row.socketColors !== null ? JSON.stringify(row.socketColors) : null}::jsonb,
      ${row.socketBonus}, ${row.importedAt}
    )`
  );
  await db.$executeRaw`
    INSERT INTO wow_items (
      "itemId", name, quality, "itemLevel",
      "itemClass", "itemSubclass", "displayId", "equipLoc",
      "requiredLevel", armor, "dmgMin", "dmgMax",
      delay, bonding, description, stats, "socketColors", "socketBonus", "importedAt"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("itemId") DO UPDATE SET
      name = EXCLUDED.name, quality = EXCLUDED.quality,
      "itemLevel" = EXCLUDED."itemLevel", "itemClass" = EXCLUDED."itemClass",
      "itemSubclass" = EXCLUDED."itemSubclass", "displayId" = EXCLUDED."displayId",
      "equipLoc" = EXCLUDED."equipLoc", "requiredLevel" = EXCLUDED."requiredLevel",
      armor = EXCLUDED.armor, "dmgMin" = EXCLUDED."dmgMin", "dmgMax" = EXCLUDED."dmgMax",
      delay = EXCLUDED.delay, bonding = EXCLUDED.bonding, description = EXCLUDED.description,
      stats = EXCLUDED.stats, "socketColors" = EXCLUDED."socketColors",
      "socketBonus" = EXCLUDED."socketBonus", "importedAt" = EXCLUDED."importedAt"
  `;
  return batch.length;
}

function verifyAdmin(secret: unknown): boolean {
  const configured = process.env.ADMIN_SECRET;
  if (!configured) return true;
  return typeof secret === "string" && secret === configured;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  if (!verifyAdmin(body?.secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = new PrismaClient();
  try {
    const res = await fetch(ITEM_TEMPLATE_URL, {
      headers: { "User-Agent": "PizzaLogsImporter/1.0" },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    if (!res.body) throw new Error("No response body");

    const stream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    let batch: ItemRow[] = [];
    let totalParsed = 0, totalSkipped = 0, totalImported = 0;
    let inInsert = false, partialLine = "";

    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed.startsWith("INSERT INTO")) {
        inInsert = true;
        const valuesIdx = trimmed.indexOf("VALUES");
        partialLine = valuesIdx !== -1 ? trimmed.slice(valuesIdx + 6).trim() : "";
      } else if (inInsert) {
        partialLine += " " + trimmed;
      } else {
        continue;
      }

      let remaining = partialLine;
      while (true) {
        const start = remaining.indexOf("(");
        if (start === -1) break;
        let depth = 0, inStr = false, end = -1;
        for (let i = start; i < remaining.length; i++) {
          const ch = remaining[i];
          if (inStr && ch === "\\") { i++; continue; }
          if (ch === "'" && !inStr) { inStr = true; continue; }
          if (ch === "'" && inStr) {
            if (remaining[i + 1] === "'") { i++; continue; }
            inStr = false; continue;
          }
          if (inStr) continue;
          if (ch === "(") depth++;
          if (ch === ")") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) break;
        const tupleStr = remaining.slice(start, end + 1);
        remaining = remaining.slice(end + 1);
        const values = parseSqlTuple(tupleStr);
        totalParsed++;
        const row = parseRow(values);
        if (!row) { totalSkipped++; continue; }
        batch.push(row);
        if (batch.length >= BATCH_SIZE) {
          totalImported += await upsertBatch(db, batch);
          batch = [];
        }
      }
      partialLine = remaining;
      if (trimmed.endsWith(";")) { inInsert = false; partialLine = ""; }
    }

    if (batch.length > 0) totalImported += await upsertBatch(db, batch);

    const count = await db.wowItem.count({ where: { importedAt: { not: null } } });
    const sample = await db.wowItem.findFirst({ where: { importedAt: { not: null } } });

    return NextResponse.json({
      ok: true,
      parsed: totalParsed,
      skipped: totalSkipped,
      imported: totalImported,
      dbCount: count,
      sample: sample ? { itemId: sample.itemId, name: sample.name, itemLevel: sample.itemLevel, quality: sample.quality } : null,
    });
  } finally {
    await db.$disconnect();
  }
}
