import { PIZZA_LOGS_ORIGIN } from "./armory-gear-client-scripts";

export const GUILD_ROSTER_USERSCRIPT_PATH = "/api/admin/guild-roster/userscript.user.js";
export const GUILD_ROSTER_USERSCRIPT_URL = `${PIZZA_LOGS_ORIGIN}${GUILD_ROSTER_USERSCRIPT_PATH}`;
const WARMANE_GUILD_NAME = "Pizza+Warriors";
const DISPLAY_GUILD_NAME = "PizzaWarriors";
const WARMANE_REALM = "Lordaeron";

function buildRosterScriptBody(autoRun: boolean): string {
  const script = function pizzaLogsRosterSync() {
    const pizzaLogsOrigin = "__PIZZA_LOGS_ORIGIN__";
    const guildName = "__DISPLAY_GUILD_NAME__";
    const warmaneGuildName = "__WARMANE_GUILD_NAME__";
    const realm = "__WARMANE_REALM__";
    const secretKey = "pizzaLogsAdminSecret";

    if (location.hostname !== "armory.warmane.com") {
      alert("Pizza Logs: open Warmane Armory first, then run the roster importer.");
      return;
    }

    const state = {
      running: false,
      panel: null as HTMLDivElement | null,
      status: null as HTMLDivElement | null,
      button: null as HTMLButtonElement | null,
    };

    const setStatus = function setStatus(message: string) {
      if (state.status) state.status.textContent = message;
    };

    const getSecret = function getSecret() {
      const saved = localStorage.getItem(secretKey);
      if (saved) return saved;
      const secret = prompt("Pizza Logs admin secret?");
      if (!secret) return null;
      localStorage.setItem(secretKey, secret);
      return secret;
    };

    const postJson = function postJson(url: string, body: unknown) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
      });
    };

    async function fetchRosterPayload() {
      try {
        const htmlResponse = await fetch("__GUILD_HTML_PATH__", {
          headers: { Accept: "text/html,application/xhtml+xml,*/*" },
        });
        if (!htmlResponse.ok) throw new Error(`Warmane HTML ${htmlResponse.status}`);
        return { html: await htmlResponse.text() };
      } catch (htmlError) {
        console.warn("Pizza Logs roster HTML fetch failed", htmlError);
      }

      const apiPaths = [
        "__SUMMARY_API_PATH__",
        "__MEMBERS_API_PATH__",
      ];

      for (const path of apiPaths) {
        try {
          const response = await fetch(path, { headers: { Accept: "application/json,text/plain,*/*" } });
          const data = await response.json();
          if (response.ok && !data.error) return { data };
        } catch (error) {
          console.warn("Pizza Logs roster JSON fetch failed", path, error);
        }
      }

      throw new Error("Warmane roster data was unavailable.");
    }

    async function runRosterSync() {
      if (state.running) return;
      const secret = getSecret();
      if (!secret) {
        setStatus("Admin secret is required.");
        return;
      }

      state.running = true;
      if (state.button) state.button.disabled = true;

      try {
        setStatus("Fetching Warmane roster...");
        const payload = await fetchRosterPayload();
        setStatus("Importing roster into Pizza Logs...");
        const result = await postJson(`${pizzaLogsOrigin}/api/admin/guild-roster/import`, {
          secret,
          guild: guildName,
          realm,
          ...payload,
        });
        setStatus(`Imported ${result.count} roster ${result.count === 1 ? "member" : "members"}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "Unauthorized.") localStorage.removeItem(secretKey);
        setStatus(`Roster sync failed: ${message}`);
      } finally {
        state.running = false;
        if (state.button) state.button.disabled = false;
      }
    }

    const buildPanel = function buildPanel() {
      if (state.panel) return;
      if (!document.body) {
        document.addEventListener("DOMContentLoaded", buildPanel, { once: true });
        return;
      }

      const panel = document.createElement("div");
      panel.style.cssText = [
        "position:fixed",
        "right:16px",
        "bottom:16px",
        "z-index:2147483647",
        "width:280px",
        "padding:12px",
        "background:#0b0d12",
        "border:1px solid #c9a227",
        "border-radius:6px",
        "box-shadow:0 12px 40px rgba(0,0,0,.45)",
        "color:#e8dcc0",
        "font:13px system-ui,sans-serif",
      ].join(";");

      const title = document.createElement("div");
      title.textContent = "Pizza Logs Roster Sync";
      title.style.cssText = "font-weight:700;color:#f1d36b;margin-bottom:6px";

      const status = document.createElement("div");
      status.textContent = "Open the Pizza Warriors guild page, then click Sync roster.";
      status.style.cssText = "line-height:1.35;color:#b8aa8c;margin-bottom:10px";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Sync roster";
      button.style.cssText = [
        "width:100%",
        "padding:8px 10px",
        "border:1px solid #c9a227",
        "border-radius:4px",
        "background:#151922",
        "color:#f1d36b",
        "cursor:pointer",
      ].join(";");
      button.addEventListener("click", runRosterSync);

      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset secret";
      reset.style.cssText = "margin-top:8px;width:100%;border:0;background:transparent;color:#8f836b;cursor:pointer";
      reset.addEventListener("click", () => {
        localStorage.removeItem(secretKey);
        setStatus("Secret cleared. Click Sync roster to enter it again.");
      });

      panel.append(title, status, button, reset);
      document.body.appendChild(panel);
      state.panel = panel;
      state.status = status;
      state.button = button;
    };

    buildPanel();

    const autoRunFlag: string = "__AUTO_RUN__";
    if (autoRunFlag === "true") {
      setTimeout(runRosterSync, 500);
    }
  };

  return `(${script.toString()
    .replace("__PIZZA_LOGS_ORIGIN__", PIZZA_LOGS_ORIGIN)
    .replaceAll("__DISPLAY_GUILD_NAME__", DISPLAY_GUILD_NAME)
    .replaceAll("__WARMANE_GUILD_NAME__", WARMANE_GUILD_NAME)
    .replaceAll("__WARMANE_REALM__", WARMANE_REALM)
    .replace("__SUMMARY_API_PATH__", `/api/guild/${WARMANE_GUILD_NAME}/${WARMANE_REALM}/summary`)
    .replace("__MEMBERS_API_PATH__", `/api/guild/${WARMANE_GUILD_NAME}/${WARMANE_REALM}/members`)
    .replace("__GUILD_HTML_PATH__", `/guild/${WARMANE_GUILD_NAME}/${WARMANE_REALM}/summary`)
    .replace("__AUTO_RUN__", String(autoRun))})();`;
}

export function buildGuildRosterBookmarklet(): string {
  return `javascript:${buildRosterScriptBody(true)}`;
}

export function buildGuildRosterUserscript(): string {
  return [
    "// ==UserScript==",
    "// @name         Pizza Logs Warmane Guild Roster Sync",
    "// @namespace    https://pizza-logs-production.up.railway.app",
    "// @version      1.0.2",
    "// @description  Sync Pizza Logs guild roster from Warmane Armory in-browser.",
    "// @match        https://armory.warmane.com/*",
    "// @match        http://armory.warmane.com/*",
    `// @downloadURL   ${GUILD_ROSTER_USERSCRIPT_URL}`,
    `// @updateURL     ${GUILD_ROSTER_USERSCRIPT_URL}`,
    "// @run-at       document-idle",
    "// @grant        none",
    "// ==/UserScript==",
    "",
    buildRosterScriptBody(false),
  ].join("\n");
}
