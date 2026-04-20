# Now

## Active
- Re-upload log → verify session splitting (expect 2 sessions: ICC night + VoA)
- Verify "X boss" sub-label appears on Marrowgar DPS meter

## Next
- Investigate Marrowgar DPS over-count vs uwu-logs reference
- Fix footer text ("client-side" is wrong — parsing is server-side)
- Admin page auth (simple secret middleware — medium priority)
- Boss HP threshold heroic detection (25N vs 25H total damage ratio ~1.45x)

## Recently Shipped (2026-04-20)
- Layer 1: per-mob target breakdown in encounter detail
- Layer 2: raid session splitting (>60 min gap = new session)
  - /uploads/[id] → session list cards
  - /uploads/[id]/sessions/[idx] → standalone session page
- Layer 3: boss-only DPS sub-label in DamageMeter (excludes add padding)
- Fixed Dockerfile startup: prisma db push works correctly
- Fixed ERR_INVALID_STATE crash in upload route

## Not Working On
- Heroic detection (impossible without ENCOUNTER_START)
- Gunship Battle detection (impossible)
- Monetization
- Major redesigns

## Reminder
One working feature at a time.
