import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlayerSearchQuerySchema } from "@/lib/api-query";
import { sanitizePlayerSearchQuery, searchPlayers, type PlayerSearchDb } from "@/lib/player-search";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const query = sanitizePlayerSearchQuery(url.searchParams.get("q"));
  const limit = Number(url.searchParams.get("limit") ?? undefined);
  const filter = PlayerSearchQuerySchema.safeParse({ realmId: url.searchParams.get("realmId") ?? undefined });
  if (!filter.success) return NextResponse.json({ error: "Invalid player search realm." }, { status: 400 });

  if (!query) {
    return NextResponse.json({ ok: true, query: "", results: [] });
  }

  try {
    const realm = filter.data.realmId
      ? await db.realm.findUnique({ where: { id: filter.data.realmId }, select: { name: true, host: true } })
      : null;
    const results = await searchPlayers(db as unknown as PlayerSearchDb, query, {
      limit,
      realmId: filter.data.realmId,
      includeDefaultRoster: !filter.data.realmId || (realm?.name === "Lordaeron" && realm.host === "warmane"),
    });
    return NextResponse.json({ ok: true, query, results });
  } catch (error) {
    console.error("Player search failed", error);
    return NextResponse.json(
      { ok: false, query, results: [], error: "Player search failed" },
      { status: 500 },
    );
  }
}
