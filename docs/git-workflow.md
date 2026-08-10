# Git Workflow

## Canonical Path

There is one supported development and release path:

```text
C:\Projects\PizzaLogs on codex-dev
                |
                v
GitHub origin/codex-dev -> pull request -> origin/main
                                              |
                                              v
                                      Railway production
```

- `C:\Projects\PizzaLogs` on Neil's desktop is the canonical checkout.
- `origin` is the only remote and points to `https://github.com/CRSD-Lau/Pizza-Logs.git`.
- `codex-dev` is the long-lived Codex working branch.
- `main` is a reference-only production branch; no development happens there.
- Neil merges reviewed pull requests from `codex-dev` into `main`.
- The GitHub `Production main` ruleset requires a pull request and a passing `test-build` check, and blocks deletion and non-fast-forward updates.
- Railway watches `main`; Codex does not run a separate production deploy.
- No laptop, OneDrive clone, Claude worktree, or cross-machine sync is part of the supported development workflow.

Historical chat exports can mention retired workflows. They are archive material, not instructions. The roster and gear browser-sync utilities are product operations and are not a second development checkout.

Use a separate feature branch only when Neil explicitly asks for one.

## Start Of Work

```bash
git checkout codex-dev
git fetch --prune origin
git merge origin/main
git status --short --branch
```

If `git` is not on PATH on Windows, use:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' status --short --branch
```

Stop and report conflict risk if the working tree already has unrelated local edits in the files you need to change.

Run the repeatable environment and workflow check when the checkout state is uncertain:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev\verify-tooling.ps1
```

## Before Opening A PR

Review the working tree:

```bash
git status --short
git diff --stat
git diff
```

Run validation:

```bash
npm run check:pr
```

If `check:pr` is not usable, run the relevant pieces directly:

```bash
npm run lint
npm run type-check
npm run build
```

Parser changes also require:

```bash
cd parser
pytest tests/ -v
```

## Commit And Push

Stage only intended files. Do not stage `.env*`, logs, caches, `node_modules`, `.next`, `uploads`, combat logs, screenshots, or local machine state.

```bash
git add <intended files>
git commit -m "docs: refresh repository documentation"
git push origin codex-dev
```

Open a PR:

```text
codex-dev -> main
```

GitHub Actions posts new, reopened, and ready-for-review pull requests to the Codex Slack server's `#pull-requests` channel through `.github/workflows/pr-slack-notify.yml` when the repository has a `PR_SLACK_WEBHOOK_URL` secret configured. If the secret is missing, the workflow warns and exits successfully so PR checks are not blocked. Do not commit the webhook URL to the repo.

## After Merge

After Neil merges the PR, update the local references and `codex-dev` before new work:

```bash
git checkout codex-dev
git fetch --prune origin
git merge origin/main
```

There is no need to check out local `main`. If it has no unique commits, it may be fast-forwarded to the fetched production ref with `git branch -f main origin/main` while staying on `codex-dev`.

## Railway Guidance

- Production watches `main`.
- `codex-dev` does not deploy production.
- If staging is needed, use a separate Railway environment and database.
- Keep the local Railway CLI unlinked unless Railway configuration work is explicitly requested.
- Do not change Railway production secrets or environment variables from Codex.
- Verify `ADMIN_SECRET` is set in production before merging admin-sensitive changes.
- After Railway deploys a merged PR, verify `/`, `/api/health`, the changed user flow, and the deployed commit before closing related tickets.
