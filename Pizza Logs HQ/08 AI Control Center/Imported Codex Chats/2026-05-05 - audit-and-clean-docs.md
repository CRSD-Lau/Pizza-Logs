# Audit and clean docs

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-05
- Thread id: `019df619-6170-7ac2-9de8-7cb32d30d441`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\05\rollout-2026-05-05T00-05-51-019df619-6170-7ac2-9de8-7cb32d30d441.jsonl`
- Imported user turns: 1
- Imported assistant final replies: 1
- Tool/command events omitted: 136

## Discussion Digest

## User

You are working in the Pizza Logs repository.

Goal:
Perform a full documentation and repository freshness audit. Remove, rewrite, or update anything stale, misleading, duplicated, obsolete, or no longer useful.

Scope:
- Review the entire codebase before editing documentation.
- Review every `.md` file in the repo, including:
  - README files
  - docs folders
  - wiki/exported docs
  - Obsidian vault notes
  - setup guides
  - deployment notes
  - architecture notes
  - parser notes
  - testing notes
  - roadmap/backlog docs
  - package/release docs
  - contribution/community files
- Review GitHub-facing repo files:
  - root README.md
  - CONTRIBUTING.md
  - CODE_OF_CONDUCT.md
  - SECURITY.md if present
  - issue templates
  - PR templates
  - release/package docs
  - any docs linked from README

Primary instructions:
1. First, map the current repo structure.
2. Identify the actual current state of the application by inspecting:
   - package.json scripts and dependencies
   - app routes/pages
   - API routes
   - database/schema/migrations
   - parser logic
   - upload flow
   - admin page
   - player/gear features
   - guild roster features
   - leaderboards/raid sessions
   - Railway/deployment configuration
   - test setup
   - environment variables
3. Use the codebase as the source of truth.
4. Compare all documentation against the current implementation.
5. Delete documentation that no longer serves a purpose.
6. Update documentation that is useful but stale.
7. Consolidate duplicate docs where practical.
8. Remove old Claude-specific references unless they are still genuinely useful.
9. Replace outdated AI workflow references with current Codex-first workflow language.
10. Ensure README and setup docs reflect the current production deployment and local development process.

Important:
- Do not preserve stale docs just because they exist.
- Do not create bloated documentation.
- Prefer fewer, cleaner, accurate docs over many partial docs.
- Do not invent features that are not implemented.
- Do not document aspirational functionality as if it exists.
- Clearly separate current functionality from roadmap/backlog items.
- Remove dead links, dead setup steps, obsolete commands, and outdated screenshots references.
- Update docs that mention broken or removed flows such as unused fallback buttons, old upload analytics placement, deprecated gear enrichment methods, or abandoned scraper assumptions.
- Ensure any Warmane, Tampermonkey, AzerothCore DB, parser, and Railway notes reflect the current design.

Required review areas:
- Root README accuracy
- Local setup instructions
- Environment variable documentation
- Database setup and migration instructions
- Railway deployment notes
- Parser behavior and known limitations
- Upload behavior
- Admin page functionality
- Player gear cache / Warmane / Tampermonkey flow
- Guild roster flow
- Raid sessions and leaderboards behavior
- Security notes for uploads and file handling
- Testing instructions
- NPM/package release notes if applicable
- GitHub community files
- Obsidian/internal notes that are now stale, duplicated, or misleading

Execution plan:
1. Create or switch to the Codex development branch:
   - `git fetch --all --prune`
   - `git checkout codex-dev` if it exists
   - otherwise create it from latest main
   - sync with main before starting
2. Inventory documentation:
   - list every `.md` file
   - identify docs that are current, stale, duplicate, obsolete, or unclear
3. Inventory implementation:
   - inspect relevant source files and configs to understand actual behavior
4. Produce a short audit summary before editing:
   - docs to delete
   - docs to update
   - docs to consolidate
   - repo-facing docs needing README updates
5. Apply changes.
6. Run formatting/lint/tests/build commands available in package.json.
7. Fix any issues caused by doc or config changes.
8. Review git diff carefully.
9. Commit all safe documentation and repo metadata changes.
10. Push the branch to remote.
11. Prepare a PR from `codex-dev` into `main`.

Guardrails:
- Do not edit secrets.
- Do not commit `.env`, local database files, logs, build artifacts, cache folders, or generated junk.
- If files appear sensitive or machine-specific, add them to `.gitignore` instead of committing them.
- If unsure whether a doc is obsolete, verify against code before deleting it.
- If a doc contains useful historical context but should not be primary documentation, move/consolidate the still-useful parts into the right current doc and delete the stale original.
- Keep the tone professional, concise, and repo-maintainer friendly.
- Avoid marketing language.
- Avoid over-documenting obvious code behavior.

README expectations:
The final root README should clearly explain:
- what Pizza Logs is
- current major features
- supported WoW/Warmane assumptions
- local development setup
- database setup
- environment variables
- upload/parsing flow
- admin tools
- player/gear/guild roster enrichme

[Truncated for vault import.]

## Assistant

Completed and pushed on `codex-dev`.

**Deleted**
- Obsolete Superpowers cinematic intro plan/spec docs.
- Empty/stale vault inbox note.
- Duplicate AI control docs and old Claude/prompt/skills reference notes.
- Stale standalone backlog, technical debt, and growth/business notes after consolidating useful content.

**Updated / Consolidated**
- Rewrote `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, Git workflow/review docs, deployment/security/parser docs, and the active Obsidian vault handoff/current-state notes.
- Consolidated backlog and technical debt into `Pizza Logs HQ/05 Features/Feature Status.md`.
- Replaced old Claude-first workflow language with Codex-first `codex-dev -> PR -> main` workflow.
- Trimmed `.env.example` to currently active env vars only.

**README / Community Files**
- README now covers current features, Warmane assumptions, parser/upload flow, admin tools, roster/gear enrichment, local setup, Railway deployment, tests, limitations, and contribution workflow.
- GitHub PR template now calls out parser validation when parser behavior changes.
- CI now runs parser pytest in addition to web validation.

**Not Changed**
- Found that `/api/upload` still lacks hard server-side file-size enforcement. I documented this as a known limitation instead of changing code in a docs-only audit.

**Validation**
- ESLint: passed.
- TypeScript `tsc --noEmit`: passed.
- Parser tests: `123 passed`.
- Next production build: passed.
- Obsidian wiki-link scan: passed.
- Stale-reference scan: passed.
- `git diff --check`: passed.
- Secret scan of staged diff: placeholders/docs only.

Commit: `ad4af43 docs: refresh repository documentation`

Push: `origin/codex-dev` is up to date and the working tree is clean.

PR creation could not be completed automatically: GitHub connector returned `403 Resource not accessible by integration`, and `gh` is not installed locally. Exact PR command once GitHub CLI is available/authenticated:

```powershell
gh pr create --draft --repo CRSD-Lau/Pizza-Logs --base main --head codex-dev --title "[codex] refresh repository documentation" --body "## Summary
- Refresh README, contributor/security/workflow docs, and the Obsidian vault around the current Codex-first branch flow.
- Remove obsolete duplicate docs and consolidate feature backlog/technical-debt notes into Feature Status.
- Document current Warmane roster/gear/portrait flows, parser edge cases, Railway deployment, and known upload/security limitations.
- Add parser pytest validation to GitHub Actions.

## Validation
- ESLint via bundled Node: passed.
- TypeScript tsc --noEmit via bundled Node: passed.
- Next production build via bundled Node: passed.
- Parser tests via bundled Python: 123 passed.
- Stale-reference and Obsidian wiki-link scans: passed.
- git diff --cached --check: passed.
- Staged secret scan: placeholders/docs only."
```

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex-dev"}
