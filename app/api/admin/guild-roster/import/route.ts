import { NextRequest, NextResponse } from "next/server";
import { normalizeImportedGuildRoster, writeGuildRosterMembers } from "@/lib/warmane-guild-roster";
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

  const normalized = normalizeImportedGuildRoster(payload);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.message }, { status: 400, headers });
  }

  if (normalized.members.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Empty roster — import skipped to preserve existing data." },
      { status: 400, headers }
    );
  }

  await writeGuildRosterMembers(normalized.members);

  return NextResponse.json({
    ok: true,
    count: normalized.members.length,
  }, { headers });
}
