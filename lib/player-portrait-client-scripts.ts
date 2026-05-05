import { PIZZA_LOGS_LOCAL_ORIGIN, PIZZA_LOGS_ORIGIN } from "./armory-gear-client-scripts";

export const PORTRAIT_USERSCRIPT_PATH = "/api/player-portraits/userscript.user.js";
export const LOCAL_PORTRAIT_USERSCRIPT_PATH = "/api/player-portraits/userscript.local.user.js";
export const PORTRAIT_USERSCRIPT_URL = `${PIZZA_LOGS_ORIGIN}${PORTRAIT_USERSCRIPT_PATH}`;
export const LOCAL_PORTRAIT_USERSCRIPT_URL = `${PIZZA_LOGS_LOCAL_ORIGIN}${LOCAL_PORTRAIT_USERSCRIPT_PATH}`;

type PlayerPortraitUserscriptOptions = {
  pizzaLogsOrigin?: string;
  userscriptUrl?: string;
  nameSuffix?: string;
};

export function buildPlayerPortraitUserscript(options: PlayerPortraitUserscriptOptions = {}): string {
  const pizzaLogsOrigin = options.pizzaLogsOrigin ?? PIZZA_LOGS_ORIGIN;
  const userscriptUrl = options.userscriptUrl ?? PORTRAIT_USERSCRIPT_URL;
  const nameSuffix = options.nameSuffix ?? "";

  const script = function pizzaLogsWarmanePortraitsDeprecated() {
    try {
      console.info(
        "Pizza Logs portrait userscript is deprecated; class icons are built into the app. You can uninstall this userscript.",
      );
    } catch {
      // No-op compatibility update for older Tampermonkey installs.
    }
  };

  return [
    "// ==UserScript==",
    `// @name         Pizza Logs Warmane Portraits${nameSuffix}`,
    `// @namespace    ${pizzaLogsOrigin}`,
    "// @version      0.6.0",
    "// @description  Deprecated no-op compatibility update. Pizza Logs uses built-in class icons for avatars.",
    "// @match        https://pizza-logs-production.up.railway.app/*",
    "// @match        http://localhost:3000/*",
    "// @match        http://127.0.0.1:3000/*",
    "// @match        http://localhost:3001/*",
    "// @match        http://127.0.0.1:3001/*",
    "// @match        https://armory.warmane.com/character/*",
    "// @match        http://armory.warmane.com/character/*",
    "// @match        https://www.wowhead.com/modelviewer*",
    "// @match        https://www.wowhead.com/wotlk/modelviewer*",
    "// @match        https://wowhead.com/modelviewer*",
    "// @match        https://wow.zamimg.com/modelviewer*",
    `// @downloadURL   ${userscriptUrl}`,
    `// @updateURL     ${userscriptUrl}`,
    "// @run-at       document-idle",
    "// @grant        none",
    "// ==/UserScript==",
    "",
    `(${script.toString()})();`,
  ].join("\n");
}
