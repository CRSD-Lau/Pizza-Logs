# Site And Ticket Audit

## Audit Snapshot

- Date: 2026-08-10
- Production: https://pizza-logs-production.up.railway.app
- Branch under review: `codex-dev`
- Production health score before fixes: 88/100
- Release-candidate health score after local fixes: 95/100

The production app is broadly usable. All primary public routes load, the admin
area fails closed to its login page, desktop and 375x812 mobile layouts remain
contained, and the important navigation, player search, roster pagination, and
report drill-down paths work. The score is held back by a confirmed production
hydration error and residual dependency advisories that require a later Next.js
major upgrade or another upstream backport.

## GitHub Tickets

| Ticket | State | Audit result |
|---|---|---|
| [#1 Normal vs Hardcore difficulty not correctly detected](https://github.com/CRSD-Lau/Pizza-Logs/issues/1) | Open | The current `codex-dev` implementation directly addresses the report. It classifies each pull independently, conflicts become `UNKNOWN`, and `test_heroic_wipe_then_normal_kill_keeps_normal_difficulty` proves a heroic wipe cannot promote a later normal kill. Keep open until the PR is merged, Railway deploys, and an affected log is re-uploaded. |
| [#2 Public upload analytics exposed filenames](https://github.com/CRSD-Lau/Pizza-Logs/issues/2) | Closed | Verified. `/uploads` and `/uploads/[id]` redirect to protected admin history; `/admin/uploads` redirects unauthenticated requests to `/admin/login`. |
| [#3 Mobile viewport](https://github.com/CRSD-Lau/Pizza-Logs/issues/3) | Closed | Verified at 375x812 on raids, leaderboards, players, bosses, and guild roster. There is no document-level horizontal overflow; the wide roster table scrolls only inside its container. The ticket's closure comment is stale because it repeats ticket #2's upload-privacy text. |

There were no open pull requests at the start of this audit. The most recent
`main` CI run visible on GitHub was successful, but the new parser/archive work
had not been pushed and therefore had no remote CI result yet.

## Production Route Audit

| Area | Result |
|---|---|
| Home and upload form | Passed; stats render, upload constraints are visible, and character name gates file selection |
| Raids and session pages | Passed; 10 sessions render and deep session/report links load |
| Leaderboards | Functional, but emits React hydration error #418 |
| Players and player search | Passed; 104 players render and search navigates to the selected profile |
| Guild roster | Passed; 194 members, 20 rows per page, URL-backed pagination, contained table scrolling |
| Weekly | Passed; current Aug 5-12 empty state is coherent with zero current-week kills |
| Boss index and boss detail | Index passed; boss detail is functional but shares the leaderboard hydration error |
| Encounter detail | Passed; metrics, damage/healing/target sections, roster, and links render |
| Player gear | Passed; cached gear and GearScoreLite-compatible score render on the Lausudo profile |
| Admin protection | Passed; unauthenticated admin and upload-history routes redirect to `/admin/login` |
| Desktop/mobile navigation | Passed; intro does not replay on client navigation and the mobile menu works |
| Accessibility basics | Passed on eight primary routes: one H1, no images missing `alt`, no unnamed controls, and no empty unnamed links |

## Confirmed Fixes In This Release Candidate

### Deterministic leaderboard dates

`LeaderboardBar` formatted dates in the server timezone and again in the browser
timezone. Encounters close to midnight therefore produced different text during
hydration. The shared formatter now pins the short date to UTC, and focused
coverage locks the boundary behavior.

### Next.js security backport

The project used Next.js 15.5.15. The production audit reported middleware and
server-action advisories, which are material because middleware protects the
admin surface. Next.js and its ESLint config are pinned to the current 15.x
backport, 15.5.23. The production build passes on that version.

The clean install also reconciled stale lockfile-only `cross-env` and `vitest`
entries that were not declared in `package.json` and were not used by project
scripts. A fresh `npm ci --legacy-peer-deps` reproduces the resulting lockfile.

## Validation

| Check | Result |
|---|---|
| UTC short-date focused test | Passed |
| Archive upload source contract | Passed |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Next.js production build | Passed on 15.5.23; 27 static pages generated |
| Parser suite | 280 passed; one existing Pydantic v2 deprecation warning |
| Python dependency consistency | `pip check` passed |
| Parser ticket regression | Heroic wipe followed by normal kill remains 25H then 25N |

## Remaining Risks And Follow-Up

- `npm audit --omit=dev` still reports four high-severity dependency entries:
  `nanoid`, Next.js through its bundled PostCSS, PostCSS itself, and Sharp. The
  direct Next.js 15 advisories are removed by 15.5.23, but clearing the remaining
  audit requires Next.js 16.3 or a future 15.x backport. A framework-major change
  should be isolated from this parser release.
- Production will continue to show the hydration error until Neil merges the PR
  and Railway deploys `main`.
- Ticket #1 should stay open until an affected combat log is re-uploaded after
  deployment, because existing encounter rows are not rewritten automatically.
- A real iPhone Safari and Android Chrome smoke check remains valuable after
  deployment even though the emulated 375x812 audit passed.
- Upload concurrency is process-local. A distributed limiter is only needed if
  the parser service runs multiple replicas or production traffic warrants it.
