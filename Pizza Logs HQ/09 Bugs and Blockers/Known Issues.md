# Known Issues

## Active Bugs

*(none)*

## Active External Blockers

| Blocker | Impact | Status |
|---|---|---|
| Warmane Armory returned Cloudflare/403 to direct server requests during gear and guild-roster feature work | Gear section shows unavailable state until a character has a cached snapshot; roster sync may fail from server/Railway, but `/guild-roster` still reads previously synced DB rows | Design written for laptop-primary Warmane sync agent so Railway no longer needs to fetch Warmane live. Existing hosted userscripts remain the temporary fallback. |
| Warmane API omits rich item details | Native gear cards need a second source for icons, item level, quality, and tooltip text | Wowhead WotLK page enrichment added during cache writes; older cached rows are now re-queued for enrichment |
| Manual Warmane roster/gear sync is operationally fragile | App data can become stale or incomplete if the admin forgets to run userscripts or if a partial source response is imported | Planned fix: local automated sync agent plus stricter snapshot validation that preserves last known good roster/gear data |

---

## Resolved (for reference)

| Bug | Fix | Commit |
|---|---|---|
| Roster Sync userscript appeared on Warmane character pages where Gear Sync was expected | Gear userscript now matches/runs only on `/character/*`; roster userscript now matches/runs only on `/guild/*`; both bumped to v1.0.4 with runtime path guards | pending |
| Warmane Gear Sync userscript panel hidden after installing roster userscript | Roster userscript panel now docks above the Gear Sync panel instead of sharing `bottom:16px`; roster userscript bumped to v1.0.3 | pending |
| Warriors with two two-handed weapons double-counted both weapon GearScores | `INVTYPE_2HWEAPON` normalization now assigns the first 2H to `Main Hand` and the second 2H to `Off Hand`, allowing the existing Titan Grip half-score modifier to apply | pending |
| Guild roster Rank/Professions blank after sync | Warmane HTML roster can use guild-summary member links; parser now handles those links and `Image:` text, and roster sync/userscript prefer HTML first | pending |
| Roster-only members had no Pizza Logs player profile or gear queue entry | `/players/<name>` now resolves roster rows and the Warmane gear queue includes roster-only guild members | pending |
| Relics/ranged/wands displayed as Off Hand/trinkets and two-hander + relic characters got half GearScore | Slot labels are repaired from Wowhead `equipLoc`, the ranged/relic slot displays as `Ranged/Relic`, gear layout groups by slot name instead of array index, and Titan Grip half-score only applies to real weapon pairs | pending |
| Player gear slots showed names but no icon/item level/GearScore after import | Wowhead item fetches now retry transient failures, enrichment concurrency is capped, and fresh partial cache rows are re-enriched before player pages return them | pending |
| Native gear tooltip clipped inside player profile Gear wrapper | Moved gear item tooltip rendering into a client-side `document.body` portal with fixed viewport positioning, viewport edge clamping, and top-level overlay z-index | pending |
| Public UI exposed upload analytics and raw filenames | Moved upload history/detail into `/admin/uploads`, removed public nav/home/weekly upload telemetry, and redirected `/uploads` into admin | pending |
| Mobile layout issues on raids/leaderboards | Rebuilt mobile nav, stacked raid-session cards, and made leaderboard rows fit small screens without overflow | pending |
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
| Warmane gear enchants/gems depend on source availability | Warmane summary API equipment currently exposes item name/id/transmog in documented examples. Wowhead fills static item metadata, but character-specific enchants and gems only display if Warmane includes them. |
