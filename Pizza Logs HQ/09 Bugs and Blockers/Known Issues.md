# Known Issues

## Active Bugs

*(none)*

## Active External Blockers

| Blocker | Impact | Status |
|---|---|---|
| Warmane Armory returned Cloudflare/403 to direct server requests during gear feature work | Gear section shows unavailable state until a character has a cached snapshot; once cached, stale gear can still render | Browser bookmarklet import added for first-fill snapshots |
| Warmane API omits rich item details | Native gear cards need a second source for icons, item level, quality, and tooltip text | Wowhead WotLK page enrichment added during cache writes |

---

## Resolved (for reference)

| Bug | Fix | Commit |
|---|---|---|
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

## Known Limitations (not bugs, won't fix)

| Limitation | Reason |
|---|---|
| Heroic difficulty undetectable | Warmane uses same NPC/spell IDs for 25N and 25H; no ENCOUNTER_START difficulty flag |
| Gunship damage +/- small vs UWU | Persistent pets (Hunter beast, Warlock demon pre-summoned) have no SPELL_SUMMON - orphaned until resolved |
| HPS gap ~21-28% vs Skada | Parser matches Skada heal events exactly. Gap is Power Word: Shield absorbs - Skada tracks these separately in Absorbs.lua (not yet implemented) |
| DPS residual gap <1% vs Skada | Parser matches all Skada damage events. Sub-1% from orphaned pets (no SPELL_SUMMON before log start) |
| Progress bar fake before file received | File write to parser happens before SSE can start; first event is at 28% |
| Warmane gear enchants/gems depend on source availability | Warmane summary API equipment currently exposes item name/id/transmog in documented examples. Wowhead fills static item metadata, but character-specific enchants and gems only display if Warmane includes them. |
