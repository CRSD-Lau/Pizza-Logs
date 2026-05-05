# Move project to local GitHub

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-05
- Thread id: `019df866-fa7a-7951-9142-c831bdf80780`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\05\rollout-2026-05-05T10-49-51-019df866-fa7a-7951-9142-c831bdf80780.jsonl`
- Imported user turns: 6
- Imported assistant final replies: 6
- Tool/command events omitted: 165

## Discussion Digest

## User

What would be the fastest way to copy my project from my onedrive desktop to c:\Projects locally and just work out of Github

## Assistant

Fastest clean path: **do not copy the whole OneDrive folder**. Clone fresh from GitHub into `C:\Projects`. Your current checkout is clean on `codex-dev`, `origin` is `https://github.com/CRSD-Lau/Pizza-Logs.git`, `C:\Projects` exists, and `C:\Projects\PizzaLogs` is free.

```powershell
cd C:\Projects
& 'C:\Program Files\Git\cmd\git.exe' clone https://github.com/CRSD-Lau/Pizza-Logs.git PizzaLogs
cd C:\Projects\PizzaLogs
& 'C:\Program Files\Git\cmd\git.exe' checkout codex-dev
& 'C:\Program Files\Git\cmd\git.exe' fetch origin
& 'C:\Program Files\Git\cmd\git.exe' merge origin/main
npm ci --legacy-peer-deps
npm run db:generate
```

Then copy only local config/secrets you need, not `node_modules`, `.next`, caches, logs, or combat logs:

```powershell
Copy-Item 'C:\Users\neil_\OneDrive\Desktop\PizzaLogs\.env.local' 'C:\Projects\PizzaLogs\.env.local' -ErrorAction SilentlyContinue
Copy-Item 'C:\Users\neil_\OneDrive\Desktop\PizzaLogs\.env.sync-agent' 'C:\Projects\PizzaLogs\.env.sync-agent' -ErrorAction SilentlyContinue
```

For this repo, that is better than copying because OneDrive has already caused local tooling/ACL weirdness. After the move, point Codex and your launchers at `C:\Projects\PizzaLogs`, and keep the GitHub workflow as `codex-dev -> PR -> main`.

## User

does this break anything to do with my local?

## Assistant

No, it should not break production or your GitHub workflow. Moving to `C:\Projects\PizzaLogs` mostly changes the **local working folder path**.

Things that keep working after a fresh GitHub clone:

- GitHub remote, branches, PR flow
- App source code and committed Obsidian vault files
- Production Railway deploys from `main`
- Local database data, as long as `.env.local` still points to the same `DATABASE_URL`
- Local userscripts that post to `http://127.0.0.1:3001`, because the URL does not care where the repo lives

Things you need to update or recreate:

- Copy `.env.local` and `.env.sync-agent` from the OneDrive repo
- Reinstall `node_modules` with `npm ci --legacy-peer-deps`
- Run `npm run db:generate`
- Recreate the parser venv if you use it locally
- Update desktop launchers/shortcuts that currently point to `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Start only one local app at a time, or ports like `3001` may conflict

Best safety move: leave the OneDrive copy alone for a few days. Clone to `C:\Projects`, copy env files, run the app locally, verify upload/admin/parser basics, then retire the OneDrive folder once the new path is proven.

## User

test environment

## Assistant

I set up and tested `C:\Projects\PizzaLogs` as the local test environment.

Passed from `C:\Projects\PizzaLogs`:

- `npm ci --legacy-peer-deps`
- `npm run db:generate`
- `npm run type-check`
- `npm run lint`
- `npm run build`
- Parser tests: `133 passed, 1 warning`
- Web server: `http://127.0.0.1:3001/` returns `200`
- Parser health: `http://127.0.0.1:8000/health` returns `200`

One local blocker: PostgreSQL service `postgresql-x64-16` is stopped, and this session could not start it without elevated Windows permissions. DB-backed API routes currently return `500` until PostgreSQL is started.

Also, your desktop launchers still point at:

`C:\Users\neil_\OneDrive\Desktop\PizzaLogs`

Next practical step is retargeting those Start/Stop launchers to `C:\Projects\PizzaLogs`, then starting PostgreSQL once as admin. I left the web/parser test services running on ports `3001` and `8000`.

## User

do it

## Assistant

Done.

`C:\Projects\PizzaLogs` is now the local working checkout. The desktop Start/Stop launchers on your Desktop now point there, and the repo launcher templates were updated too.

Verified:

- Web: `http://127.0.0.1:3001/` returns `200`
- Parser: `http://127.0.0.1:8000/health` returns `200`
- `C:\Projects\PizzaLogs` worktree is clean
- OneDrive repo worktree is clean
- Pushed `origin/codex-dev`
- Opened draft PR: [#11 Retarget local launchers to Projects checkout](https://github.com/CRSD-Lau/Pizza-Logs/pull/11)

Only remaining local issue: PostgreSQL service `postgresql-x64-16` is still stopped. Windows blocked starting it from this non-admin session, so DB-backed pages may return `500` until you start PostgreSQL once as admin.

::git-stage{cwd="C:\Projects\PizzaLogs"}
::git-commit{cwd="C:\Projects\PizzaLogs"}
::git-push{cwd="C:\Projects\PizzaLogs" branch="codex-dev"}
::git-create-pr{cwd="C:\Projects\PizzaLogs" branch="codex-dev" url="https://github.com/CRSD-Lau/Pizza-Logs/pull/11" isDraft=true}

## User

can we move the start and stops to the pizzalogs folder

## Assistant

Done. The launchers now live in the PizzaLogs folder:

- [Start Pizza Logs Local.cmd](</C:/Projects/PizzaLogs/Start Pizza Logs Local.cmd>)
- [Stop Pizza Logs Local.cmd](</C:/Projects/PizzaLogs/Stop Pizza Logs Local.cmd>)

I removed the old Desktop copies and deleted the duplicate `scripts/desktop` templates. The root launchers now resolve the repo path from their own location, so they are less brittle.

Verified both launchers: Stop then Start worked, web is `200` at `http://127.0.0.1:3001/`, parser health is `200` at `http://127.0.0.1:8000/health`. Pushed commit `8244651` to `origin/codex-dev`; draft PR #11 is updated.

::git-stage{cwd="C:\Projects\PizzaLogs"}
::git-commit{cwd="C:\Projects\PizzaLogs"}
::git-push{cwd="C:\Projects\PizzaLogs" branch="codex-dev"}

## User

how do i point my codex project to this new local folder

## Assistant

Click the small **pencil/edit icon** beside the `PizzaLogs` project name in the sidebar.

Set the project/workspace folder to:

```text
C:\Projects\PizzaLogs
```

Then save and start a new chat under that project. In the new chat, sanity-check it with:

```powershell
Get-Location
```

It should return:

```text
C:\Projects\PizzaLogs
```

If Codex does not let you edit the existing project path, create a new project/open folder and select `C:\Projects\PizzaLogs`, then use that one going forward. The old OneDrive project can stay around until youâ€™re sure everything is smooth.
