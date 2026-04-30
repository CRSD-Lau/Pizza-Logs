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
          alert("Pizza Logs: no uncached players found.");
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
  const href = buildBookmarklet();
  const singleHref = buildSingleBookmarklet();

  return (
    <div className="rounded border border-gold-dim bg-bg-card p-4 space-y-3">
      <div>
        <h3 className="heading-cinzel text-sm text-gold tracking-wide">Browser Gear Import</h3>
        <p className="text-sm text-text-secondary mt-1">
          Drag the bulk bookmarklet to your bookmarks bar, open any Warmane Armory page, then click it to import missing Pizza Logs players through Warmane's browser-accessible API.
        </p>
      </div>
      <a
        href={href}
        className="inline-flex rounded border border-gold-mid px-4 py-2 text-sm text-gold hover:border-gold hover:text-gold-light transition-colors"
      >
        Pizza Logs Bulk Gear Import
      </a>
      <a
        href={singleHref}
        className="ml-2 inline-flex rounded border border-gold-dim px-4 py-2 text-sm text-text-secondary hover:border-gold hover:text-gold-light transition-colors"
      >
        Single Page Fallback
      </a>
    </div>
  );
}
