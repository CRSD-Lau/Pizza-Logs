# Codex Gotchas

## Project Rules

- Start by reading `START HERE`, `Latest Handoff`, and `Now`, then run git status.
- Work on `codex-dev`; do not commit, push, or merge `main`.
- Update vault handoff/current-focus docs before committing.
- Parser correctness outranks cleanup and style.
- Do not change parser math, segmentation, boss aliases, difficulty, kill/wipe detection, pet attribution, or duration without tests or fixture validation.
- Do not build a Railway-side Warmane/Cloudflare bypass. Railway should serve cached data and receive browser/local imports.
- Leave local noise untracked: `.env*`, `.next/`, logs, caches, screenshots, uploads, combat logs, `animations/`, `.sync-agent-logs/`.

## Recurring Pitfalls

| Pitfall | Correct behavior |
|---|---|
| Direct `main` push | Push `codex-dev` and open a PR |
| Trust old vault history | Verify against code before updating docs |
| Treat roster-only members as unsupported | Resolve profile from `guild_roster_members` when no `players` row exists |
| Fork GearScore logic for roster-only players | Reuse `armory_gear_cache` and `lib/gearscore.ts` |
| Filter raids by upload status only | Use stored encounter presence |
| Put upload history on public pages | Keep upload history under admin |
| Claim Warmane direct fetch is reliable | Document browser-assisted import as supported path |
| Forget `stalled: false` in upload state resets | Include it in all reset states |

## Parser Facts

- Skada-WoTLK is the source of truth.
- `SPELL_HEAL_ABSORBED` is not healing done.
- Effective heal is gross minus overheal.
- `SWING_DAMAGE` indexes are shifted.
- KILL duration uses boss death timestamp.
- Gunship kill evidence is crew death on Warmane.
- Heroic detection is evidence-based; some cases remain impossible from logs alone.
