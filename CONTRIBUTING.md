# Contributing To Pizza Logs

Pizza Logs is maintained as a small, production-backed project. Keep changes scoped, verifiable, and honest about parser/deployment risk.

## Before You Start

1. Search existing issues and docs for the same bug or feature.
2. Discuss significant parser, schema, admin, security, or deployment changes before implementation.
3. Start from `codex-dev`, not `main`.

## Local Setup

```bash
git clone https://github.com/CRSD-Lau/Pizza-Logs.git
cd Pizza-Logs
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run db:generate
npm run db:push
npm run db:seed
```

Run the parser separately when testing uploads:

```bash
cd parser
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Run the app:

```bash
npm run dev
```

## Branch Workflow

Pizza Logs uses a Codex-first branch flow:

1. Work on `codex-dev`.
2. Merge the latest `origin/main` into `codex-dev` before editing.
3. Commit scoped changes on `codex-dev`.
4. Push `origin/codex-dev`.
5. Open a pull request into `main`.
6. Neil merges the PR when ready.

Do not commit, push, or merge directly to `main`. Railway production deploys from `main` only after the PR is merged.

## Validation

Run the strongest relevant checks before opening a PR:

```bash
npm run lint
npm run type-check
npm run build
```

If available, use the aggregate PR gate:

```bash
npm run check:pr
```

Parser changes require parser validation:

```bash
cd parser
pytest tests/ -v
```

Focused TypeScript tests live in `tests/` and usually run with:

```bash
ts-node --project tsconfig.seed.json tests/<file>.test.ts
```

## Parser Changes

Parser correctness is the product. Do not change combat-log math, segmentation, boss aliases, kill/wipe detection, duration, pet attribution, or GUID handling without targeted pytest or fixture coverage.

## Documentation

Update docs when behavior, setup, environment variables, deployment, parser rules, or workflows change. Prefer fewer accurate docs over duplicated stale notes.

## Security

Never commit `.env*`, Railway tokens, database URLs, admin secrets, combat logs, upload artifacts, caches, local screenshots, or generated build outputs.

Admin pages and admin import APIs require `ADMIN_SECRET` in production. Browser userscripts may ask an admin for that secret; treat browser storage as sensitive local state.
