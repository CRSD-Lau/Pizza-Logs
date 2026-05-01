import { NextResponse } from "next/server";
import { buildGuildRosterUserscript } from "@/lib/guild-roster-client-scripts";

export async function GET(): Promise<NextResponse> {
  return new NextResponse(buildGuildRosterUserscript(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
