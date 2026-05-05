import { NextResponse } from "next/server";
import {
  LOCAL_USERSCRIPT_URL,
  PIZZA_LOGS_LOCAL_ORIGIN,
  buildUserscript,
} from "@/lib/armory-gear-client-scripts";

export async function GET(): Promise<NextResponse> {
  return new NextResponse(buildUserscript({
    pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
    userscriptUrl: LOCAL_USERSCRIPT_URL,
    nameSuffix: " (Local)",
  }), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
