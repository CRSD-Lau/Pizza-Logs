# 2026-08 Platform Upgrade

The upgrade was performed in explicit gates so parser-output drift could be
distinguished from framework/dependency changes.

| Gate | Result |
|---|---|
| Analytical baseline | Exact fixture hashes captured before runtime changes |
| Node | Node 24 in `.nvmrc`, package engines, GitHub Actions, Docker, and Railway web image |
| Actions/non-breaking dependencies | Current major Actions and compatible current dependencies |
| Next/React | Next 16.3 and React 19.2; `middleware.ts` migrated to `proxy.ts`; request API/source contract tested |
| Prisma 5 to 6 | Prisma 6 gate passed before the Prisma 7 migration |
| Prisma 7 | Generated client output, ESM CLI, `prisma.config.ts`, PostgreSQL adapter, Docker production CLI, and additive migration verified |
| Tailwind/UI majors | Tailwind 4, Recharts 3, Zod 4, React Dropzone 20, tailwind-merge 3, and current Lucide; unused date-fns removed |
| TypeScript 7 | Native TypeScript 7 CLI passes the repo; TypeScript 6 remains the API consumed by Next/ESLint |
| Python | Current FastAPI, Uvicorn, multipart, Pydantic, and pytest pins; Pydantic v2 config warning removed |

## TypeScript Release Contract

`npm run type-check` invokes the TypeScript 7 native CLI from
`@typescript/native`. `npm run type-check:ecosystem` invokes TypeScript 6, which
provides the JavaScript API still required by Next.js and ESLint. Both must pass.

## Intentional Version Holds

- `@types/node` stays on major 24 to match the production runtime; the registry's
  newer major describes Node 26 APIs.
- ESLint stays on 9.39 because Next 16's bundled React lint plugins fail under
  ESLint 10. The current lint gate is clean with zero warnings.
- The package named `typescript` stays on 6.x for ecosystem API consumers;
  `@typescript/native` is the TypeScript 7.0.2 compiler used by the primary
  type-check gate.

## Prisma 7 Deployment Contract

- The generated client lives in ignored `generated/prisma` and is regenerated
  during builds.
- `lib/prisma-client.ts` creates the client with `@prisma/adapter-pg` and fails
  closed when `DATABASE_URL` is missing.
- `prisma.config.ts` owns schema, migrations, seed command, and datasource URL.
- The production image retains the Prisma 7 CLI and its engines because
  `start.sh` runs `prisma migrate deploy` before `node server.js`.
- `20260810150000_add_participant_analytics` is additive: no column removals or
  data rewrites.

## Verification Commands

```bash
npm ci --legacy-peer-deps
npm run lint
npm run type-check
npm run type-check:ecosystem
npm test
npm run build
npm audit
npm run smoke:production

cd parser
pytest tests/ -v
python -m pip check
```

A clean Docker build must also succeed, and `prisma --version` must execute in
the final non-root web image.
