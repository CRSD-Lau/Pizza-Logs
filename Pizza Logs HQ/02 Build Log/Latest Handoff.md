# Latest Handoff

## Date

2026-05-05

## Branch

`codex-dev`

## Current State

- Pizza Logs is Codex-first: work happens on `codex-dev`, then PRs go into `main`.
- Railway production deploys from `main` after Neil merges a PR.
- Live app: https://pizza-logs-production.up.railway.app
- Local Git executable fallback: `C:\Program Files\Git\cmd\git.exe`
- Parser correctness remains the highest-risk area.

## Current Implementation Snapshot

- Next.js app has public pages for upload, raids, sessions, encounters, bosses, leaderboards, players, guild roster, and weekly stats.
- `/uploads` and `/uploads/[id]` redirect to admin upload history; public raid/session pages use `/raids/...`.
- `/admin`, `/admin/uploads`, cleanup actions, and admin import APIs are protected by `ADMIN_SECRET`.
- Upload flow streams multipart data from `app/api/upload/route.ts` to parser `/parse-stream`, then writes database rows and milestones.
- Parser supports both encounter marker and heuristic segmentation paths.
- Warmane heroic/Gunship behavior is handled with marker/session/crew-death evidence where available, but some cases remain impossible to prove from logs alone.
- Gear pages read cached Warmane snapshots, enrich from local AzerothCore `wow_items`, and attempt Warmane live fetches only as best effort.
- Supported roster/gear/portrait refresh path is browser-assisted userscripts from `/admin`.

## Documentation Audit Changes This Session

- Rewrote root README, contributor workflow, security policy, branch workflow docs, and review checklist around the current `codex-dev -> PR -> main` process.
- Removed duplicate or historical-only docs:
  - blank vault inbox capture note;
  - completed cinematic Superpowers spec and plan;
  - duplicate AI prompt/skill reference notes;
  - old growth/business note;
  - separate backlog and technical-debt docs now consolidated into `Feature Status`.
- Updated vault architecture, deployment, security, parser, current-focus, and known-issues notes to match current code.
- Corrected stale direct-`main` deploy language.
- Corrected stale claims that heroic and Gunship behavior are completely undetectable.
- Documented open repo issues found during audit: upload lacks hard server-side size enforcement, and some env/example variables had drifted from actual code usage.

## Verification To Run Before PR

`npm` is not on PATH in this Windows shell, so equivalent bundled Node/Python entry points were used.

| Check | Result |
|---|---|
| ESLint via bundled Node | Passed |
| TypeScript `tsc --noEmit` via bundled Node | Passed |
| Parser tests via bundled Python | 123 passed |
| Next production build via bundled Node | Passed |
| Markdown stale-reference scan | No broken wiki links; only valid `do not push main` guardrail remained |
| `git diff --check` | Passed |

## Exact Next Step

Review the `codex-dev -> main` documentation cleanup PR and merge when ready. If the branch has not yet been published in the current run, commit the scoped cleanup, push `origin/codex-dev`, and open that PR first.
