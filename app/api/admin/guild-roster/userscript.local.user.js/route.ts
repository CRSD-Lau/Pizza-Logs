import { NextResponse } from "next/server";
import { PIZZA_LOGS_LOCAL_ORIGIN } from "@/lib/armory-gear-client-scripts";
import {
  LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
  buildGuildRosterUserscript,
} from "@/lib/guild-roster-client-scripts";

export async function GET(): Promise<NextResponse> {
  return new NextResponse(buildGuildRosterUserscript({
    pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
    userscriptUrl: LOCAL_GUILD_ROSTER_USERSCRIPT_URL,
    nameSuffix: " (Local)",
  }), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
