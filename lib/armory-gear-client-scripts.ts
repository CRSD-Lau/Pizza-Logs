export const PIZZA_LOGS_ORIGIN = "https://pizza-logs-production.up.railway.app";
export const PIZZA_LOGS_LOCAL_ORIGIN = "http://127.0.0.1:3001";
export const USERSCRIPT_PATH = "/api/admin/armory-gear/userscript.user.js";
export const LOCAL_USERSCRIPT_PATH = "/api/admin/armory-gear/userscript.local.user.js";
export const USERSCRIPT_URL = `${PIZZA_LOGS_ORIGIN}${USERSCRIPT_PATH}`;
export const LOCAL_USERSCRIPT_URL = `${PIZZA_LOGS_LOCAL_ORIGIN}${LOCAL_USERSCRIPT_PATH}`;

type UserscriptOptions = {
  pizzaLogsOrigin?: string;
  userscriptUrl?: string;
  nameSuffix?: string;
};

/**
 * Compatibility update for existing installations only.
 *
 * Keeping the old update URL lets Tampermonkey replace the former background
 * sync with inert cleanup code. Pizza Logs no longer links to or relies on it.
 */
export function buildUserscript(options: UserscriptOptions = {}): string {
  const pizzaLogsOrigin = options.pizzaLogsOrigin ?? PIZZA_LOGS_ORIGIN;
  const userscriptUrl = options.userscriptUrl ?? USERSCRIPT_URL;
  const nameSuffix = options.nameSuffix ?? "";

  const script = function pizzaLogsGearSyncRetired(origin: string) {
    try {
      for (const key of [
        `pizzaLogsAdminSecret:${origin}`,
        `pizzaLogsLastGearSyncAt:${origin}`,
        "pizzaLogsAdminSecret",
        "pizzaLogsLastGearSyncAt",
      ]) {
        localStorage.removeItem(key);
      }
      console.info(
        "Pizza Logs gear sync is retired. Gear quick looks now fetch through Pizza Logs; this userscript can be uninstalled.",
      );
    } catch {
      // Compatibility cleanup must never affect the Warmane page.
    }
  };

  return [
    "// ==UserScript==",
    `// @name         Pizza Logs Warmane Gear Auto Sync${nameSuffix}`,
    `// @namespace    ${pizzaLogsOrigin}`,
    "// @version      2.0.0",
    "// @description  Retired compatibility update. Gear quick looks now run through Pizza Logs.",
    "// @match        https://armory.warmane.com/character/*",
    "// @match        http://armory.warmane.com/character/*",
    `// @downloadURL   ${userscriptUrl}`,
    `// @updateURL     ${userscriptUrl}`,
    "// @run-at       document-idle",
    "// @grant        none",
    "// ==/UserScript==",
    "",
    `(${script.toString()})(${JSON.stringify(pizzaLogsOrigin)});`,
  ].join("\n");
}
