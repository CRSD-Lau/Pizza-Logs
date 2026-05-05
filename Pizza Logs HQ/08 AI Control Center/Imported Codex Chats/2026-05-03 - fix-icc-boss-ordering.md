# Fix ICC boss ordering

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-03
- Thread id: `019df0de-35c8-7d02-834b-0be56d3eef55`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\03\rollout-2026-05-03T23-43-07-019df0de-35c8-7d02-834b-0be56d3eef55.jsonl`
- Imported user turns: 4
- Imported assistant final replies: 4
- Tool/command events omitted: 157

## Discussion Digest

## User

You are working in my Pizza Logs project.

Enhancement:
Fix boss ordering across:
- Raid Sessions page
- Leaderboards page

Current problem:
Bosses are being displayed alphabetically.

Expected behavior:
Bosses must be displayed in canonical Icecrown Citadel progression order (kill order), from Marrowgar to The Lich King.

Target order (authoritative):
1. Lord Marrowgar
2. Lady Deathwhisper
3. Gunship Battle
4. Deathbringer Saurfang
5. Festergut
6. Rotface
7. Professor Putricide
8. Blood Prince Council
9. Blood-Queen Lana'thel
10. Valithria Dreamwalker
11. Sindragosa
12. The Lich King

Tasks:

1. Codebase discovery
   - Locate where boss lists are generated for:
     - Raid Sessions page
     - Leaderboards page
   - Identify whether sorting is:
     - frontend-only (array sort)
     - backend/API-driven
     - database query ORDER BY
   - Identify boss name source (combat log parser output vs normalized table).

2. Introduce canonical ordering
   - Create a single source of truth for boss order.
   - Prefer a constant or config, for example:
     - `BOSS_ORDER_ICC`
   - Map boss name â†’ numeric order index.
   - Do not rely on string comparison.

   Example structure:
   ts
   const ICC_BOSS_ORDER = {
     "Lord Marrowgar": 1,
     "Lady Deathwhisper": 2,
     "Gunship Battle": 3,
     "Deathbringer Saurfang": 4,
     "Festergut": 5,
     "Rotface": 6,
     "Professor Putricide": 7,
     "Blood Prince Council": 8,
     "Blood-Queen Lana'thel": 9,
     "Valithria Dreamwalker": 10,
     "Sindragosa": 11,
     "The Lich King": 12,
   }
Apply sorting logic
Replace all alphabetical sorts with order-based sorting using the mapping.
Sorting rule:
Primary: ICC_BOSS_ORDER[name]
Secondary fallback: original index or alphabetical if boss not in map
Ensure stable sorting.
Data normalization
Validate boss names coming from parser:
Ensure they match keys in the map.
If inconsistencies exist (e.g., â€œGunshipâ€, â€œGunship Battle - Allianceâ€), normalize before sorting.
Add a normalization helper if required.
Backend vs frontend decision
If boss data is reused across multiple views:
Prefer sorting at the API/backend level.
If views are independent:
Apply consistent sorting utility used by both pages.
Edge cases
Unknown bosses:
Appear after known ICC bosses.
Partial raids:
Preserve correct relative order of encountered bosses.
Duplicate entries:
Maintain correct grouping and ordering.
Testing
Verify ordering:
Full ICC clear
Partial clears
Mixed raid uploads
Confirm both:
Raid Sessions page
Leaderboards page
show identical correct ordering.
Ensure no regression in rendering or grouping.
Refactor
Avoid duplicating ordering logic.
Extract reusable utility, for example:
sortBossesByICCOrder(bosses: Boss[]): Boss[]
Documentation
Add a short comment explaining:
Why alphabetical sorting is incorrect
Why ICC-specific ordering is enforced
Keep it concise.

Constraints:

Do not break existing UI structure.
Do not hardcode sorting separately in multiple files.
Keep implementation minimal and maintainable.

Deliverables:

Files modified
Where ordering is applied (frontend/backend)
Any normalization added
Confirmation both pages now render correct kill order

## Assistant

Implemented.

Files changed:
- [lib/constants/bosses.ts](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/lib/constants/bosses.ts:85) adds `ICC_BOSS_ORDER`, normalization, and stable sorting helpers.
- [app/leaderboards/page.tsx](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/app/leaderboards/page.tsx:16) now fetches by DB `sortOrder` and applies `sortBossesByICCOrder`.
- [app/uploads/[id]/sessions/[sessionIdx]/page.tsx](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/app/uploads/[id]/sessions/[sessionIdx]/page.tsx:52) now displays session encounters in ICC kill order.
- [app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/app/uploads/[id]/sessions/[sessionIdx]/players/[playerName]/page.tsx:45) now keeps the player session breakdown/chart in the same order.
- [tests/boss-order.test.ts](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/tests/boss-order.test.ts:10) covers full ICC, partial clears, mixed uploads, duplicates, normalization, and seeded boss-name alignment.
- Updated required vault docs: Latest Handoff, Now, Known Issues.

Ordering is applied server-side in the rendered page data path. Boss names come from parser canonical `BossDef.name`, then upload maps `bossName` into the normalized `bosses` table. I added normalization for Gunship variants, `Lich King`/`Arthas`, and Blood-Queen Lanaâ€™thel variants.

Verification:
- `tests/boss-order.test.ts` passed
- `tsc --noEmit` passed
- focused ESLint passed
- `git diff --check` passed

## User

push to git update your agent to always push to git please i dont test locally

## Assistant

Pushed.

Committed `f226e17` (`fix: order ICC bosses by progression`) and pushed it to both:
- `origin/codex/pizza-logs-modernization`
- `origin/main`

I also updated [AGENTS.md](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/AGENTS.md:13) so future validated change sessions default to commit + push unless you explicitly ask to keep work local.

Validation passed:
- `tests/boss-order.test.ts`
- `tsc --noEmit`
- full ESLint
- `next build`
- parser suite: `123 passed`
- staged secret scan
- `git diff --check`

Working tree is clean.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex/pizza-logs-modernization"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

can we fix up the summary section for players as well and sort those in the same order

## Assistant

Fixed and pushed.

`/players/<name>` Per-Boss Summary now uses `buildPlayerPerBossSummary()` in [lib/player-profile.ts](/C:/Users/neil_/OneDrive/Desktop/PizzaLogs/lib/player-profile.ts:74), which applies the shared ICC ordering helper. The player page no longer sorts those cards by best DPS.

Pushed commit `47e18dc` to:
- `origin/codex/pizza-logs-modernization`
- `origin/main`

Validation passed:
- `tests/player-profile.test.ts`
- `tests/boss-order.test.ts`
- `tsc --noEmit`
- full ESLint
- `next build`
- parser suite: `123 passed`
- staged secret scan
- `git diff --check`

Only remaining local changes are unstaged Obsidian UI files: `.obsidian/graph.json` and `.obsidian/workspace.json`.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex/pizza-logs-modernization"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

I want to also sort players recent encournters and this weeks boss kills this week

## Assistant

Implemented and pushed to `origin/main`.

Commit: `1e8405d` (`fix: order weekly and player encounter lists`)

What changed:
- Player Recent Encounters now sorts the recent 20 encounter window by ICC progression order.
- `/weekly` Boss Kills This Week now sorts by ICC progression order instead of kill count.
- `/api/weekly` uses the same weekly boss-kill ordering helper.
- Added tests for both paths.

Validation passed:
- `tests/player-profile.test.ts`
- `tests/weekly-stats.test.ts`
- `tests/boss-order.test.ts`
- `tsc --noEmit`
- full ESLint
- `next build`
- parser suite: `123 passed`
- staged secret scan
- `git diff --check`

Working tree is clean.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}
