import { PIZZA_LOGS_LOCAL_ORIGIN } from "@/lib/armory-gear-client-scripts";
import {
  LOCAL_PORTRAIT_USERSCRIPT_URL,
  buildPlayerPortraitUserscript,
} from "@/lib/player-portrait-client-scripts";

export async function GET() {
  return new Response(buildPlayerPortraitUserscript({
    pizzaLogsOrigin: PIZZA_LOGS_LOCAL_ORIGIN,
    userscriptUrl: LOCAL_PORTRAIT_USERSCRIPT_URL,
    nameSuffix: " (Local)",
  }), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
