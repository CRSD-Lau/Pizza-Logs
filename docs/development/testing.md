# Testing and Validation

## Pull Request Gate

```bash
npm run check:pr
```

The gate runs:

1. ESLint with zero warnings;
2. TypeScript 7 native type checking;
3. TypeScript 6 ecosystem compatibility;
4. every `tests/*.test.ts` test;
5. Markdown local-link validation;
6. Python manifest/hash-lock consistency;
7. a production Next.js build.

Run one TypeScript test with:

```bash
npx tsx --test tests/<file>.test.ts
```

## Parser Gate

```bash
cd parser
pytest tests/ -v
```

Useful focused suites:

```bash
pytest tests/test_fixtures.py -v
pytest tests/test_parser_core.py -v
pytest tests/test_parser_service.py -v
pytest tests/test_archive_upload.py -v
```

Parser behavior changes require a focused pytest or fixture. Full-suite success is still required before shipping.

After editing a Python input manifest, regenerate both platform-aware hash locks with Python 3.14 and the pinned `pip-tools`:

```bash
python -m piptools compile --generate-hashes --strip-extras --output-file=parser/requirements.lock parser/requirements.txt
python -m piptools compile --generate-hashes --strip-extras --allow-unsafe --output-file=parser/requirements-dev.lock parser/requirements-dev.txt
npm run locks:check
```

## Static and Security Checks

```bash
python -m ruff check parser --select F,E9
python -m bandit -q -r parser -x parser/tests,parser/benchmarks,parser/.venv
npm audit --audit-level=moderate
python -m pip_audit -r parser/requirements.lock
```

CI additionally runs dependency review and CodeQL. The complete CI security gate is scheduled weekly so newly published npm or Python advisories fail visibly even when the source tree has not changed. A clean advisory scan does not replace review of authentication, authorization, data exposure, error handling, or resource limits.

## Database and Containers

```bash
npm run db:generate
npx prisma validate
docker compose config
docker build -t pizza-logs-web .
docker build -f parser/Dockerfile -t pizza-logs-parser .
```

Inspect every generated migration. For deployment changes, verify both images where Docker is available and run the production smoke script against the deployed URL.

## Final Diff Review

Before staging or merging:

- run `git diff --check`;
- inspect all modified, deleted, and untracked files;
- confirm no `.env`, secret, webhook, combat log, upload, cache, build output, screenshot with private data, or personal path is included;
- confirm deletions have no imports, scripts, docs, deployment, or compatibility references;
- state migration, re-upload, rollback, and production risks in the pull request.
