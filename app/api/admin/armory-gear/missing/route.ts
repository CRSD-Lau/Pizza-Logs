import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM } from "@/lib/warmane-guild-roster";
import { getMissingArmoryGearPlayers } from "@/lib/armory-gear-queue";

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
    include: {
      realm: { select: { name: true } },
    },
  });
  const rosterMembers = await db.guildRosterMember.findMany({
    where: {
      guildName: DEFAULT_GUILD_NAME,
      realm: DEFAULT_GUILD_REALM,
    },
    orderBy: [
      { rankOrder: "asc" },
      { characterName: "asc" },
    ],
    select: {
      characterName: true,
      normalizedCharacterName: true,
      realm: true,
    },
  });
  const queueKeys = Array.from(new Set([
    ...players.map(player => player.name.toLowerCase()),
    ...rosterMembers.map(member => member.normalizedCharacterName),
  ]));

  const cachedRows = await db.armoryGearCache.findMany({
    where: {
      characterKey: { in: queueKeys },
    },
    select: {
      characterKey: true,
      realm: true,
      gear: true,
    },
  });
  const missing = getMissingArmoryGearPlayers({ players, rosterMembers, cachedRows }).slice(0, MAX_PLAYERS);

  return NextResponse.json({ ok: true, players: missing }, { headers });
}
