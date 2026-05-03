import { NextRequest, NextResponse } from "next/server";
import { normalizeImportedArmoryGear, writeCachedGear } from "@/lib/warmane-armory";
import { verifyAdminSecretValue } from "@/lib/admin-auth";

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
  return verifyAdminSecretValue(secret);
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

  const normalized = normalizeImportedArmoryGear(payload);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400, headers });
  }

  await writeCachedGear(normalized.gear);

  return NextResponse.json({
    ok: true,
    characterName: normalized.gear.characterName,
    realm: normalized.gear.realm,
    itemCount: normalized.gear.items.length,
  }, { headers });
}

