# Application surface inventory

Author: Neil Mitchell

Last modified by: Neil Mitchell

Static route inventory reviewed during the acquisition audit. Dynamic parameters are shown in brackets. Admin page access is checked by proxy.ts and action authorization; public reports are intentionally readable. Retired userscript endpoints return inert retirement scripts, not credentials.

| Route | Kind / methods | Source |
|---|---|---|
| `/admin/login` | Page | `app/admin/login/page.tsx` |
| `/admin` | Page | `app/admin/page.tsx` |
| `/admin/uploads/[id]` | Page | `app/admin/uploads/[id]/page.tsx` |
| `/admin/uploads` | Page | `app/admin/uploads/page.tsx` |
| `/api/admin/armory-gear/userscript.local.user.js` | GET | `app/api/admin/armory-gear/userscript.local.user.js/route.ts` |
| `/api/admin/armory-gear/userscript.user.js` | GET (re-export) | `app/api/admin/armory-gear/userscript.user.js/route.ts` |
| `/api/admin/armory-gear/userscript` | GET | `app/api/admin/armory-gear/userscript/route.ts` |
| `/api/admin/guild-roster/userscript.local.user.js` | GET | `app/api/admin/guild-roster/userscript.local.user.js/route.ts` |
| `/api/admin/guild-roster/userscript.user.js` | GET (re-export) | `app/api/admin/guild-roster/userscript.user.js/route.ts` |
| `/api/admin/guild-roster/userscript` | GET | `app/api/admin/guild-roster/userscript/route.ts` |
| `/api/bosses` | GET | `app/api/bosses/route.ts` |
| `/api/encounters/[id]` | GET | `app/api/encounters/[id]/route.ts` |
| `/api/encounters` | GET | `app/api/encounters/route.ts` |
| `/api/guild-roster` | GET | `app/api/guild-roster/route.ts` |
| `/api/guild-roster/sync` | POST | `app/api/guild-roster/sync/route.ts` |
| `/api/health/ready` | GET | `app/api/health/ready/route.ts` |
| `/api/health` | GET | `app/api/health/route.ts` |
| `/api/leaderboard` | GET | `app/api/leaderboard/route.ts` |
| `/api/player-portraits/userscript.local.user.js` | GET | `app/api/player-portraits/userscript.local.user.js/route.ts` |
| `/api/player-portraits/userscript.user.js` | GET (re-export) | `app/api/player-portraits/userscript.user.js/route.ts` |
| `/api/player-portraits/userscript` | GET | `app/api/player-portraits/userscript/route.ts` |
| `/api/players/[name]/gear` | GET | `app/api/players/[name]/gear/route.ts` |
| `/api/players/[name]` | GET | `app/api/players/[name]/route.ts` |
| `/api/players/search` | GET | `app/api/players/search/route.ts` |
| `/api/upload` | POST | `app/api/upload/route.ts` |
| `/api/upload/status/[uploadId]` | GET | `app/api/upload/status/[uploadId]/route.ts` |
| `/api/weekly` | GET | `app/api/weekly/route.ts` |
| `/bosses/[bossSlug]` | Page | `app/bosses/[bossSlug]/page.tsx` |
| `/bosses` | Page | `app/bosses/page.tsx` |
| `/encounters/[id]` | Page | `app/encounters/[id]/page.tsx` |
| `/guild-roster` | Page | `app/guild-roster/page.tsx` |
| `/leaderboards` | Page | `app/leaderboards/page.tsx` |
| `/` | Page | `app/page.tsx` |
| `/players/[playerName]` | Page | `app/players/[playerName]/page.tsx` |
| `/players` | Page | `app/players/page.tsx` |
| `/raids/[id]/sessions/[sessionIdx]` | Page | `app/raids/[id]/sessions/[sessionIdx]/page.tsx` |
| `/raids/[id]/sessions/[sessionIdx]/players/[playerName]` | Page | `app/raids/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx` |
| `/raids` | Page | `app/raids/page.tsx` |
| `/uploads/[id]` | Page | `app/uploads/[id]/page.tsx` |
| `/uploads/[id]/sessions/[sessionIdx]` | Page | `app/uploads/[id]/sessions/[sessionIdx]/page.tsx` |
| `/uploads/[id]/sessions/[sessionIdx]/players/[playerName]` | Page | `app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx` |
| `/uploads` | Page | `app/uploads/page.tsx` |
| `/weekly` | Page | `app/weekly/page.tsx` |

Metadata routes: /robots.txt, /sitemap.xml, /manifest.webmanifest, /icon.svg. Canonical raid routes delegate to the upload/session implementation and retain legacy redirects.

## Server actions and parser endpoints

The built server-action manifest registers loginAdmin, clearDatabase, clearArmoryGearCache, deleteUpload and syncGuildRosterFromAdmin. Destructive actions validate the admin session. computeMilestones is an internal helper, not a remotely callable action. The public roster sync API checks the shared secret independently.

Parser: GET /health and GET /ready; POST /uploads/{upload_id}/stream; GET /uploads/{upload_id}. The /parse, /parse-debug and /parse-stream legacy routes are disabled by default. Parser docs are disabled by default. Never expose the parser directly to the public Internet; the web boundary performs public validation.

## Data lifecycle and scheduled work

Public upload bytes stream through web to parser-owned temporary files; validated analytics cross back through a bounded schema/transport and one serializable PostgreSQL transaction. Canonical session data and new parser provenance persist. Temporary bytes are deleted after workers exit. Progress expires in process memory. Public routes never provide raw uploads. Admin deletion cascades report-derived data; reference boss/realm/player/gear records have separate retention.

GitHub CI and CodeQL run on PRs/main and weekly schedules. Production Smoke runs after deployment events and weekly; pr-slack-notify is repository automation independent from local task notifications. Railway builds web/parser from main. start.sh adopts verified legacy migration records, then applies committed migrations before serving. No application cron job or durable parse queue is configured.

Egress: web -> internal parser, PostgreSQL, armory.warmane.com and Warmane API/CDN content. Browser may load permitted Warmane/CDN and Wowhead images/viewer assets under the existing CSP. GitHub, npm and PyPI are build/maintenance dependencies; normal report rendering does not call the UwU reference or GitHub.

See [architecture](overview.md), [threat model](../security/threat-model.md), [upload protocol](../archive-upload-protocol.md), and [service objectives](../operations/service-objectives.md).
