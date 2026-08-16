# Contributing to Pizza Logs

Thanks for improving Pizza Logs. This is a small production-backed project, so a good contribution is focused, tested, and explicit about parser, data, security, and deployment risk.

## Before You Start

1. Search existing issues and pull requests.
2. Read the [documentation index](docs/README.md) and the relevant contract.
3. Discuss material parser, schema, public API, admin, privacy, or deployment changes in an issue before investing in a large implementation.
4. Never include real combat logs, `.env` files, secrets, database exports, or personal machine paths.

## Local Setup

```bash
git clone https://github.com/CRSD-Lau/Pizza-Logs.git
cd Pizza-Logs
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run db:generate
npm run db:push
npm run db:seed
python -m venv parser/.venv
```

Install and run the parser with the virtual environment's interpreter. On Windows:

```powershell
.\parser\.venv\Scripts\python.exe -m pip install --require-hashes -r .\parser\requirements-dev.lock
.\parser\.venv\Scripts\python.exe .\parser\main.py
```

On macOS/Linux:

```bash
parser/.venv/bin/python -m pip install --require-hashes -r parser/requirements-dev.lock
parser/.venv/bin/python parser/main.py
```

Run the app in a separate terminal:

```bash
npm run dev
```

Platform-specific details are in [docs/development/setup.md](docs/development/setup.md).

## Branch and Pull Request Workflow

1. Fetch `origin` and branch from current `origin/main`.
2. Use a descriptive short-lived branch such as `codex/upload-timeout` or `fix/gunship-detection`.
3. Keep commits and the pull request to one coherent change.
4. Rebase or merge current `origin/main` before final validation when needed.
5. Push the branch and open a pull request into `main`.
6. Merge only after required checks pass and the final diff has been reviewed.
7. Prefer a squash merge and delete the merged branch.

Direct pushes to `main` are not allowed. Merging `main` triggers the Railway production deployment.

## Validation

Run the full web gate before opening a pull request:

```bash
npm run check:pr
```

Parser changes also require:

```bash
cd parser
pytest tests/ -v
```

Add a focused test or canonical fixture for changes to combat math, segmentation, difficulty, boss aliases, kill/wipe detection, duration, GUIDs, pet ownership, absorbs, or session analytics.

Database changes require `npx prisma validate`, an inspected migration, and a clear production-risk note. Deployment changes should also pass `docker compose config` and the relevant image build when Docker is available.

## Code and Documentation Expectations

- Preserve public routes and response shapes unless every consumer and test is updated.
- Prefer existing architecture and small changes over speculative rewrites.
- Treat missing/conflicting parser evidence as unknown, not an invitation to guess.
- Update the authoritative docs and `CHANGELOG.md` when behavior changes.
- Add an ADR under `docs/adr/` for a durable architectural or workflow decision.
- Do not add session transcripts, generated handoff notes, or machine-specific status documents.

## Security

Public routes must not expose raw upload rows, secrets, parser filesystem paths, internal exception text, or destructive controls. Production admin access must continue to fail closed. Review [SECURITY.md](SECURITY.md) and [docs/security/threat-model.md](docs/security/threat-model.md) for sensitive changes.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/CRSD-Lau/Pizza-Logs/security/advisories/new).

## Code of Conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
