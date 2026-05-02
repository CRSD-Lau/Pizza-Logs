# ICC 25N Synthetic — Lord Marrowgar

Minimal synthetic log: 2 players, 8 damage events (4 each), ENCOUNTER_START difficultyID=4,
ENCOUNTER_END success=1. The parser requires MIN_ENCOUNTER_EVENTS=10 so we use 8 damage
events + ENCOUNTER_START + UNIT_DIED + ENCOUNTER_END = 11 total to pass the threshold.

Expected total_damage = 54000 (Phyre 30000 + Lausudo 24000).
Duration = timestamp of ENCOUNTER_END - ENCOUNTER_START ≈ 26.1s.

This fixture validates:
- ENCOUNTER_START/END path (not heuristic)
- 25N difficulty from difficultyID=4
- KILL from ENCOUNTER_END success=1
- Two-player participant list
- Basic damage aggregation
