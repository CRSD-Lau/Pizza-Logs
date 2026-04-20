# Latest Handoff

## Date
2026-04-20

## Last Completed (this session)

### Dockerfle / startup fixes (multiple iterations)
- `prisma db push` now runs at container startup via `start.sh`
- Fixed wasm companion file issue — runs `node ./node_modules/prisma/build/index.js` (source entry) instead of bundled `.bin/prisma`
- Fixed `--chown=nextjs:nodejs` on prisma node_modules so nextjs user can write engine files
- Fixed `ERR_INVALID_STATE` crash in upload route (double-close of ReadableStream controller)
- Parser fetch timeout raised to 270s; all controller.close() calls consolidated to finally block

### Layer 1 — Target Breakdown ✅ SHIPPED
- `parser_core.py`: `TargetStats` dataclass, `targets` dict on `ActorStats`, serialized to `targetBreakdown` per participant
- `prisma/schema.prisma`: `targetBreakdown Json?` on Participant
- `lib/schema.ts`: `TargetBreakdownSchema`, added to `ParticipantResultSchema`
- `route.ts`: persists `targetBreakdown` in participant createMany
- `components/meter/MobBreakdown.tsx`: new interactive mob damage table (click → per-player drill-down)
- `/encounters/[id]`: Target Breakdown section below healing meter
- `/uploads/[id]` (old version): showed all encounters + raid-wide mob damage

### Layer 2 — Raid Session Splitting ✅ SHIPPED
- `parser_core.py`: `_assign_session_indices()` detects >60 min gaps, assigns `session_index` to each `ParsedEncounter`
- `parser/main.py`: `_enc_to_dict` now includes `sessionIndex`
- `prisma/schema.prisma`: `sessionIndex Int @default(0)` on Encounter
- `lib/schema.ts`: `sessionIndex: z.number().int().default(0)` on EncounterResultSchema
- `route.ts`: passes `sessionIndex` to encounter create
- `/uploads/[id]`: **rewritten** — now shows session cards (one per session detected in the log)
  - Each card: raid zone tags, time range, kills/wipes mini-stats, encounter pills
  - Links to `/uploads/[id]/sessions/[sessionIdx]`
- `/uploads/[id]/sessions/[sessionIdx]`: **new** standalone raid session page
  - Encounters grouped by raid zone, with outcome/difficulty/duration/rdps
  - Session-wide mob damage breakdown (MobBreakdown)
  - Raid roster with player class links
  - Prev/Next session navigation

### Layer 3 — Clean Boss DPS ✅ SHIPPED
- `/encounters/[id]`: pre-computes `bossDmg` per participant by filtering `targetBreakdown` to `enc.boss.name`
- `DamageMeter.tsx`: shows `X boss` sub-label under total damage when add padding is >2%

## Current State
- App: https://pizza-logs-production.up.railway.app
- DB: **EMPTY** — cleared 2026-04-20 for fresh test
- Git: main branch, all changes pushed (latest: 83a1557)
- Layers 1, 2, 3: all code shipped, **need test upload to verify session splitting**

## Exact Next Step
1. Re-upload WoWCombatLog.txt
2. Verify:
   - History → upload shows 2 session cards (ICC night + VoA)
   - Each session card links to standalone session page
   - Session page shows encounter list + mob breakdown
   - Encounter detail shows "X boss" sub-label on DPS meter for fights with adds (Marrowgar)
3. If session split is wrong (gap threshold too small/large): adjust `gap_seconds=3600` in `parser_core.py`

## Notes
- Session gap threshold: 3600s (60 min) — adjust in `CombatLogParser._assign_session_indices()`
- reset-db: deploy temp endpoint → curl → delete (we do this repeatedly, no permanent endpoint)
- Boss DPS (Layer 3) uses exact boss name match from `enc.boss.name` → `targetBreakdown` key
  - May miss if log name differs from DB name (e.g. Valithria) — verify after upload
