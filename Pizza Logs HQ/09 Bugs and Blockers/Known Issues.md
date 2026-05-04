# Known Issues

## Active Bugs

*(none)*

## Active External Blockers

| Blocker | Impact | Status |
|---|---|---|
| Warmane Armory returned Cloudflare/403 to direct server requests during gear and guild-roster feature work | Gear section shows unavailable state until a character has a cached snapshot; roster sync may fail from server/Railway, but `/guild-roster` still reads previously synced DB rows | Design written for laptop-primary Warmane sync agent so Railway no longer needs to fetch Warmane live. Existing hosted userscripts remain the temporary fallback. |
| Warmane character portraits may be canvas/model-only | Exact in-game faces require Warmane/Wowhead to expose a static portrait or allow the browser userscript to export the rendered modelviewer canvas. If the canvas is cross-origin tainted, never reaches a non-black render state, or no portrait-like asset exists, Pizza Logs must fall back to class icons/initials. | Portrait Userscript `0.5.0` runs on Pizza Logs, Warmane character pages, and Wowhead/Zamimg modelviewer frames, rejects blank/black WebGL canvas captures through scratch-canvas pixel sampling, caches static URLs or readable rendered canvas data through Tampermonkey storage, and needs normal-browser validation after deploy/local install. |
| Warmane API omits rich item details | Native gear cards need a second source for item stats and tooltip text | AzerothCore `item_template` backs item details; icon slugs still come from Warmane/Tampermonkey and are backfilled into `wow_items.iconName` when available |
| Manual Warmane roster/gear sync is operationally fragile | App data can become stale or incomplete if the admin forgets to run userscripts or if a partial source response is imported | Planned fix: local automated sync agent plus stricter snapshot validation that preserves last known good roster/gear data |

---

## Resolved (for reference)

| Bug | Fix | Commit |
|---|---|---|
| Upload cinematic overlay could be trapped below the sticky site header, making the intro feel less full-screen and risking hidden controls | `UploadCinematicIntro` now renders through a `document.body` portal; browser/CDP verified the overlay sits above the header and `Skip` is visible on desktop and mobile | this commit |
| Frozen Logbook intro was global, but the new cinematic request needed upload-page-only playback | Removed the layout-level `FrozenLogbookIntro`, added `UploadCinematicIntro` only to the Upload route (`/`), and verified `/players` does not mount the cinematic | this commit |
| Frozen Logbook intro was easy to miss because it only showed once per browser | Removed the normal `localStorage` gate, increased the normal duration to `3000ms`, and tied the overlay to `usePathname()` so it appears on initial load and every client-side route change | a499de0 |
| Shared reveal animations did not run in production because Tailwind purged dynamic helper classes | Added a Tailwind safelist for `reveal-item` and `boss-reveal-item`, plus source coverage in `tests/ui-animation.test.ts` | this commit |
| Player Recent Encounters and weekly Boss Kills This Week did not use ICC kill order | Added `buildPlayerRecentEncounters` and `buildWeeklyBossKills`; player recent encounters, `/weekly`, and `/api/weekly` now use the shared ICC progression order | this commit |
| Player profile Per-Boss Summary sorted bosses by best DPS instead of ICC kill order | Added `buildPlayerPerBossSummary` and wired `/players/<name>` to the shared ICC boss-order helper used by raid sessions and leaderboards | this commit |
| Hunter one-hand melee weapon gear cards and summary total used hunter-specific GearScoreLite weapon weighting | Added `displayItemScores` for raw per-item card display and removed hunter-only melee/ranged weighting from the total calculation so dual heroic Scourgeborne Waraxes count as `531` each; Titan Grip handling remains intact | this commit |
| AzerothCore thrown/ranged-right/relic item metadata imported with shifted equip locations | Corrected `InventoryType` mapping for 25/26/28 and added migration `20260504120000_repair_wow_item_ranged_relic_equip_locs` to repair existing `wow_items` rows | this commit |
| Raid session and leaderboard boss lists could display ICC bosses alphabetically instead of in kill order | Added shared ICC progression-order helpers in `lib/constants/bosses.ts`; `/leaderboards` and raid session displays now sort known ICC bosses from Lord Marrowgar through The Lich King, with normalization for common non-canonical labels | this commit |
| Main public pages crashed under the Next dev overlay when local Postgres was offline | `/`, `/players`, `/raids`, `/leaderboards`, `/bosses`, and `/weekly` now catch database connection failures, keep the shared header/search rendered, and show a Database unavailable warning | this commit |
| `/admin` crashed under the Next dev overlay when local Postgres was offline | Admin dashboard DB reads now fail gracefully with a Database unavailable warning while keeping the shared header/search rendered | this commit |
| Portrait userscript could cache a black WebGL modelviewer canvas | Portrait Userscript `0.5.0` samples the source canvas through a scratch 2D canvas, rejects unreadable/blank samples, and moved to `pizzaLogsWarmanePortraitCacheV3` so stale black/null captures are ignored | this commit |
| Player gear pages logged mixed-content warnings for Warmane CDN item icons | Imported and cached gear icon URLs are normalized from `http://` to `https://`, including old `http://cdn.warmane.com/...` cache snapshots read for display | this commit |
| Portrait userscript install link missing from `/admin` after portrait POC deploy | Added a Character Portraits section to the existing Warmane Gear Cache userscript card with install/update link and hosted URL | follow-up commit |
| Browser console logged `/favicon.ico` 404 on production player pages | Generated `public/favicon.ico` from the existing navigation logo SVG and kept `app/icon.svg` for Next metadata icons | 527c883 |
| Roster Sync userscript appeared on Warmane character pages where Gear Sync was expected | Gear userscript now matches/runs only on `/character/*`; roster userscript now matches/runs only on `/guild/*`; both bumped to v1.0.4 with runtime path guards | 1844c36 |
| Warmane Gear Sync userscript panel hidden after installing roster userscript | Roster userscript panel now docks above the Gear Sync panel instead of sharing `bottom:16px`; roster userscript bumped to v1.0.3 | 50d3d04 |
| Warriors with two two-handed weapons double-counted both weapon GearScores | `INVTYPE_2HWEAPON` normalization now assigns the first 2H to `Main Hand` and the second 2H to `Off Hand`, allowing the existing Titan Grip half-score modifier to apply | bd6dd3b |
| Guild roster Rank/Professions blank after sync | Warmane HTML roster can use guild-summary member links; parser now handles those links and `Image:` text, and roster sync/userscript prefer HTML first | ac5f754 |
| Roster-only members had no Pizza Logs player profile or gear queue entry | `/players/<name>` now resolves roster rows and the Warmane gear queue includes roster-only guild members | ac5f754 |
| Relics/ranged/wands displayed as Off Hand/trinkets and two-hander + relic characters got half GearScore | Slot labels are repaired from cached/static item metadata, the ranged/relic slot displays as `Ranged/Relic`, gear layout groups by slot name instead of array index, and Titan Grip half-score only applies to real weapon pairs | c33113b / bd6dd3b |
| Player gear slots showed names but no icon/item level/GearScore after import | Runtime item metadata now comes from AzerothCore `item_template`; icon-only gaps are queued for Warmane userscript backfill | 20786b4 / 3b98665 |
| Native gear tooltip clipped inside player profile Gear wrapper | Moved gear item tooltip rendering into a client-side `document.body` portal with fixed viewport positioning, viewport edge clamping, and top-level overlay z-index | 5fe9eca |
| Public UI exposed upload analytics and raw filenames | Moved upload history/detail into `/admin/uploads`, removed public nav/home/weekly upload telemetry, and redirected `/uploads` into admin | a3289d6 |
| Mobile layout issues on raids/leaderboards | Rebuilt mobile nav, stacked raid-session cards, and made leaderboard rows fit small screens without overflow | a3289d6 |
| HPS = 0 on all encounters | SPELL_HEAL length check was `< 15`, fixed to `< 11`; crit was `parts[14]`, fixed to `parts[13]` | c630c12 |
| Valithria both WIPEs | Added "Green Dragon Combat Trigger" death detection | c630c12 |
| False positive Sindragosa 10N | Added `total_damage == 0 and duration < 60` filter | c630c12 |
| Gunship adds triggering Saurfang KILL | Removed add NPC aliases from Gunship def | c630c12 |
| Gunship shows as WIPE | Added Gunship-specific kill detection (crew UNIT_DIED = KILL) mirroring Valithria pattern | TBD |
| Session total ~13M over Skada | Heal formula was using parts[11] (overheal) instead of parts[10]-parts[11] (gross-overheal). Fixed 2026-04-26. | 174255a |
| False Deathbringer Saurfang WIPE (230s) | Gunship wow_boss_id=37813 conflicted with Saurfang; removed Gunship aliases | 5340523 |
| Blood Prince Council kill duration wrong | boss_died_ts now checks aliases (Prince Valanar -> BPC) | 5340523 |
| TypeScript build error (UploadZone reset) | Missing `elapsed: 0` in reset state | 9e70a1e |
| DPS too low (post-fight tail) | Use boss death timestamp for KILL duration | 975756d |
| Class colors not showing | Parser never set `wow_class` - fixed with SPELL_CLASS_MAP | 975756d |
| UploadFile "read of closed file" | Write file to disk before returning StreamingResponse | c131a97 |
| Session total 3-6% below UWU | session_damage subtracted overkill; UWU counts amount+absorbed only | 08baacc/this |
| Alliance Gunship Cannon counted as pet (5.16M phantom S1) | 0xF150* vehicle GUIDs now excluded from is_pet check | this |
| SPELL_MISSED/SWING_MISSED ABSORB over-counted in session_damage | Removed MISSED ABSORB block; UWU gets correct total via amount+absorbed without overkill | this |

---

## Fixed (2026-05-02): Wowhead runtime dependency removed

### Fixed — 2026-05-02: Wowhead runtime dependency removed

**Problem:** Gear enrichment (item name, ilvl, quality, stats) depended on runtime Wowhead API calls, which fail due to Cloudflare blocking on Railway.

**Fix:** `lib/item-template.ts` and the AzerothCore `item_template.sql` importer now back `wow_items`. The deprecated runtime module and tests were removed in the Codex modernization cleanup. Import script: `npm run db:import-items`.

**Icon source:** zamimg CDN (`wow.zamimg.com`) — static, not a Wowhead API call. Icon slugs come from Warmane's API response.

**Known remaining gap:** Items not in `wow_items` table fall back gracefully to Warmane-supplied data rather than showing missing metadata.

## Fixed (2026-05-03): Gear cards with details but missing icons

**Problem:** Some player gear cards had item level, GearScore, and AzerothCore tooltip details, but no icon. Lausudo examples: `50024` Blightborne Warplate, `49964` Legguards of Lost Hope, `49985` Juggernaut Band.

**Root cause:** AzerothCore `item_template` has no icon slug. Icons only come from Warmane/Tampermonkey (`icon`/`iconUrl`) or previously seeded `wow_items.iconName`. The gear queue considered cached gear complete when `itemId`, `itemLevel`, and `equipLoc` existed, so icon-only gaps were not re-synced. Follow-up finding: Warmane API can omit icon fields for the same item IDs every time, while the browser page DOM still has item link images.

**Fix:** Missing `iconUrl` now marks cached gear as needing enrichment. Imported gear backfills `wow_items.iconName` from valid Zamimg URLs, preserving AzerothCore metadata. Hosted Warmane Gear Sync userscript `1.7.0` fetches each queued player's Warmane summary HTML, scrapes item links/images, and merges DOM-derived icon URLs into that player's API payload before posting.

**Operational note:** The fix is pushed in `origin/main` at `3b98665`. Install/update Gear Sync `1.7.0`, then run Warmane Gear Sync once from any Warmane character page so production can populate missing icon slugs for queued players.

### Follow-up: Maxximusboom not appearing in missing queue

**Problem:** Maxximusboom still showed icon gaps after other audited players were fixed, but `/api/admin/armory-gear/missing` did not return him.

**Root cause:** The missing-gear endpoint queried only the first 100 players and first 100 roster rows before filtering for missing gear. Players outside that pre-filter window could be broken but never queued.

**Fix:** Remove pre-filter `take: 100` from player/roster candidate queries and keep the existing post-filter batch limit. The sync still returns at most 100 missing players per run, but it now computes that batch from the full candidate set.

**Status:** Pushed to `origin/main` at `3b98665`. Production still needs one Warmane Gear Sync run to backfill icon slugs for queued players.

## Fixed (2026-05-02)

### [H3/H4] 25H/10H bosses showing as 25N/10N
**Root cause:** ENCOUNTER_START present with difficultyID=4 (25N). Heroic marker check was only running in the heuristic path (guarded by `if not boss_name:`).  
**Fix:** Heroic upgrade now runs regardless of ENCOUNTER_START.  
**Commit:** `babcca6 fix: run heroic detection even when ENCOUNTER_START is present`

### [H2] Gunship Battle showing as WIPE on kills
**Root cause:** `_gunship_crew` name set was incomplete (missing Skybreaker Mortar Soldier, Vindicator, Marksman, Kor'kron Reaver, Sergeant) and duplicated in two methods.  
**Fix:** Extracted `GUNSHIP_CREW_NAMES` module constant, expanded to 14 entries.  
**Commit:** `6c9ab28 fix: extract GUNSHIP_CREW_NAMES constant, expand crew coverage`

## Still Open

- **Absorbs (PW:S)** — Not tracked. Skada tracks in separate `actor.absorb` module. No ETA. Documented in `docs/parser-contract.md`.
- **Role detection** — Heuristic (healing ratio), not spec-based.
- **Damage mismatch vs uwu-logs** — Root cause: different encounter boundaries + uwu-logs may not subtract overkill. See `docs/parser-contract.md § Values That May Differ from uwu-logs`.
- **pet_remaps debug field** — DebugInfo.pet_remaps is always empty (placeholder). Populate from Pre-pass B in a future pass.
- **Gunship difficulty detection** — Gunship always inherits session difficulty (no heroic-exclusive spells). If run outside a confirmed H session it stays 25N.

---

## Known Limitations (not bugs, won't fix)

| Limitation | Reason |
|---|---|
| Heroic difficulty undetectable | Warmane uses same NPC/spell IDs for 25N and 25H; no ENCOUNTER_START difficulty flag |
| Gunship damage +/- small vs UWU | Persistent pets (Hunter beast, Warlock demon pre-summoned) have no SPELL_SUMMON - orphaned until resolved |
| HPS gap ~21-28% vs Skada | Parser matches Skada heal events exactly. Gap is Power Word: Shield absorbs - Skada tracks these separately in Absorbs.lua (not yet implemented) |
| DPS residual gap <1% vs Skada | Parser matches all Skada damage events. Sub-1% from orphaned pets (no SPELL_SUMMON before log start) |
| Progress bar fake before file received | File write to parser happens before SSE can start; first event is at 28% |
| Warmane gear enchants/gems depend on source availability | Warmane summary API equipment currently exposes item name/id/transmog in documented examples. AzerothCore fills static item metadata, but character-specific enchants and gems only display if Warmane includes them. |
| Warmane portraits are not in AzerothCore item metadata | The project imports AzerothCore `item_template` into `wow_items`, which can describe gear but does not include rendered character headshots. A real generated headshot would need character customization/equipment data plus DBC/model rendering or an external renderer. |
