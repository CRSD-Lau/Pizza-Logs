# Git Workflow

## Branch Model

- `main` is the production branch.
- Railway production deploys from `main` only.
- `codex-dev` is the long-lived Codex working branch.
- Codex work is committed and pushed to `codex-dev`.
- Pull requests go from `codex-dev` to `main`.
- Codex must not commit directly to `main`.
- Codex must not push directly to `main`.
- Codex must not merge directly into `main`.

Keep this simple: do not create a new feature branch for every Codex task unless Neil asks for one.

## Before Starting Codex Work

```bash
git checkout codex-dev
git fetch origin
git merge origin/main
git status
```

Stop and report conflict risk if another branch, Claude branch, or local change touched the same files.

## After Codex Makes Changes

```bash
git status
npm install
npm run lint --if-present
npm run type-check --if-present
npm test --if-present
npm run build
```

If `check:pr` is available, this shorter command can replace the validation commands:

```bash
npm run check:pr
```

Then commit and push:

```bash
git add .
git commit -m "..."
git push origin codex-dev
```

Open a pull request:

```text
codex-dev -> main
```

## Pull Request Rules

- `main` is production.
- No direct commits to `main`.
- No direct pushes to `main`.
- No production deploy until the PR is merged.
- After a PR merges, update `codex-dev` from `main` before any new work.
- If another branch or Claude branch changed the same files, stop and report conflict risk.
- Codex must run proper checks before saying a PR is ready.

## Manual GitHub Settings

Configure branch protection for `main` in GitHub:

- Require pull request before merging.
- Require status checks to pass before merging.
- Require branch to be up to date before merging if practical.
- Block direct pushes to `main`.
- Do not overcomplicate this with excessive review requirements yet.

## Railway Guidance

Railway production should deploy only from `main`.

Recommended:

- Railway production service watches `main`.
- `codex-dev` does not deploy to production.
- If staging is needed, create a separate Railway environment or service for `codex-dev`.
- Staging must use a separate database.
- Staging must not use production `DATABASE_URL`.
- Test uploads, global search, and admin before merging into `main`.

Do not change Railway production secrets or environment variables from Codex.
