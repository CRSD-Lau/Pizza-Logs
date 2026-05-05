# Add character headshots

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-03
- Thread id: `019defb7-6b06-73f0-8d13-611b9f6339e0`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\03\rollout-2026-05-03T18-21-08-019defb7-6b06-73f0-8d13-611b9f6339e0.jsonl`
- Imported user turns: 11
- Imported assistant final replies: 9
- Tool/command events omitted: 426

## Discussion Digest

## User

You are working in my â€œPizza Logsâ€ project.

Goal:
Replace the initials box in the character header/card â€” currently showing something like â€œLIâ€ â€” with the characterâ€™s actual WoW headshot / portrait image when available.

Context:
The UI currently displays a character summary like:

- Name: Lichkingspet
- Race/class: Human Death Knight
- Level: 80
- Realm/server: Lordaeron
- Guild: PizzaWarriors
- Current icon square: initials fallback, e.g. â€œLIâ€

I want you to investigate and implement the best practical way to show the character headshot.

Possible data sources:
1. AzerothCore database
2. Warmane Armory, possibly through Tampermonkey if direct fetching/scraping is blocked by CORS or not feasible from the app

Tasks:

1. Inspect the codebase
   - Find the component/template responsible for rendering the character header/card.
   - Find where the initials square is generated.
   - Identify the character data object shape currently available to that component.
   - Determine whether we already have character name, realm, faction, race, class, gender, and/or GUID available.

2. Investigate AzerothCore DB feasibility
   - Check whether the AzerothCore characters/world DB contains enough data to derive or fetch a character headshot.
   - Look specifically at tables such as:
     - characters.characters
     - characters.character_inventory
     - characters.item_instance
     - world.item_template
     - any race/class/gender/display-related tables available in this project
   - Determine whether the DB stores only character metadata/equipment, or whether it exposes an actual portrait/headshot/image URL.
   - If the DB does not contain a ready-to-use image, explain what would be required to generate one, such as DBC data, model rendering, display IDs, or an external renderer.
   - Do not assume AzerothCore has a portrait URL unless verified in the schema or code.

3. Investigate Warmane Armory feasibility
   - Determine whether Warmane Armory exposes a character portrait/headshot image on the public character profile page.
   - Find the character armory URL pattern for realm + character name.
   - Check whether the portrait/headshot image is present as:
     - an `<img>` tag,
     - CSS background image,
     - Open Graph image,
     - canvas/rendered asset,
     - or some API/network response.
   - If direct app fetching is blocked by CORS, design a Tampermonkey-based approach using `GM_xmlhttpRequest`.
   - The Tampermonkey option should either:
     - inject portraits directly into Pizza Logs pages by matching character names/realms, or
     - scrape Warmane Armory portrait URLs and store/cache them for Pizza Logs to use.

4. Recommend the best implementation path
   Compare:
   - AzerothCore DB route
   - Warmane Armory route
   - Tampermonkey route
   - simple fallback to initials

   Consider:
   - reliability
   - implementation effort
   - CORS limitations
   - cacheability
   - whether portraits update when gear changes
   - whether this can work for all characters or only Warmane characters

5. Implement the chosen solution if feasible
   Requirements:
   - Preserve the initials fallback when no portrait is available.
   - Do not break the current character card layout.
   - Add a clean `avatarUrl` / `portraitUrl` field or equivalent rather than hard-coding image logic inside the visual component.
   - Add error handling for broken image URLs.
   - Cache portrait lookups where appropriate.
   - Avoid excessive requests to Warmane Armory.
   - Make the implementation easy to disable or configure.

6. If Tampermonkey is the best route, create a userscript
   The userscript should:
   - Run on the Pizza Logs domain/local URL.
   - Find character cards that still show initials.
   - Extract character name and realm from the DOM or embedded data.
   - Query Warmane Armory using `GM_xmlhttpRequest`.
   - Parse the portrait/headshot URL from the returned HTML.
   - Replace the initials square with an `<img>` element.
   - Cache results in `localStorage` or Tampermonkey storage.
   - Fall back to initials when no portrait is found.
   - Include comments showing how to update the Pizza Logs URL match pattern.

7. Deliverables
   Provide:
   - A concise explanation of what you found.
   - The recommended approach.
   - Code changes, if possible.
   - A Tampermonkey userscript if needed.
   - Any new config keys or environment variables.
   - Notes on limitations.

Important:
- Do not fabricate Warmane endpoints. Inspect the actual page/network/HTML structure where possible.
- Do not assume AzerothCore stores rendered character portraits.
- Prefer a robust fallback-based implementation:
  portrait image if available â†’ class/race icon if available â†’ initials.
- Keep the visual design consistent with the current dark UI.

Bias toward a Tampermonkey proof of concept first. I want the fastest working version that replaces the initials box with the Warmane Armory portrait on my existing Pizza Lo

[Truncated for vault import.]

## Assistant

Implemented the Tampermonkey-first proof of concept and the app-side cleanup.

What changed:
- Added reusable avatar rendering in [PlayerAvatar.tsx](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/components/players/PlayerAvatar.tsx:26) with `portraitUrl`, class-icon fallback, initials fallback, and broken-image handling.
- Updated the player profile shape to include `portraitUrl` in [player-profile.ts](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/lib/player-profile.ts:26).
- Replaced the initials boxes on `/players/[playerName]` and `/players` with `PlayerAvatar`.
- Added Warmane portrait helpers in [warmane-portrait.ts](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/lib/warmane-portrait.ts:27).
- Added a public Tampermonkey userscript route:
  - `/api/player-portraits/userscript.user.js`
  - source: [player-portrait-client-scripts.ts](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/lib/player-portrait-client-scripts.ts:16)

Findings:
- AzerothCore is not a practical portrait source. Its docs show character metadata/customization/equipment fields, not rendered portrait URLs: [characters](https://www.azerothcore.org/wiki/characters), [character_inventory](https://www.azerothcore.org/wiki/character_inventory), [item_instance](https://www.azerothcore.org/wiki/item_instance), [ChrRaces.dbc](https://www.azerothcore.org/wiki/chrraces).
- Warmane URL pattern is `https://armory.warmane.com/character/<name>/<realm>/summary`; public pages such as [this Warmane profile](https://armory.warmane.com/character/Section/Lordaeron/profile) confirm the pattern and profile metadata.
- Direct local server/headless requests to Warmane hit Cloudflare 403/challenge, so backend live-fetch is unreliable.
- I did not verify a static Warmane headshot URL in the extracted HTML. The userscript therefore tries static `<img>`, CSS background, meta image, and script-data patterns, then falls back to class icon/initials.

Verification:
- Passed: `tsc --noEmit`
- Passed: `eslint . --max-warnings=0`
- Passed: `tests/warmane-portrait.test.ts`
- Passed: `tests/player-portrait-client-scripts.test.ts`
- Passed: `tests/player-profile.test.ts`
- Passed: `tests/armory-gear-client-scripts.test.ts`
- `next build` passed once before the final legacy-DOM userscript fallback. A later rebuild was blocked by OneDrive `.next` reparse/cloud-file state; I did not delete generated `.next` without confirmation.

No new environment variables. Disable the portrait userscript with:
`localStorage.pizzaLogsWarmanePortraitsDisabled = "1"`

## User

we commit?

## User

did you push to git?

## Assistant

No, not committed and not pushed.

Current branch: `codex/pizza-logs-modernization`

There are uncommitted changes for the portrait POC, including app code, tests, and vault handoff docs. I stopped before staging/committing because the final `next build` rerun hit the local OneDrive `.next` reparse-file issue after the earlier successful build.

## User

so lets get it to git so i can deploy and test live.

## Assistant

Yes. Committed and pushed to `origin/main`.

Commit: `bd663f7 feat: add Warmane portrait userscript`

Live checks now pass:
- `https://pizza-logs-production.up.railway.app/api/player-portraits/userscript.user.js` returns HTTP 200
- `https://pizza-logs-production.up.railway.app/players/Lichkingspet` returns HTTP 200 and includes the new avatar data hooks

Verification before push:
- `tsc --noEmit` passed
- `eslint . --max-warnings=0` passed
- focused portrait/profile/userscript tests passed
- clean temp-copy `next build` passed with exit code 0

Install/test the userscript from:
`https://pizza-logs-production.up.railway.app/api/player-portraits/userscript.user.js`

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

where is the install userscript link on the admin page?

## Assistant

It wasnâ€™t there. I added it and pushed the fix.

Now go to:

`/admin` -> **Warmane Gear Cache** -> **Character Portraits** -> **Install / Update Portrait Userscript**

Pushed to `origin/main`:

`6379ca5 fix: expose portrait userscript on admin`

Verification:
- Type-check passed
- Lint passed
- `gear-import-bookmarklet.test.ts` passed
- Clean temp `next build` passed
- Portrait userscript route is live and returns HTTP 200

I couldnâ€™t directly inspect `/admin` HTML unauthenticated because production redirects `/admin` with HTTP 307, but the code is pushed and Railway served the public userscript route after deploy.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

i see you used classes... anyway you could get their actual ingame character face? like human dwarf etc and the style they used? also want it on the guild page too in the table and on the sessions pages where  you can deep dive on a specific player in the raid

## User

not sure where you are at following the compact since you keep flagging my chat for cyber security for no reason

## Assistant

Picked it back up after the compact and finished it.

Implemented and pushed `bffd27e` to `origin/main`: `feat: expand Warmane portrait avatars`.

What changed:
- Guild roster rows now use `PlayerAvatar` instead of initials.
- Session Raid Roster chips now include avatars.
- Session player deep-dive headers now use avatars.
- Portrait userscript bumped to `0.2.0`.
- Userscript now runs on Warmane character pages too and tries to cache the actual rendered character canvas/static portrait through Tampermonkey storage.
- Fallback remains: cached/real portrait -> class icon -> initials.

Verified:
- `tsc --noEmit` passed.
- ESLint passed.
- Focused avatar/userscript tests passed.
- Production build passed from temp copy.
- Pushed to GitHub and Railway is now serving userscript `0.2.0`.
- Production `/guild-roster` returned 137 avatar hooks.
- Production `/players/Maximusboom` has the avatar metadata and class-icon fallback live.

To test the real in-game face: go to `/admin`, install/update the Portrait Userscript, open that playerâ€™s Warmane profile once, then reload Pizza Logs. If Warmane blocks canvas export, it will still fall back cleanly to class icons/initials.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

how do i execute the protraits scrape?

## Assistant

The portrait scrape runs automatically. There is no button/panel for it yet.

Do this:

1. Make sure `Pizza Logs Warmane Portraits` is enabled in Tampermonkey.
2. Open a Warmane character page, like:
   `https://armory.warmane.com/character/Lausudo/Lordaeron/profile`
3. Wait a few seconds after the page/model loads.
4. Reload Pizza Logs:
   - `/players/Lausudo`
   - `/guild-roster`
   - raid session roster/player deep-dive pages

The script caches by `realm:name`, so each character needs their Warmane page opened once for the â€œactual faceâ€ attempt.

Important: the visible box in your screenshot is the Gear Sync script. Portraits currently run silently in the background. If Warmane blocks canvas export or does not expose a usable portrait image, Pizza Logs will stay on class icon/initials fallback.

## User

its still falling back to the class icons

## Assistant

I found the likely miss and pushed a fix.

The portrait script was only running on Warmane/Pizza Logs pages. If Warmane renders the model through a Wowhead/Zamimg modelviewer frame, the canvas is inside that frame, so the old script could not see it. I pushed Portrait Userscript `0.3.0` to production with modelviewer-frame capture support.

Do this now:

1. In Tampermonkey, update `Pizza Logs Warmane Portraits` to `0.3.0`.
   - Easiest: go to Pizza Logs `/admin` and click `Install / Update Portrait Userscript`.
2. Reload the Warmane character page.
3. Wait a few seconds for the modelviewer to load.
4. Reload `/players/Lausudo` or `/guild-roster`.

If it still falls back after `0.3.0`, then the modelviewer canvas is probably not readable due cross-origin browser protection. In that case Iâ€™ll add a visible portrait debug panel next so we can see exactly whether it found a frame, canvas, and whether `toDataURL()` is being blocked.

Pushed commit: `5484f35 fix: capture Warmane portraits from modelviewer frames`.

Sources I checked: [Wowhead Modelviewer Tutorial](https://www.wowhead.com/news/wowhead-modelviewer-tutorial-235544), [Warmane Armory profile example](https://armory.warmane.com/character/Pict/Icecrown/profile).

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

it was black once and then after reload it fellback to the class icons

## Assistant

That â€œblack onceâ€ was useful: it means the script did capture a canvas, but it was catching the modelviewer before it rendered anything useful.

I pushed `0.4.0` to production in commit `1d28336`. It now:

- rejects blank/black canvas captures
- rejects tiny canvas exports
- keeps retrying instead of caching black
- uses a new cache key so old bad captures are ignored

Production is already serving `0.4.0`.

Do this:

1. Update/reinstall `Pizza Logs Warmane Portraits` from `/admin`.
2. Open the Warmane character page again.
3. Wait until the character/model area is actually loaded, not just the gear list.
4. Reload Pizza Logs.

If it still stays on class icons after that, the next fix is adding a visible debug panel so we can see: modelviewer frame found, canvas found, canvas readable, blank rejected, or canvas blocked.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

Mixed Content: The page at '<URL>' was loaded over HTTPS, but requested an insecure element '<URL>'. This request was automatically upgraded to HTTPS, For more information see <URL>Understand this warning
Lausudo:1 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/inv_chest_plate_25.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:1 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/inv_shirt_guildtabard_01.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:1 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/inv_pants_plate_32.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:1 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/item_icecrownringd.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:2 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/inv_chest_plate_25.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:2 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/inv_shirt_guildtabard_01.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:2 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/inv_pants_plate_32.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.htmlUnderstand this warning
Lausudo:2 Mixed Content: The page at 'https://pizza-logs-production.up.railway.app/players/Lausudo' was loaded over HTTPS, but requested an insecure element 'http://cdn.warmane.com/wotlk/icons/large/item_icecrownringd.jpg'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.html

## Assistant

Fixed and pushed to `origin/main` at `753674f`.

What changed:
- Portrait userscript is now `0.5.0`.
- It rejects black WebGL/modelviewer captures by sampling through a scratch canvas.
- It uses a fresh cache key, `pizzaLogsWarmanePortraitCacheV3`, so old black/null portrait cache entries are ignored.
- Warmane gear icon URLs are normalized from `http://` to `https://`, including old cached `cdn.warmane.com` icon URLs.

Verified:
- Production userscript endpoint is now serving `@version 0.5.0`.
- `https://pizza-logs-production.up.railway.app/players/Lausudo` returns HTTP 200 and no longer has `http://cdn.warmane.com` in the rendered HTML.
- Focused tests, type-check, full ESLint, `git diff --check`, and clean temp production build passed.

To test portraits live: update/reinstall the Portrait userscript from `/admin`, open the Warmane character page once, wait for the modelviewer to render, then reload Pizza Logs.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}
