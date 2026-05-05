# PR Readiness

Use this checklist before pushing `codex-dev` or opening a PR into `main`.

## 1. Confirm Branch

```bash
git branch --show-current
```

Expected:

```text
codex-dev
```

## 2. Update From Main

```bash
git fetch origin
git merge origin/main
```

## 3. Review Status

```bash
git status --short
git diff --stat
git diff
```

Confirm the diff contains only intended source, docs, tests, config, fixtures, or lockfiles.

## 4. Run Validation

```bash
npm run check:pr
```

If needed, run the pieces directly:

```bash
npm run lint
npm run type-check
npm run build
```

Parser changes also need:

```bash
cd parser
pytest tests/ -v
```

## 5. Push

```bash
git push origin codex-dev
```

## 6. Open PR

```text
codex-dev -> main
```

## 7. Do Not Merge Until

- GitHub checks pass.
- The final diff has been reviewed.
- No secrets, local files, logs, build outputs, uploads, or combat logs are staged.
- Prisma migration risk is understood if schema changed.
- Parser fixture/test evidence exists if parser behavior changed.
- Railway production env changes are not required, or are explicitly documented.
