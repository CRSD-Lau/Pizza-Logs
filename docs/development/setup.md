# Development Setup

## Prerequisites

- Node.js 24.x and npm 11+
- Python 3.12
- PostgreSQL 16 or Docker Desktop
- Git; GitHub CLI is useful for maintainers
- FFmpeg only when regenerating intro media

## Web and Database

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run db:generate
npm run db:push
npm run db:seed
```

`db:push` is suitable for an empty local database. Schema changes intended for production must use a reviewed Prisma migration rather than an undocumented push.

To import WotLK item metadata:

```bash
npm run db:import-items
```

The import downloads AzerothCore data unless `--file <path>` is supplied. `npm run db:seed-items` is a compatibility/backfill helper that extracts known icons and item fields from existing gear-cache rows.

## Parser

Create a virtual environment and install the hash-locked development set:

```bash
python -m venv parser/.venv
```

Windows without an activated environment:

```powershell
.\parser\.venv\Scripts\python.exe -m pip install --require-hashes -r .\parser\requirements-dev.lock
.\parser\.venv\Scripts\python.exe .\parser\main.py
```

macOS/Linux:

```bash
parser/.venv/bin/python -m pip install --require-hashes -r parser/requirements-dev.lock
parser/.venv/bin/python parser/main.py
```

The parser listens on port 8000 by default. Legacy parser routes remain disabled unless `ENABLE_LEGACY_PARSER_ROUTES=true` is deliberately set for local compatibility testing.

## Web App

```bash
npm run dev
```

Open <http://localhost:3000>. `PARSER_SERVICE_URL` should point to <http://localhost:8000>.

## Local Compose

```bash
docker compose up --build
```

This starts PostgreSQL, the non-root parser service, and the production-style web image. The compose-only admin fallback is for local development and must never be copied into Railway.

## Windows Launchers

The optional root launchers start/stop the local PostgreSQL, parser, and web processes without requiring a global project task:

```powershell
.\Start Pizza Logs Local.cmd
.\Stop Pizza Logs Local.cmd
```

The stop launcher may need elevation to stop a Windows PostgreSQL service. The scripts operate relative to the current checkout and do not define the Git workflow.

## Environment Variables

| Variable | Service | Default/requirement |
| --- | --- | --- |
| `DATABASE_URL` | Web | Required |
| `PARSER_SERVICE_URL` | Web | `http://localhost:8000` local fallback |
| `ADMIN_SECRET` | Web | Required in production; development may use a placeholder |
| `ADMIN_COOKIE_SECURE` | Web | Secure in production; `false` only for local HTTP |
| `PORT` | Both | Web 3000, parser 8000 by deployment config |
| `ENABLE_LEGACY_PARSER_ROUTES` | Parser | Disabled |
| `ENABLE_PARSER_DOCS` | Parser | Disabled; local-only interactive API docs |
| `UPLOAD_MAX_COMPRESSED_BYTES` | Parser | 100 MiB |
| `UPLOAD_MAX_UNCOMPRESSED_BYTES` | Parser | 1 GiB |
| `UPLOAD_MAX_ARCHIVE_MEMBERS` | Parser | 32 |
| `UPLOAD_MAX_COMPRESSION_RATIO` | Parser | 200 |
| `UPLOAD_CONCURRENCY` | Parser | 4 |
| `UPLOAD_RECEIVE_TIMEOUT_SECONDS` | Parser | 300 |
| `UPLOAD_PROCESSING_TIMEOUT_SECONDS` | Parser | 240 |

Do not put production values into checked-in files.
