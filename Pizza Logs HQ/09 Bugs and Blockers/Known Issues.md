# Known Issues

## Active Bugs

No confirmed app-breaking bugs are active as of the documentation audit.

## Active Limitations And Blockers

| Issue | Impact | Current approach |
|---|---|---|
| Upload route lacks hard server-side size enforcement | Large uploads can consume web/parser resources | Add streaming byte limit before or while forwarding to parser |
| Upload rate limiting is not implemented | Abuse could create parser/DB load | Prefer Railway-level controls first; add app logic only if needed |
| Absorbs are not implemented | Disc priest contribution can be lower than Skada combined healing+absorbs views | Future parser work based on Skada `Absorbs.lua`; keep separate from healing done |
| Role detection is rough | Hybrids/self-healing classes can be mislabeled; tanks are not inferred | Replace upload-time heal/damage ratio with better class/spec/combat evidence |
| Warmane direct server fetches can fail with Cloudflare/403 | Gear/roster refreshes are unreliable from Railway | Supported path is browser-assisted userscripts and cached DB snapshots |
| Some heroic/Gunship difficulty evidence is absent | Certain pulls cannot be classified perfectly from logs alone | Use direct marker evidence first; keep normal-looking non-Gunship fallback attempts normal; document uncertainty |
| Orphaned pets can remain unmatched | Small DPS mismatches when pets were active before log start | Keep Skada-aligned owner remap when summon evidence exists |

## Resolved Reference

| Issue | Resolution |
|---|---|
| HPS zero on all encounters | Fixed `SPELL_HEAL` field handling and effective heal formula |
| Post-fight tail lowered DPS | KILL duration now uses boss death timestamp |
| Valithria kills parsed as wipes | Green Dragon Combat Trigger death evidence added |
| Gunship kills parsed as wipes | Warmane crew-death override added |
| Gunship cannon counted as pet | `0xF15*` vehicle GUIDs excluded from pet handling |
| Public upload telemetry exposed raw filenames | Upload history/detail moved behind admin; public upload routes redirect |
| Admin had no auth | `ADMIN_SECRET`, middleware, login action, and admin API checks added |
| Runtime Wowhead item enrichment | Removed; local AzerothCore `wow_items` import backs item metadata |
| Gear cards had metadata but missing icons | Gear queue treats icon gaps as enrichment needs and backfills `wow_items.iconName` |
| Roster rank/professions were blank | Warmane HTML-first roster parsing handles guild-summary links and `Image:` labels |
| Roster-only members had no profiles | Player profiles can resolve from `guild_roster_members` |
| Hunter weapon GearScore display/total mismatch | Raw item display scores and hunter weapon total behavior corrected |
| Mixed-content gear icons | Warmane CDN icon URLs normalize to HTTPS |
| Favicon 404 | Added `public/favicon.ico` and `app/icon.svg` |
| Local dev DB outage crashed pages | Public/admin pages catch DB connection failures and show warnings |
| Local 3001 server missing `.next` chunks | Stopped stale Next process, removed generated `.next`, restarted `PizzaLogsLocalTestServer`, and verified local page/scripts return 200 |
| Portrait userscript stayed on class icons or caused hydration warnings | Retired active portrait capture and standardized avatars on class icons; old userscript URLs now serve no-op compatibility updates |
| Repeating local scheduled task caused recurring PowerShell popups | Disabled `PizzaLogsLocalTestServer`; added Desktop start/stop launchers for web, parser, and PostgreSQL |
| Parser silently skipped malformed lines | Added tokenizer-level skipped-line accounting and aggregate parser warnings |
| Parser `/parse-stream` accepted unsupported filenames | Added `.txt`/`.log` filename validation before temp-file handling |
| Short explicit marker pulls could be discarded | Marker-based encounters now bypass the heuristic minimum-event floor |
| Heroic wipes could promote later normal kills | Non-Gunship `25N` pulls no longer inherit heroic solely from same-session evidence |

## Not Bugs

- uwu-logs differences are expected when uwu uses different encounter windows or damage math.
- Warmane live fetch failure is expected; cached/browser-assisted import is the supported path.
- Rendered portraits are intentionally not used; class icons are the supported avatar path.
