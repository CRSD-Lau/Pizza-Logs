## PR Safety Checklist

- [ ] Source branch is `codex-dev`
- [ ] Target branch is `main`
- [ ] I did not push directly to `main`
- [ ] Branch is updated from latest `main`
- [ ] No `.env.local` or secrets committed
- [ ] No production database URL used locally
- [ ] No generated junk committed
- [ ] No Railway production environment variables changed
- [ ] `npm run lint --if-present` passes
- [ ] `npm run type-check --if-present` passes
- [ ] `npm test --if-present` passes
- [ ] `npm run build` passes
- [ ] `cd parser && pytest tests/ -v` passes if parser behavior changed
- [ ] Upload flow tested if upload/parser code changed
- [ ] Global search tested if player/search/roster code changed
- [ ] Local DB reset/seed tested if Prisma/schema/seed code changed
- [ ] Railway staging/preview tested if available
- [ ] Rollback plan is clear
