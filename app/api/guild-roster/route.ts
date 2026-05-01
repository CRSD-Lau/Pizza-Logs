import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_GUILD_NAME, DEFAULT_GUILD_REALM, readGuildRosterMembers } from "@/lib/warmane-guild-roster";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guild = req.nextUrl.searchParams.get("guild") ?? DEFAULT_GUILD_NAME;
  const realm = req.nextUrl.searchParams.get("realm") ?? DEFAULT_GUILD_REALM;
  const members = await readGuildRosterMembers(guild, realm);

  return NextResponse.json({ ok: true, guild, realm, members });
}
