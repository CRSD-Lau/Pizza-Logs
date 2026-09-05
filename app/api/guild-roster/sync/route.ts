import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM, syncGuildRoster } from "@/lib/warmane-guild-roster";
import { getAdminSession } from "@/lib/admin-auth";
import { hasTrustedAdminOrigin } from "@/lib/admin-request";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!hasTrustedAdminOrigin(req.headers) || !(await getAdminSession(req.headers))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
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
