# Audit and clean Pizza Logs repo

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-03
- Thread id: `019deec3-3867-7a50-9483-40a3ea3c9122`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\03\rollout-2026-05-03T13-54-24-019deec3-3867-7a50-9483-40a3ea3c9122.jsonl`
- Imported user turns: 4
- Imported assistant final replies: 4
- Tool/command events omitted: 391

## Discussion Digest

## User

You are a senior staff engineer, repo maintainer, release engineer, documentation owner, product-aware technical lead, and Codex workflow specialist.

You are working on the Pizza Logs project.

Project context:
- Pizza Logs is a web app for parsing and analyzing World of Warcraft combat logs.
- The current product focus is Warmane / WotLK 3.3.5a combat logs.
- The repo may include:
  - parser package
  - web app
  - upload/report logic
  - admin pages
  - analytics
  - documentation
  - Railway deployment configuration
  - GitHub repo docs/workflows
- Railway auto-deploys from main, so pushing to main is a production-affecting action.

Your mission is to bring the entire Pizza Logs repository up to date, remove Claude-specific artifacts, migrate the repo and docs to a Codex-first workflow, remove stale/dead code, simplify clearly overengineered areas, update docs, update Git hygiene, run validation, and commit/push to main only after the repo is production-ready.

Do not stop until the repository has been audited, cleaned, documented, tested, and prepared for safe deployment.

Use all available Codex capabilities, including:
- codebase-wide search
- terminal commands
- tests
- linters
- type checking
- static analysis
- dependency analysis
- Git inspection
- documentation review
- Codex skills/plugins if available
- subagents or parallel workstreams if available

Before starting, inspect available Codex skills/plugins.

Use any relevant skills/plugins for:
- repository audit
- stale-code cleanup
- TypeScript/JavaScript analysis
- parser validation
- documentation refresh
- Git hygiene
- security/secret scanning
- test generation
- GitHub PR/review preparation
- Railway deployment readiness review

Do not install or enable risky plugins.
Do not use plugins that require secrets unless the repo already has safe secret configuration.
Document which skills/plugins were used and why.

If true subagents are available, use them.
If true subagents are not available, simulate subagents by running the workstreams sequentially and clearly reporting findings by workstream.

---

## Production Deployment Rule

Because Railway auto-deploys from main:

- Work on a temporary branch first.
- Run all checks on the branch.
- Only merge/commit/push to main after validation passes.
- Do not push to main if tests fail, build fails, parser validation fails, secret scan fails, or risky files are detected.
- Do not change Railway production environment variables.
- Do not commit `.env` files.
- Do not commit production secrets.
- Do not alter deployment behavior unless required and documented.
- If database migrations exist, inspect them and document deployment risk before pushing main.
- If the deployment is risky, stop before pushing main and provide exact findings.

Temporary branch name:

codex/pizza-logs-modernization

Final target branch:

main

---

## Primary Objectives

1. Audit the entire Pizza Logs codebase.
2. Remove Claude-specific files, references, configs, prompts, commands, scripts, docs, workflows, and local agent instructions.
3. Replace Claude workflow documentation with Codex-first workflow documentation.
4. Add or update repo-specific Codex guidance in AGENTS.md.
5. Add Codex review guidance.
6. Add Codex skills/plugins usage guidance if appropriate.
7. Remove genuinely stale, unused, duplicate, dead, unreachable, or obsolete code.
8. Refactor clearly overengineered or unnecessary code only when safe and justified.
9. Preserve Pizza Logs product behavior, especially combat log parser correctness.
10. Update all documentation:
    - README
    - app/package READMEs
    - docs
    - setup guides
    - parser docs
    - architecture docs
    - contribution docs
    - testing docs
    - deployment docs
    - Railway docs
    - agent instructions
    - workflow docs
11. Review every modified, untracked, and ignored file.
12. Stage every safe project file that belongs in Git.
13. Add dangerous/private/generated/local files to `.gitignore`.
14. Run all reasonable checks.
15. Commit to the modernization branch.
16. Merge/commit/push to main only after all production-readiness gates pass.

---

## Aggressiveness Rule

Bias toward completing the cleanup, not merely reporting it.

If a Claude artifact is clearly obsolete, remove it.
If a doc is stale, rewrite it.
If a script references removed tooling, update or delete it.
If a dependency is unused, remove it and update the lockfile.
If a file is safe and useful to the project, stage it.
If a file is dangerous/private/generated/local, add it to `.gitignore`.
If a workflow is stale or broken, fix or remove it.
If a redundant abstraction is clearly unnecessary, simplify it.
If duplicate code can be safely consolidated, consolidate it.
If generated/cache/build files are accidentally tracked, remove them from Git tracking and add ignore rules.

Do not leave obvious cleanup for later.

However, Pizza Logs parser correctness overrides cleanup aggressiveness.

Never delete or s

[Truncated for vault import.]

## Assistant

Completed and pushed.

1. Branch used: `codex/pizza-logs-modernization`
2. Main updated: yes
3. Main pushed: yes, `origin/main`
4. Railway risk: low. No Railway env was changed. Production requires `ADMIN_SECRET`; do not set `ADMIN_COOKIE_SECURE=false` in Railway. No new Prisma migration was added.
5. Work completed: repo audit, Claude artifact removal, Codex migration, docs refresh, stale-code cleanup, admin auth hardening, lint/build tooling repair, Git hygiene, validation, merge, push.
6. Architecture confirmed: Next.js 15 web/API app, Prisma/Postgres, Python FastAPI parser, Railway Web Service + `parser-py`.
7. Claude removed: `CLAUDE.md`, `.claude/launch.json`, Claude vault docs/prompts, stale Superpowers copied docs/plans.
8. Codex added/updated: [AGENTS.md](C:/Users/neil_/OneDrive/Desktop/PizzaLogs-main-queue-fix/AGENTS.md), Codex vault docs, [docs/code-review.md](C:/Users/neil_/OneDrive/Desktop/PizzaLogs-main-queue-fix/docs/code-review.md), README/CONTRIBUTING/SECURITY/Railway docs.
9. Skills/plugins used: Superpowers skills for startup, planning, parallel-agent work, verification, debugging; GitHub `yeet` guidance; Codex Security scan guidance; true subagents for inventory/product/docs/security/review.
10. `AGENTS.md`: now covers setup, dev/test/build, parser safety, Railway, secrets, stale-code deletion, review checklist, and â€œdo not break combat log parsing.â€
11. Codex review guidance: added `@codex review` guidance and pre-main checklist.
12. Stale code removed: deprecated Wowhead runtime enrichment module/tests, duplicate parser `/parse-stream` progress block, stale copied Superpowers docs.
13. Refactors: shared `lib/admin-auth.ts`, safer admin login cookie, generic item-template gearscore naming, ESLint CLI config.
14. Dependencies: no package dependencies removed; proven stale runtime code removed without lockfile dependency churn.
15. Scripts: `lint` now uses `eslint . --max-warnings=0`; added `eslint.config.mjs`.
16. Docs: README, CONTRIBUTING, SECURITY, Railway/env/vault docs updated.
17. `.gitignore`/`.dockerignore`: added local agent/build/log/combat-log/cache hygiene; removed accidental `{` pattern.
18. Parser validation: `123 passed`.
19. Web tests/build: TypeScript tests `14 passed`; lint passed; `tsc --noEmit` passed; `next build` passed.
20. Production/Railway checks: production build passed. Docker/compose could not run because Docker is not installed.
21. Secret scan: passed; only placeholders/local compose values found. Ignored `.env.local` and `.env.sync-agent` were not staged.
22. Main checks run: parser tests, TS tests, lint, typecheck, production build, diff check, staged secret scan, live HTTP 200 check.
23. Known remaining issues: Railway CLI is not installed locally, so logs were not checked. Manual production env confirmation for `ADMIN_SECRET` is still required.
24. Claude refs retained: only defensive ignore patterns for legacy local `.claude` paths and historical handoff text explaining removal.
25. Stale candidates retained: parser heuristic complexity and known parser/product debt retained unless fixture-backed changes prove safe.
26. Risky files excluded: `.env.local`, `.env.sync-agent`, logs, `.next`, `node_modules`, `WoWCombatLog`, pytest cache.
27. Git status: clean on `main`; `origin/main` matches local `main`.
28. Modernization commit: `2360f64`
29. Main commit: `3b98665`
30. PR: none; pushed directly to `main` per deploy rule.

::git-create-branch{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex/pizza-logs-modernization"}
::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs-main-queue-fix"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs-main-queue-fix" branch="main"}

## User

checking in. where are we?

## Assistant

Weâ€™re deployed.

`main` is pushed to `origin/main` at `3b98665`, and the main worktree is clean. Railway should have auto-deployed from that push. I also checked the live site and got HTTP 200.

What landed:
- Codex-first repo/docs migration.
- Claude tracked artifacts removed.
- Stale Wowhead runtime code/tests removed.
- Admin auth hardened: production fails closed without `ADMIN_SECRET`; admin cookie is `HttpOnly`.
- Parser behavior preserved; no broad parser rewrite.
- Maxximusboom gear sync queue fix preserved from main.

Validation passed before push:
- Parser: `123 passed`
- TS tests: `14 passed`
- Lint: passed
- Typecheck: passed
- Next production build: passed
- Secret scan: placeholders only, no production secrets staged

One caveat: Railway CLI is not installed locally, so I couldnâ€™t inspect Railway deploy logs from the terminal. Also, the main vault handoff says â€œcommit/push nextâ€ because it was written just before the final push; git is the source of truth here: `origin/main` is already at `3b98665`.

## User

is the progress on the right actually happening?

## Assistant

No. That right-side Progress panel is stale UI state, not an active background job.

Actual state:
- The modernization work is done.
- `main` was pushed to `origin/main` at `3b98665`.
- The main worktree is clean.
- Validation passed before push.
- Live site returned HTTP 200.

Whatâ€™s stale:
- The right progress checklist was not updated to mark later phases complete.
- The default vault copy also has slightly stale â€œnext stepâ€ text because the final push happened from the separate main worktree.

So there is no hidden work currently progressing there. The remaining real follow-ups are manual production checks: confirm Railway has `ADMIN_SECRET`, check deploy logs if you have Railway access, then run/verify the Warmane Gear Sync flow.

## User

ok just bring all the docs up to speed and mds up to speed im stepping away

## Assistant

Docs are now up to speed and pushed.

Updated:
- `Latest Handoff.md` and `Now.md` now reflect that `main` is already pushed.
- Backlog, Feature Status, Technical Debt, Security Checklist, and Known Issues now reflect shipped admin auth, footer text, cleanup actions, Gear Sync `1.7.0`, and the Maxximusboom queue fix.
- Removed stale â€œcommit/push next,â€ â€œpending,â€ â€œadmin auth future,â€ and â€œfooter bugâ€ doc language.
- Fast-forwarded the local default worktree too, so future Codex startup reads current vault files.

Pushed docs-only commit: `add925a` on `origin/main`.

Verification:
- `git diff --check` passed.
- Stale Markdown phrase search passed.
- Both worktrees are clean.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs-main-queue-fix"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs-main-queue-fix"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs-main-queue-fix" branch="main"}
