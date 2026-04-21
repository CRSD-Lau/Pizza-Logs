# Now

## Active
Pushed 7868a17 — awaiting Railway redeploy. Session 2 total should land ~275-276M.

---

## Completed This Session

### Delta fix: overkill subtraction + P2P filter

- **Overkill**: `eff_amount = max(0, amount - overkill)` — BPC had 7.8M overkill alone
- **P2P**: skip damage where `_is_player(dst_guid)` — Blood-Queen vampires were adding 3.8M
- Combined: 289.26M → ~275M vs UWU 276.045M (residual ~1M = pre-summoned pets, expected)
- 31 TDD tests passing

### Gunship difficulty normalization (previous commit)
- `_normalize_session_difficulty` upgrades Gunship to session heroic difficulty
- Gunship should now show 25H KILL

---

## Immediate Next Steps

1. Wait for Railway deploy
2. Clear DB → re-upload same log
3. Verify: BPC ~41.7M, Blood-Queen ~70M, session total ~275-276M, Gunship = 25H KILL

---

## Known Remaining Limitation

~1M under UWU = pre-summoned pets (Hunter beasts, Warlock demons summoned before log start have no SPELL_SUMMON → unattributed). Not a bug.

---

## Not Working On
- UI redesigns
- Non-ICC content
- Absorbs tracking (backlog)
