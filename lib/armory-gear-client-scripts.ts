export const PIZZA_LOGS_ORIGIN = "https://pizza-logs-production.up.railway.app";
export const USERSCRIPT_PATH = "/api/admin/armory-gear/userscript.user.js";
export const USERSCRIPT_URL = `${PIZZA_LOGS_ORIGIN}${USERSCRIPT_PATH}`;

export function buildBookmarklet(): string {
  const script = function pizzaLogsGearImport() {
    const pizzaLogsOrigin = "__PIZZA_LOGS_ORIGIN__";
    if (location.hostname !== "armory.warmane.com") {
      alert("Pizza Logs: open any Warmane Armory page first, then run this bookmarklet.");
      return;
    }

    const secret = prompt("Pizza Logs admin secret?");
    if (secret === null) return;

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

    const wait = function wait(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    };

    const importPlayer = async function importPlayer(player: { characterName: string; realm: string }) {
      let lastError = "Unknown error";

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const response = await fetch(`/api/character/${encodeURIComponent(player.characterName)}/${encodeURIComponent(player.realm)}/summary`, {
            headers: { Accept: "application/json,text/plain,*/*" },
          });
          const warmaneData = await response.json();
          if (!response.ok || warmaneData.error) throw new Error(warmaneData.error || `Warmane HTTP ${response.status}`);

          await postJson(`${pizzaLogsOrigin}/api/admin/armory-gear/import`, {
            secret,
            ...warmaneData,
            characterName: warmaneData.name || player.characterName,
            realm: warmaneData.realm || player.realm,
            sourceUrl: `https://armory.warmane.com/character/${encodeURIComponent(player.characterName)}/${encodeURIComponent(player.realm)}/summary`,
          });
          return;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.warn(`Pizza Logs gear import attempt ${attempt} failed`, player, error);
          if (attempt < 4) await wait(2500 * attempt);
        }
      }

      throw new Error(lastError);
    };

    postJson(`${pizzaLogsOrigin}/api/admin/armory-gear/missing`, { secret })
      .then(async (queue) => {
        const players = queue.players || [];
        if (players.length === 0) {
          alert("Pizza Logs: no players need gear import or enrichment.");
          return;
        }

        let cached = 0;
        const failed: string[] = [];

        for (const player of players) {
          try {
            await importPlayer(player);
            cached++;
          } catch (error) {
            console.warn("Pizza Logs gear import failed", player, error);
            failed.push(`${player.characterName}: ${error instanceof Error ? error.message : String(error)}`);
          }

          await wait(2000);
        }

        const failedPreview = failed.slice(0, 8).join("\n");
        const suffix = failed.length > 0
          ? `\n\nFailed after retries (${failed.length}):\n${failedPreview}${failed.length > 8 ? "\n..." : ""}`
          : "";
        alert(`Pizza Logs: imported ${cached}; failed ${failed.length}.${suffix}`);
      })
      .catch((error) => {
        alert(`Pizza Logs import failed: ${error.message}`);
      });
  };

  return `javascript:(${script.toString().replace("__PIZZA_LOGS_ORIGIN__", PIZZA_LOGS_ORIGIN)})()`;
}

export function buildSingleBookmarklet(): string {
  const script = function pizzaLogsSingleGearImport() {
    const pizzaLogsOrigin = "__PIZZA_LOGS_ORIGIN__";
    const pathMatch = location.pathname.match(/\/character\/([^/]+)\/([^/]+)\/summary/i);
    const characterName = pathMatch ? decodeURIComponent(pathMatch[1]) : prompt("Character name?");
    const realm = pathMatch ? decodeURIComponent(pathMatch[2]) : prompt("Realm?", "Lordaeron");

    if (!characterName || !realm) {
      alert("Pizza Logs: missing character name or realm.");
      return;
    }

    const secret = prompt("Pizza Logs admin secret?");
    if (secret === null) return;

    const wait = function wait(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    };

    const importCharacter = async function importCharacter() {
      let lastError = "Unknown error";

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const warmaneResponse = await fetch(`/api/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`, {
            headers: { Accept: "application/json,text/plain,*/*" },
          });
          const warmaneData = await warmaneResponse.json();
          if (!warmaneResponse.ok || warmaneData.error) throw new Error(warmaneData.error || `Warmane HTTP ${warmaneResponse.status}`);

          const response = await fetch(`${pizzaLogsOrigin}/api/admin/armory-gear/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret,
              ...warmaneData,
              characterName: warmaneData.name || characterName,
              realm: warmaneData.realm || realm,
              sourceUrl: location.href,
            }),
          });

          return response;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.warn(`Pizza Logs single gear import attempt ${attempt} failed`, error);
          if (attempt < 4) await wait(2500 * attempt);
        }
      }

      throw new Error(lastError);
    };

    importCharacter()
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
        alert(`Pizza Logs: imported ${data.itemCount} gear items for ${data.characterName}.`);
      })
      .catch((error) => {
        alert(`Pizza Logs import failed: ${error.message}`);
      });
  };

  return `javascript:(${script.toString().replace("__PIZZA_LOGS_ORIGIN__", PIZZA_LOGS_ORIGIN)})()`;
}

export function buildUserscript(): string {
  const script = function pizzaLogsWarmaneAutoSync() {
    const pizzaLogsOrigin = "__PIZZA_LOGS_ORIGIN__";
    const secretKey = "pizzaLogsAdminSecret";
    const lastRunKey = "pizzaLogsLastGearSyncAt";
    const autoIntervalMs = 60 * 60 * 1000;

    console.info("Pizza Logs userscript starting", {
      href: location.href,
      hostname: location.hostname,
      readyState: document.readyState,
    });

    if (location.hostname !== "armory.warmane.com") return;
    const isCharacterPage = /^\/character\/[^/]+\/[^/]+\/(summary|profile)\/?$/i.test(location.pathname);
    if (!isCharacterPage) return;

    const wait = function wait(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    };

    const state = {
      running: false,
      panel: null as HTMLDivElement | null,
      status: null as HTMLDivElement | null,
      button: null as HTMLButtonElement | null,
    };

    const setStatus = function setStatus(message: string) {
      if (state.status) state.status.textContent = message;
    };

    const buildPanel = function buildPanel() {
      if (state.panel) return;
      if (!document.body) {
        document.addEventListener("DOMContentLoaded", buildPanel, { once: true });
        return;
      }

      try {
      const panel = document.createElement("div");
      panel.style.cssText = [
        "position:fixed",
        "right:16px",
        "bottom:16px",
        "z-index:2147483647",
        "width:260px",
        "padding:12px",
        "background:#0b0d12",
        "border:1px solid #c9a227",
        "border-radius:6px",
        "box-shadow:0 12px 40px rgba(0,0,0,.45)",
        "color:#e8dcc0",
        "font:13px system-ui,sans-serif",
      ].join(";");

      const title = document.createElement("div");
      title.textContent = "Pizza Logs Gear Sync";
      title.style.cssText = "font-weight:700;color:#f1d36b;margin-bottom:6px";

      const status = document.createElement("div");
      status.textContent = "Ready";
      status.style.cssText = "line-height:1.35;color:#b8aa8c;margin-bottom:10px";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Sync now";
      button.style.cssText = [
        "width:100%",
        "padding:8px 10px",
        "border:1px solid #c9a227",
        "border-radius:4px",
        "background:#151922",
        "color:#f1d36b",
        "cursor:pointer",
      ].join(";");
      button.addEventListener("click", () => runSync(true));

      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset secret";
      reset.style.cssText = "margin-top:8px;width:100%;border:0;background:transparent;color:#8f836b;cursor:pointer";
      reset.addEventListener("click", () => {
        localStorage.removeItem(secretKey);
        localStorage.removeItem(lastRunKey);
        setStatus("Secret cleared. Click Sync now to enter it again.");
      });

      panel.append(title, status, button, reset);
      document.body.appendChild(panel);
      state.panel = panel;
      state.status = status;
      state.button = button;
      } catch (error) {
        console.error("Pizza Logs panel injection failed", error);
      }
    };

    const getSecret = function getSecret(forcePrompt: boolean) {
      const saved = localStorage.getItem(secretKey);
      if (saved && !forcePrompt) return saved;

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

    // Wowhead slotbak number → WoW INVTYPE_* string (matches lib/gearscore.ts WOWHEAD_INVENTORY_TYPES)
    const SLOT_MAP: Record<number, string> = {
      1: "INVTYPE_HEAD", 2: "INVTYPE_NECK", 3: "INVTYPE_SHOULDER", 4: "INVTYPE_BODY",
      5: "INVTYPE_CHEST", 6: "INVTYPE_WAIST", 7: "INVTYPE_LEGS", 8: "INVTYPE_FEET",
      9: "INVTYPE_WRIST", 10: "INVTYPE_HAND", 11: "INVTYPE_FINGER", 12: "INVTYPE_TRINKET",
      13: "INVTYPE_WEAPON", 14: "INVTYPE_SHIELD", 15: "INVTYPE_RANGED", 16: "INVTYPE_CLOAK",
      17: "INVTYPE_2HWEAPON", 20: "INVTYPE_ROBE", 21: "INVTYPE_WEAPONMAINHAND",
      22: "INVTYPE_WEAPONOFFHAND", 23: "INVTYPE_HOLDABLE", 25: "INVTYPE_THROWN",
      26: "INVTYPE_RANGEDRIGHT", 28: "INVTYPE_RELIC",
    };

    // Use GM_xmlhttpRequest when available so Wowhead isn't blocked by CORS/Cloudflare.
    const gmFetch = function gmFetch(url: string): Promise<string> {
      const gm = (globalThis as any).GM_xmlhttpRequest;
      if (gm) {
        return new Promise((resolve, reject) => {
          gm({
            method: "GET",
            url,
            headers: { Accept: "application/json" },
            timeout: 8000,
            onload:   (r: any) => resolve(r.responseText),
            onerror:  (r: any) => reject(new Error(`GM_xmlhttpRequest error: ${r.statusText}`)),
            ontimeout: ()      => reject(new Error("GM_xmlhttpRequest timeout")),
          });
        });
      }
      return fetch(url, { headers: { Accept: "application/json" } }).then(r => r.text());
    };

    // Enrich each gear item with itemLevel, equipLoc, and iconUrl from Wowhead tooltip JSON.
    // Railway is Cloudflare-blocked by Wowhead, so enrichment must happen browser-side here.
    const enrichItemsWithWowhead = async function enrichItemsWithWowhead(equipment: any[]): Promise<any[]> {
      const out: any[] = [];
      for (const item of equipment) {
        if (!item || !item.id) { out.push(item); continue; }
        try {
          const text = await gmFetch(`https://www.wowhead.com/wotlk/tooltip/item/${item.id}`);
          const json = JSON.parse(text);
          const jsonequip = (json.jsonequip && typeof json.jsonequip === "object") ? json.jsonequip : {};
          const slotbak: number | undefined = typeof jsonequip.slotbak === "number" ? jsonequip.slotbak : undefined;
          const ilMatch = typeof json.tooltip === "string"
            ? json.tooltip.match(/Item Level\s*(?:<!--[^-]*-->)?\s*(\d+)/i)
            : null;
          out.push({
            ...item,
            itemLevel: ilMatch ? Number(ilMatch[1]) : item.itemLevel,
            equipLoc:  slotbak !== undefined ? SLOT_MAP[slotbak] : item.equipLoc,
            iconUrl:   json.icon ? `https://wow.zamimg.com/images/wow/icons/large/${json.icon}.jpg` : item.iconUrl,
          });
        } catch {
          out.push(item);
        }
        await wait(300);
      }
      return out;
    };

    const importPlayer = async function importPlayer(player: { characterName: string; realm: string }, secret: string) {
      let lastError = "Unknown error";

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const response = await fetch(`/api/character/${encodeURIComponent(player.characterName)}/${encodeURIComponent(player.realm)}/summary`, {
            headers: { Accept: "application/json,text/plain,*/*" },
          });
          const warmaneData = await response.json();
          if (!response.ok || warmaneData.error) throw new Error(warmaneData.error || `Warmane HTTP ${response.status}`);

          // Enrich gear with Wowhead tooltip data (itemLevel, equipLoc, iconUrl) before posting.
          // This must happen client-side because Railway's server IPs are blocked by Cloudflare.
          if (Array.isArray(warmaneData.equipment) && warmaneData.equipment.length > 0) {
            setStatus(`Enriching ${player.characterName} (${warmaneData.equipment.length} items)...`);
            warmaneData.equipment = await enrichItemsWithWowhead(warmaneData.equipment);
          }

          await postJson(`${pizzaLogsOrigin}/api/admin/armory-gear/import`, {
            secret,
            ...warmaneData,
            characterName: warmaneData.name || player.characterName,
            realm: warmaneData.realm || player.realm,
            sourceUrl: `https://armory.warmane.com/character/${encodeURIComponent(player.characterName)}/${encodeURIComponent(player.realm)}/summary`,
          });
          return;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.warn(`Pizza Logs gear import attempt ${attempt} failed`, player, error);
          if (attempt < 4) await wait(2500 * attempt);
        }
      }

      throw new Error(lastError);
    };

    async function runSync(forcePrompt = false) {
      if (state.running) return;

      const secret = getSecret(forcePrompt);
      if (!secret) {
        setStatus("Admin secret is required.");
        return;
      }

      state.running = true;
      if (state.button) state.button.disabled = true;

      try {
        setStatus("Checking Pizza Logs queue...");
        const queue = await postJson(`${pizzaLogsOrigin}/api/admin/armory-gear/missing`, { secret });
        const players = queue.players || [];

        if (players.length === 0) {
          localStorage.setItem(lastRunKey, String(Date.now()));
          setStatus("No players need import or enrichment.");
          return;
        }

        let imported = 0;
        const failed: string[] = [];
        for (const player of players) {
          setStatus(`Importing ${player.characterName} (${imported + failed.length + 1}/${players.length})...`);
          try {
            await importPlayer(player, secret);
            imported++;
          } catch (error) {
            failed.push(`${player.characterName}: ${error instanceof Error ? error.message : String(error)}`);
          }
          await wait(2000);
        }

        localStorage.setItem(lastRunKey, String(Date.now()));
        setStatus(`Imported ${imported}; failed ${failed.length}${failed.length ? `. ${failed.slice(0, 3).join("; ")}` : "."}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "Unauthorized.") localStorage.removeItem(secretKey);
        setStatus(`Sync failed: ${message}`);
      } finally {
        state.running = false;
        if (state.button) state.button.disabled = false;
      }
    }

    buildPanel();

    const lastRun = Number(localStorage.getItem(lastRunKey) || "0");
    const hasSecret = Boolean(localStorage.getItem(secretKey));
    if (hasSecret && Date.now() - lastRun > autoIntervalMs) {
      setTimeout(() => runSync(false), 2500);
    } else if (!hasSecret) {
      setStatus("Click Sync now once to save the admin secret and enable auto-sync.");
    } else {
      setStatus("Auto-sync armed. Click Sync now to force a refresh.");
    }
  };

  return [
    "// ==UserScript==",
    "// @name         Pizza Logs Warmane Gear Auto Sync",
    "// @namespace    https://pizza-logs-production.up.railway.app",
    "// @version      1.3.0",
    "// @description  Automatically sync Pizza Logs gear cache from Warmane Armory pages.",
    "// @match        https://armory.warmane.com/character/*",
    "// @match        http://armory.warmane.com/character/*",
    `// @downloadURL   ${USERSCRIPT_URL}`,
    `// @updateURL     ${USERSCRIPT_URL}`,
    "// @run-at       document-idle",
    "// @grant        GM_xmlhttpRequest",
    "// ==/UserScript==",
    "",
    `(${script.toString().replace("__PIZZA_LOGS_ORIGIN__", PIZZA_LOGS_ORIGIN)})();`,
  ].join("\n");
}
