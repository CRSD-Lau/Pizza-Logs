const PIZZA_LOGS_ORIGIN = "https://pizza-logs-production.up.railway.app";

function buildBookmarklet(): string {
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

    postJson(`${pizzaLogsOrigin}/api/admin/armory-gear/missing`, { secret })
      .then(async (queue) => {
        const players = queue.players || [];
        if (players.length === 0) {
          alert("Pizza Logs: no players need gear import or enrichment.");
          return;
        }

        let cached = 0;
        let failed = 0;

        for (const player of players) {
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
            cached++;
          } catch (error) {
            console.warn("Pizza Logs gear import failed", player, error);
            failed++;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        alert(`Pizza Logs: imported ${cached}; failed ${failed}.`);
      })
      .catch((error) => {
        alert(`Pizza Logs import failed: ${error.message}`);
      });
  };

  return `javascript:(${script.toString().replace("__PIZZA_LOGS_ORIGIN__", PIZZA_LOGS_ORIGIN)})()`;
}

function buildSingleBookmarklet(): string {
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

    fetch(`/api/character/${encodeURIComponent(characterName)}/${encodeURIComponent(realm)}/summary`, {
      headers: { Accept: "application/json,text/plain,*/*" },
    })
      .then(async (warmaneResponse) => {
        const warmaneData = await warmaneResponse.json();
        if (!warmaneResponse.ok || warmaneData.error) throw new Error(warmaneData.error || `Warmane HTTP ${warmaneResponse.status}`);

        return fetch(`${pizzaLogsOrigin}/api/admin/armory-gear/import`, {
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
      })
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

export function GearImportBookmarklet() {
  const bulkCode = buildBookmarklet();
  const singleCode = buildSingleBookmarklet();

  return (
    <div className="rounded border border-gold-dim bg-bg-card p-4 space-y-3">
      <div>
        <h3 className="heading-cinzel text-sm text-gold tracking-wide">Browser Gear Import</h3>
        <p className="text-sm text-text-secondary mt-1">
          Create a bookmark manually and paste the bulk code below as its URL. Open any Warmane Armory page, click that bookmark, enter the admin secret, and the browser will import missing Pizza Logs players through Warmane's API.
          Existing cached rows that do not have Wowhead item details will be re-imported and enriched too.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
        <li>Create a new browser bookmark named Pizza Logs Bulk Gear Import.</li>
        <li>Paste the full bulk bookmark URL below into the bookmark URL field.</li>
        <li>Open any Warmane Armory page and click the bookmark.</li>
        <li>Refresh this admin page and player profiles after the import completes.</li>
      </ol>
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-text-dim">
          Bulk bookmark URL
        </label>
        <textarea
          readOnly
          rows={4}
          value={bulkCode}
          className="w-full rounded border border-gold-dim bg-bg-deep p-3 font-mono text-xs text-text-secondary"
        />
      </div>
      <details className="text-sm text-text-secondary">
        <summary className="cursor-pointer text-gold hover:text-gold-light">Single-page fallback code</summary>
        <textarea
          readOnly
          rows={4}
          value={singleCode}
          className="mt-2 w-full rounded border border-gold-dim bg-bg-deep p-3 font-mono text-xs text-text-secondary"
        />
      </details>
    </div>
  );
}
