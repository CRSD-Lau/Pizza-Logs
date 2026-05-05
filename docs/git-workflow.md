# Git Workflow

## Branch Model

- `main` is production.
- Railway production deploys from `main`.
- `codex-dev` is the long-lived Codex working branch.
- Codex commits and pushes scoped work to `origin/codex-dev`.
- Pull requests go from `codex-dev` to `main`.
- Codex must not commit, push, or merge directly on `main`.

Use a separate feature branch only when Neil explicitly asks for one.

## Start Of Work

```bash
git checkout codex-dev
git fetch origin
git merge origin/main
git status --short --branch
```

If `git` is not on PATH on Windows, use:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' status --short --branch
```

Stop and report conflict risk if the working tree already has unrelated local edits in the files you need to change.

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

## After Merge

After Neil merges the PR, update `codex-dev` from `main` before new work:

```bash
git checkout codex-dev
git fetch origin
git merge origin/main
```

## Railway Guidance

- Production watches `main`.
- `codex-dev` does not deploy production.
- If staging is needed, use a separate Railway environment and database.
- Do not change Railway production secrets or environment variables from Codex.
- Verify `ADMIN_SECRET` is set in production before merging admin-sensitive changes.
