# PR Readiness

Before asking Codex to open or prepare a PR:

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

## 3. Check Status

```bash
git status
```

## 4. Run Validation

```bash
npm run lint --if-present
npm run type-check --if-present
npm test --if-present
npm run build
```

Or, if available:

```bash
npm run check:pr
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
- Local smoke test passes.
- Railway staging or preview passes if configured.
- There is no conflict with a Claude branch or other active work.
