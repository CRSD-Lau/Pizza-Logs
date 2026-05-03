# Contributing to Pizza Logs

Thank you for contributing.

## Ways To Contribute

- Report bugs
- Suggest features
- Improve documentation
- Submit code fixes
- Improve accessibility or UI
- Review pull requests

## Before You Start

1. Search existing issues first.
2. Open an issue for significant changes.
3. Discuss large parser, schema, admin, or deployment changes before implementation.

## Development Setup

```bash
git clone https://github.com/CRSD-Lau/Pizza-Logs.git
cd Pizza-Logs
npm ci --legacy-peer-deps
npm run dev
```

Run the parser separately when testing uploads:

```bash
cd parser
pip install -r requirements.txt
python main.py
```

## Codex Workflow

Pizza Logs uses `AGENTS.md` as the canonical agent guide. Codex must read the vault startup files before work, preserve parser correctness, update the vault after changes, and keep Railway deployment risk visible.

For substantial changes, ask for Codex review on GitHub with `@codex review` if configured. Review should prioritize parser correctness, upload/report regressions, admin-only access, Railway deployment risk, secrets, stale-code deletion proof, dependency changes, and documentation drift. See `docs/code-review.md`.

## Validation Before Main

Before pushing `main`, run the strongest relevant checks:

```bash
npm run type-check
npm run build
cd parser && pytest tests/ -v
```

Do not push `main` if parser validation, build, secret scan, or deployment-readiness checks fail.
