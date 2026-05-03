import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM, syncGuildRoster } from "@/lib/warmane-guild-roster";
import { verifyAdminSecretValue } from "@/lib/admin-auth";

function verifyAdmin(secret: unknown): boolean {
  return verifyAdminSecretValue(secret);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (!verifyAdmin(payload.secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await syncGuildRoster({
    guildName: typeof payload.guild === "string" ? payload.guild : DEFAULT_GUILD_NAME,
    realm: typeof payload.realm === "string" ? payload.realm : DEFAULT_GUILD_REALM,
    force: payload.force === true,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Roster sync is temporarily unavailable." }, { status: 502 });
  }

  return NextResponse.json(result);
}
