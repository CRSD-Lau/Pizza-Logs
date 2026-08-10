# Windows Developer Tooling

This document captures the supported local Windows tooling setup for Pizza Logs. It is meant for Neil's desktop and for Codex sessions running in the canonical checkout at `C:\Projects\PizzaLogs`.

## Quick Start

Open a fresh PowerShell terminal from the repo root:

```powershell
cd C:\Projects\PizzaLogs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev\setup-tooling.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev\verify-tooling.ps1
```

After PowerShell 7 is installed, this also works:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev\verify-tooling.ps1
```

## What The Setup Script Does

`scripts/dev/setup-tooling.ps1` is idempotent. It:

- checks PowerShell, `winget`, Chocolatey, and Scoop;
- installs missing safe native tools with `winget` where possible;
- enables Corepack when Node supports it;
- installs the official Railway CLI with npm only if it is missing;
- adds common install directories to the **User** PATH only when those directories exist and are not already present;
- refreshes PATH for the current PowerShell session;
- prints next steps.

The script does not deploy, push to GitHub, modify secrets, or edit production Railway settings.

## Required Tools

The verification script treats these as critical:

| Tool | Purpose |
|---|---|
| `winget` | Official Windows package installation |
| `git` | Repository workflow |
| `gh` | GitHub auth and PR workflow |
| `node`, `npm`, `npx` | Next.js and TypeScript tooling |
| `pnpm` | Useful Node package manager compatibility |
| `python`, `pip` | Parser virtualenv and tests |
| `rg` | Fast text search |
| `fd` | Fast file search |
| `jq` | JSON inspection in scripts |
| `curl`, `tar`, `ssh` | Standard CLI utilities |
| `railway` | Railway status/link/deploy workflow, without auto-deploying |

Optional but useful tools checked by verification:

- `pwsh` for PowerShell 7
- `yarn`
- `vercel`
- `codex`
- `code`
- `wt`

`wt` is verified by PATH presence only. Windows Terminal opens a GUI Help/About dialog for some version-style invocations, so the verification script intentionally does not run `wt --version`.

## Current Audit Snapshot

As of the local audit on 2026-08-10:

- Windows PowerShell 5.1 is present.
- PowerShell 7.6.1 was installed.
- `winget` is present.
- Chocolatey and Scoop are not installed and are not required.
- Git for Windows is present.
- GitHub CLI is present at `C:\Program Files\GitHub CLI\gh.exe`.
- GitHub CLI auth succeeds for the `CRSD-Lau` account.
- Node, npm, npx, pnpm, yarn, Python, pip, curl, tar, OpenSSH, Railway CLI, Vercel CLI, Codex CLI, VS Code CLI, and Windows Terminal are present.
- Standalone `ripgrep`, `fd`, and `jq` were installed with `winget`.
- The repo remote is `https://github.com/CRSD-Lau/Pizza-Logs.git`.
- The default working branch is `codex-dev`, tracking `origin/codex-dev`.
- The repo uses `package-lock.json`, so clean installs should use `npm ci --legacy-peer-deps`.
- Railway CLI is installed, but the checkout is not linked. Run `railway link` only when intentionally working on Railway configuration.

## Node Project Notes

The repo has these core scripts:

```powershell
npm run dev
npm run build
npm run lint
npm run type-check
npm run db:generate
npm run db:seed
npm run db:import-items
```

Use the local server launchers for day-to-day app work:

```powershell
C:\Projects\PizzaLogs\Start Pizza Logs Local.cmd
C:\Projects\PizzaLogs\Stop Pizza Logs Local.cmd
```

## Railway Rules

The verification script may run `railway status`, but it never deploys. Do not run deploy commands unless Neil explicitly asks.

Production deploys from `origin/main` after Neil merges a PR. Codex works on `codex-dev`, opens PRs into `main`, and does not push or merge `main` directly.

GitHub PR Slack notifications are tested by opening a normal `codex-dev` to `main` pull request after `PR_SLACK_WEBHOOK_URL` is configured as a repository Actions secret.
