# ICC 25H Synthetic — Lord Marrowgar (Heroic)

Synthetic log: 25 players, ENCOUNTER_START with difficultyID=4 (25N — Warmane bug).
Bone Slice appears as spell name (heroic-only marker).

This fixture validates the Task 1 bug fix: heroic detection must run even when
ENCOUNTER_START is present with wrong difficultyID.

Expected outcome: difficulty=25H (upgraded from 25N via Bone Slice marker).
Total damage = 165600 (SPELL_DAMAGE: 144000 + SWING_DAMAGE: 21600).
Duration ≈ 29s (ENCOUNTER_START at 00:00:01 → ENCOUNTER_END at 00:00:30.1).
