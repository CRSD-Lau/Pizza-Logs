/**
 * Import AzerothCore item_template.sql into wow_items table.
 *
 * Downloads item_template.sql from AzerothCore GitHub, parses MySQL INSERT rows,
 * extracts 18 needed columns, and batch-upserts into wow_items.
 * Preserves existing iconName values (from Warmane/Tampermonkey cache).
 *
 * Usage:
 *   npm run db:import-items
 *   npm run db:import-items -- --file /path/to/item_template.sql
 *
 * Column indices from AzerothCore item_template schema (0-indexed, 139 total cols):
 *   0=entry, 1=class, 2=subclass, 3=SoundOverrideSubclass, 4=name, 5=displayid,
 *   6=Quality, 7=Flags, 8=FlagsExtra, 9=BuyCount, 10=BuyPrice, 11=SellPrice,
 *   12=InventoryType, 13=AllowableClass, 14=AllowableRace, 15=ItemLevel,
 *   16=RequiredLevel, 17..27=misc, 28=stat_type1, 29=stat_value1, ..., 46=stat_type10, 47=stat_value10,
 *   48=ScalingStatDistribution, 49=ScalingStatValue, 50=dmg_min1, 51=dmg_max1, 52=dmg_type1,
 *   53=dmg_min2, 54=dmg_max2, 55=dmg_type2, 56=armor, 57..62=res, 63=delay,
 *   64=ammo_type, 65=RangedModRange, 66..72=spellid1/trigger/charges/ppm/cd/cat/catcd,
 *   73..79=spell2, 80..86=spell3, 87..93=spell4, 94..100=spell5,
 *   101=bonding, 102=description, 103..118=misc,
 *   119=socketColor_1, 120=socketContent_1, 121=socketColor_2, 122=socketContent_2,
 *   123=socketColor_3, 124=socketContent_3, 125=socketBonus, 126..138=misc
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Prisma, PrismaClient } from "@prisma/client";
import { parseSqlTuple, QUALITY_MAP, INVENTORY_TYPE_MAP, buildStatsFromTemplate } from "../lib/item-template";

const db = new PrismaClient();

const ITEM_TEMPLATE_URL =
  "https://raw.githubusercontent.com/azerothcore/database-wotlk/refs/heads/master/sql/base/item_template.sql";

const BATCH_SIZE = 500;

// 0-indexed column positions (verified against AzerothCore CREATE TABLE)
const COL = {
  entry:         0,
  itemClass:     1,
  itemSubclass:  2,
  name:          4,
  displayId:     5,
  Quality:       6,
  InventoryType: 12,
  ItemLevel:     15,
  RequiredLevel: 16,
  // stat pairs at 28..47: stat_type1=28, stat_value1=29, stat_type2=30, stat_value2=31, ...
  dmg_min1:      50,
  dmg_max1:      51,
  armor:         56,
  delay:         63,
  bonding:       101,
  description:   102,
  socketColor_1: 119,
  socketColor_2: 121,
  socketColor_3: 123,
  socketBonus:   125,
} as const;

// Minimum number of values we must see to consider a row valid
const MIN_COLS = 126; // need at least up to socketBonus at 125

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
  const nameStr  = values[COL.name];
  if (!entryStr || !nameStr?.trim()) return null;
  const entry = parseInt(entryStr, 10);
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const statTypes:  number[] = [];
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

  const qualityId   = parseNum(values[COL.Quality]);
  const inventoryId = parseNum(values[COL.InventoryType]);

  return {
    itemId:        String(entry),
    name:          nameStr.trim(),
    quality:       qualityId != null ? (QUALITY_MAP[qualityId] ?? null) : null,
    itemLevel:     parseNum(values[COL.ItemLevel]),
    itemClass:     parseNum(values[COL.itemClass]),
    itemSubclass:  parseNum(values[COL.itemSubclass]),
    displayId:     parseNum(values[COL.displayId]),
    equipLoc:      inventoryId != null ? (INVENTORY_TYPE_MAP[inventoryId] ?? null) : null,
    requiredLevel: parseNum(values[COL.RequiredLevel]),
    armor:         parseNum(values[COL.armor]),
    dmgMin:        parseFloat_(values[COL.dmg_min1]),
    dmgMax:        parseFloat_(values[COL.dmg_max1]),
    delay:         parseNum(values[COL.delay]),
    bonding:       parseNum(values[COL.bonding]),
    description:   values[COL.description]?.trim() || null,
    stats:         Object.keys(stats).length > 0 ? stats : null,
    socketColors:  hasSocket ? socketColors : null,
    socketBonus:   parseNum(values[COL.socketBonus]),
    importedAt:    new Date(),
  };
}

async function upsertBatch(batch: ItemRow[]): Promise<number> {
  if (batch.length === 0) return 0;

  // Build parameterized bulk INSERT ... ON CONFLICT DO UPDATE
  // We skip iconName deliberately (sourced from Tampermonkey cache)
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
      name = EXCLUDED.name,
      quality = EXCLUDED.quality,
      "itemLevel" = EXCLUDED."itemLevel",
      "itemClass" = EXCLUDED."itemClass",
      "itemSubclass" = EXCLUDED."itemSubclass",
      "displayId" = EXCLUDED."displayId",
      "equipLoc" = EXCLUDED."equipLoc",
      "requiredLevel" = EXCLUDED."requiredLevel",
      armor = EXCLUDED.armor,
      "dmgMin" = EXCLUDED."dmgMin",
      "dmgMax" = EXCLUDED."dmgMax",
      delay = EXCLUDED.delay,
      bonding = EXCLUDED.bonding,
      description = EXCLUDED.description,
      stats = EXCLUDED.stats,
      "socketColors" = EXCLUDED."socketColors",
      "socketBonus" = EXCLUDED."socketBonus",
      "importedAt" = EXCLUDED."importedAt"
      -- iconName intentionally excluded: sourced from Tampermonkey cache
  `;

  return batch.length;
}

async function getStream(filePath: string | null): Promise<NodeJS.ReadableStream> {
  if (filePath) return createReadStream(filePath, { encoding: "utf8" });
  const res = await fetch(ITEM_TEMPLATE_URL, {
    headers: { "User-Agent": "PizzaLogsImporter/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  if (!res.body) throw new Error("No response body");
  return Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
}

async function main() {
  const fileIdx = process.argv.findIndex(a => a === "--file");
  const filePath = fileIdx !== -1 ? process.argv[fileIdx + 1] : null;

  console.log(filePath
    ? `Importing from file: ${filePath}`
    : `Importing from: ${ITEM_TEMPLATE_URL}`);

  const stream = await getStream(filePath);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let batch: ItemRow[] = [];
  let totalParsed = 0;
  let totalSkipped = 0;
  let totalImported = 0;
  let inInsert = false;
  let partialLine = "";

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

    // Extract complete tuples from partialLine
    let remaining = partialLine;
    while (true) {
      const start = remaining.indexOf("(");
      if (start === -1) break;

      let depth = 0;
      let inStr = false;
      let end = -1;
      for (let i = start; i < remaining.length; i++) {
        const ch = remaining[i];
        // Handle backslash escape sequences inside strings
        if (inStr && ch === "\\" && remaining[i + 1] === "'") {
          i++; // skip escaped quote
          continue;
        }
        if (ch === "'" && !inStr)       { inStr = true; continue; }
        if (ch === "'" && inStr) {
          if (remaining[i + 1] === "'") { i++; continue; }       // doubled quote
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
        totalImported += await upsertBatch(batch);
        batch = [];
        process.stdout.write(`\r  Imported ${totalImported.toLocaleString()} rows...`);
      }
    }
    partialLine = remaining;
    if (trimmed.endsWith(";")) { inInsert = false; partialLine = ""; }
  }

  if (batch.length > 0) totalImported += await upsertBatch(batch);

  console.log(`\n\nDone.`);
  console.log(`  Parsed:   ${totalParsed.toLocaleString()}`);
  console.log(`  Skipped:  ${totalSkipped.toLocaleString()}`);
  console.log(`  Imported: ${totalImported.toLocaleString()}`);

  const count = await db.wowItem.count({ where: { importedAt: { not: null } } });
  console.log(`  DB rows with importedAt: ${count.toLocaleString()}`);
  if (count === 0) {
    console.error("WARNING: No rows imported.");
    process.exit(1);
  }

  const sample = await db.wowItem.findFirst({ where: { importedAt: { not: null } } });
  if (sample) {
    console.log(`  Sample: [${sample.itemId}] ${sample.name} (ilvl ${sample.itemLevel}, ${sample.quality})`);
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
