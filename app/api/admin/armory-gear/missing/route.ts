import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gearNeedsWowheadEnrichment } from "@/lib/warmane-armory";

const MAX_PLAYERS = 100;

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin === "https://armory.warmane.com"
    ? origin
    : "https://armory.warmane.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function verifyAdmin(secret: unknown): boolean {
  const configured = process.env.ADMIN_SECRET;
  if (!configured) return true;
  return typeof secret === "string" && secret === configured;
}

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (origin && origin !== "https://armory.warmane.com") {
    return NextResponse.json({ ok: false, error: "Origin not allowed." }, { status: 403, headers });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400, headers });
  }

  const payload = body as Record<string, unknown>;
  if (!verifyAdmin(payload.secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401, headers });
  }

  const players = await db.player.findMany({
    orderBy: { name: "asc" },
    take: MAX_PLAYERS,
    include: {
      realm: { select: { name: true } },
    },
  });

  const cachedRows = await db.armoryGearCache.findMany({
    where: {
      characterKey: { in: players.map(player => player.name.toLowerCase()) },
    },
    select: {
      characterKey: true,
      realm: true,
      gear: true,
    },
  });
  const freshCachedKeys = new Set(
    cachedRows
      .filter((row) => !gearNeedsWowheadEnrichment(row.gear))
      .map(row => `${row.characterKey}:${row.realm}`)
  );

  const missing = players
    .map(player => ({
      characterName: player.name,
      realm: player.realm?.name ?? "Lordaeron",
    }))
    .filter(player => !freshCachedKeys.has(`${player.characterName.toLowerCase()}:${player.realm}`));

  return NextResponse.json({ ok: true, players: missing }, { headers });
}
