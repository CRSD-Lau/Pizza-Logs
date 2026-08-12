import { PIZZA_LOGS_LOCAL_ORIGIN, PIZZA_LOGS_ORIGIN } from "./armory-gear-client-scripts";

export const GUILD_ROSTER_USERSCRIPT_PATH = "/api/admin/guild-roster/userscript.user.js";
export const LOCAL_GUILD_ROSTER_USERSCRIPT_PATH = "/api/admin/guild-roster/userscript.local.user.js";
export const GUILD_ROSTER_USERSCRIPT_URL = `${PIZZA_LOGS_ORIGIN}${GUILD_ROSTER_USERSCRIPT_PATH}`;
export const LOCAL_GUILD_ROSTER_USERSCRIPT_URL = `${PIZZA_LOGS_LOCAL_ORIGIN}${LOCAL_GUILD_ROSTER_USERSCRIPT_PATH}`;

type GuildRosterUserscriptOptions = {
  pizzaLogsOrigin?: string;
  userscriptUrl?: string;
  nameSuffix?: string;
};

/** Compatibility update for existing installations; not an active sync path. */
export function buildGuildRosterUserscript(options: GuildRosterUserscriptOptions = {}): string {
  const pizzaLogsOrigin = options.pizzaLogsOrigin ?? PIZZA_LOGS_ORIGIN;
  const userscriptUrl = options.userscriptUrl ?? GUILD_ROSTER_USERSCRIPT_URL;
  const nameSuffix = options.nameSuffix ?? "";

  const script = function pizzaLogsRosterSyncRetired(origin: string) {
    try {
      for (const key of [
        `pizzaLogsAdminSecret:${origin}`,
        `pizzaLogsLastRosterSyncAt:${origin}`,
        "pizzaLogsAdminSecret",
        "pizzaLogsLastRosterSyncAt",
      ]) {
        localStorage.removeItem(key);
      }
      console.info(
        "Pizza Logs roster sync is retired. Use the first-party admin refresh; this userscript can be uninstalled.",
      );
    } catch {
      // Compatibility cleanup must never affect the Warmane page.
    }
  };

  return [
    "// ==UserScript==",
    `// @name         Pizza Logs Warmane Guild Roster Sync${nameSuffix}`,
    `// @namespace    ${pizzaLogsOrigin}`,
    "// @version      2.0.0",
    "// @description  Retired compatibility update. Roster refresh now runs inside Pizza Logs admin.",
    "// @match        https://armory.warmane.com/guild/*",
    "// @match        http://armory.warmane.com/guild/*",
    `// @downloadURL   ${userscriptUrl}`,
    `// @updateURL     ${userscriptUrl}`,
    "// @run-at       document-idle",
    "// @grant        none",
    "// ==/UserScript==",
    "",
    `(${script.toString()})(${JSON.stringify(pizzaLogsOrigin)});`,
  ].join("\n");
}
