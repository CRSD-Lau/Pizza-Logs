#!/usr/bin/env python3
"""
UWU Parity Validation Harness.
Runs the real parser against WoWCombatLog.txt and compares to UWU reference values.

Usage:
    PIZZA_LOG_PATH=/path/to/WoWCombatLog.txt python validate_uwu.py
    PIZZA_LOG_PATH=/path/to/WoWCombatLog.txt pytest validate_uwu.py -v
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from parser_core import CombatLogParser

LOG_PATH = os.environ.get("PIZZA_LOG_PATH", "")

# ── UWU Reference Values ──────────────────────────────────────────────────────
# Source: screenshots + UWU report URLs provided by user, 2026-04-25

UWU_S1 = {  # 25H session — Notlich — 26-04-19--13-02
    "session_damage": 407_718_447,
    "session_healing": 49_629_161,
    "Lord Marrowgar":        {"difficulty":"25H","outcome":"KILL","duration":234.758,"damage":51_485_997,"dps":219_315.1,"healing":8_656_055,"hps":36_872.2},
    "Lady Deathwhisper":     {"difficulty":"25N","outcome":"KILL","duration":179.008,"damage":35_747_394,"dps":199_697.1,"healing":3_084_597,"hps":17_231.6},
    "Deathbringer Saurfang": {"difficulty":"25H","outcome":"KILL","duration":205.553,"damage":47_742_135,"dps":232_261.9,"healing":4_191_806,"hps":20_392.8},
    "Blood Prince Council":  {"difficulty":"25H","outcome":"KILL","duration":308.449,"damage":41_175_251,"dps":133_491.2,"healing":9_741_570,"hps":31_582.4},
    "Blood-Queen Lana'thel": {"difficulty":"25H","outcome":"KILL","duration":296.501,"damage":71_300_593,"dps":240_473.3,"healing":58_780_938,"hps":198_248.7},
}

UWU_S0 = {  # 10N session — Felyyia — 26-04-18--23-06
    "Sindragosa":           {"difficulty":"10N","outcome":"KILL","duration":437.751,"damage":13_810_208,"dps":31_548.0,"healing":5_696_213,"hps":13_012.4},
    "Blood Prince Council": {"difficulty":"10N","outcome":"KILL","duration":224.178,"damage":10_397_690,"dps":46_381.4,"healing":2_714_383,"hps":12_108.1},
}

# Tolerance: UWU rounds to 1 decimal for DPS/HPS, so allow 1% delta
DMG_TOL  = 0.01   # 1% for total damage (encounter boundary differences)
DPS_TOL  = 0.01   # 1% for DPS/HPS
DUR_TOL  = 1.0    # 1 second for duration


def _load_encounters():
    """Parse the real log file. Returns (parser, encounters)."""
    if not LOG_PATH or not os.path.exists(LOG_PATH):
        pytest.skip(f"Set PIZZA_LOG_PATH to run parity tests (got: {LOG_PATH!r})")
    parser = CombatLogParser(file_year=2026)
    with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as fh:
        encounters = parser.parse_file(fh)
    return parser, encounters


def _find_enc(encounters, boss_name, session_idx, difficulty=None):
    """Find the KILL encounter for a boss in a session.

    If not found at the expected session_idx, searches all sessions as a
    fallback (prints a warning so session-index bugs surface in the table).
    """
    def _match(e, sid):
        if e.session_index != sid or e.boss_name != boss_name:
            return False
        return difficulty is None or e.difficulty == difficulty

    # Primary: exact session_idx, KILL outcome
    for e in encounters:
        if _match(e, session_idx) and e.outcome == "KILL":
            return e
    # Secondary: exact session_idx, any outcome
    for e in encounters:
        if _match(e, session_idx):
            return e
    # Cross-session fallback: correct difficulty, KILL outcome
    for e in encounters:
        if e.boss_name == boss_name and e.outcome == "KILL":
            if difficulty is None or e.difficulty == difficulty:
                print(f"  [WARN] {boss_name}: expected session {session_idx}, found at session {e.session_index}")
                return e
    # Cross-session fallback: correct difficulty, any outcome
    for e in encounters:
        if e.boss_name == boss_name:
            if difficulty is None or e.difficulty == difficulty:
                print(f"  [WARN] {boss_name}: expected session {session_idx}, found at session {e.session_index}")
                return e
    return None


def _pct(actual, expected):
    if expected == 0:
        return 0.0
    return abs(actual - expected) / expected * 100


def print_table(rows):
    """Print a comparison table to stdout."""
    header = f"{'Metric':<45} {'UWU Expected':>15} {'App Output':>15} {'Delta %':>8} {'Status':>6}"
    print("\n" + "=" * len(header))
    print(header)
    print("=" * len(header))
    for row in rows:
        metric, uwu, app, tol = row
        if uwu == 0:
            pct = 0.0
            status = "N/A"
        else:
            pct = abs(app - uwu) / uwu * 100
            status = "OK" if pct <= tol * 100 else "FAIL"
        print(f"{metric:<45} {uwu:>15,.1f} {app:>15,.1f} {pct:>7.2f}% {status:>6}")
    print("=" * len(header))


# ── Session-level tests ───────────────────────────────────────────────────────

def test_s1_session_damage():
    parser, encs = _load_encounters()
    # S1 is always the larger session (25H) — pick largest session_damage value
    all_session_dmg = sorted(parser.session_damage.values(), reverse=True)
    app_dmg = all_session_dmg[0] if all_session_dmg else 0
    pct = _pct(app_dmg, UWU_S1["session_damage"])
    assert pct <= DMG_TOL * 100, (
        f"S1 session damage: UWU={UWU_S1['session_damage']:,} app={app_dmg:,} delta={pct:.2f}%"
    )


# ── Per-encounter Level 2 tests ───────────────────────────────────────────────

@pytest.mark.parametrize("boss,ref", [
    ("Lord Marrowgar",        UWU_S1["Lord Marrowgar"]),
    ("Lady Deathwhisper",     UWU_S1["Lady Deathwhisper"]),
    ("Deathbringer Saurfang", UWU_S1["Deathbringer Saurfang"]),
    ("Blood Prince Council",  UWU_S1["Blood Prince Council"]),
    ("Blood-Queen Lana'thel", UWU_S1["Blood-Queen Lana'thel"]),
])
def test_s1_encounter_damage(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=1, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 1"
    pct = _pct(enc.total_damage, ref["damage"])
    assert pct <= DMG_TOL * 100, (
        f"{boss} damage: UWU={ref['damage']:,} app={enc.total_damage:,.0f} delta={pct:.2f}%"
    )


@pytest.mark.parametrize("boss,ref", [
    ("Lord Marrowgar",        UWU_S1["Lord Marrowgar"]),
    ("Lady Deathwhisper",     UWU_S1["Lady Deathwhisper"]),
    ("Deathbringer Saurfang", UWU_S1["Deathbringer Saurfang"]),
    ("Blood Prince Council",  UWU_S1["Blood Prince Council"]),
    ("Blood-Queen Lana'thel", UWU_S1["Blood-Queen Lana'thel"]),
])
def test_s1_encounter_dps(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=1, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 1"
    app_dps = enc.total_damage / max(1.0, enc.duration_seconds)
    pct = _pct(app_dps, ref["dps"])
    assert pct <= DPS_TOL * 100, (
        f"{boss} DPS: UWU={ref['dps']:.1f} app={app_dps:.1f} delta={pct:.2f}%"
    )


@pytest.mark.parametrize("boss,ref", [
    ("Lord Marrowgar",        UWU_S1["Lord Marrowgar"]),
    ("Lady Deathwhisper",     UWU_S1["Lady Deathwhisper"]),
    ("Deathbringer Saurfang", UWU_S1["Deathbringer Saurfang"]),
    ("Blood Prince Council",  UWU_S1["Blood Prince Council"]),
    ("Blood-Queen Lana'thel", UWU_S1["Blood-Queen Lana'thel"]),
])
def test_s1_encounter_healing(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=1, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 1"
    pct = _pct(enc.total_healing, ref["healing"])
    assert pct <= DMG_TOL * 100, (
        f"{boss} healing: UWU={ref['healing']:,} app={enc.total_healing:,.0f} delta={pct:.2f}%"
    )


@pytest.mark.parametrize("boss,ref", [
    ("Lord Marrowgar",        UWU_S1["Lord Marrowgar"]),
    ("Lady Deathwhisper",     UWU_S1["Lady Deathwhisper"]),
    ("Deathbringer Saurfang", UWU_S1["Deathbringer Saurfang"]),
    ("Blood Prince Council",  UWU_S1["Blood Prince Council"]),
    ("Blood-Queen Lana'thel", UWU_S1["Blood-Queen Lana'thel"]),
])
def test_s1_encounter_hps(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=1, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 1"
    app_hps = enc.total_healing / max(1.0, enc.duration_seconds)
    pct = _pct(app_hps, ref["hps"])
    assert pct <= DPS_TOL * 100, (
        f"{boss} HPS: UWU={ref['hps']:.1f} app={app_hps:.1f} delta={pct:.2f}%"
    )


@pytest.mark.parametrize("boss,ref", [
    ("Lord Marrowgar",        UWU_S1["Lord Marrowgar"]),
    ("Lady Deathwhisper",     UWU_S1["Lady Deathwhisper"]),
    ("Deathbringer Saurfang", UWU_S1["Deathbringer Saurfang"]),
    ("Blood Prince Council",  UWU_S1["Blood Prince Council"]),
    ("Blood-Queen Lana'thel", UWU_S1["Blood-Queen Lana'thel"]),
])
def test_s1_encounter_duration(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=1, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 1"
    assert abs(enc.duration_seconds - ref["duration"]) <= DUR_TOL, (
        f"{boss} duration: UWU={ref['duration']:.3f}s app={enc.duration_seconds:.3f}s"
    )


@pytest.mark.parametrize("boss,ref", list(UWU_S0.items()))
def test_s0_encounter_damage(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=0, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 0"
    pct = _pct(enc.total_damage, ref["damage"])
    assert pct <= DMG_TOL * 100, (
        f"S0 {boss} damage: UWU={ref['damage']:,} app={enc.total_damage:,.0f} delta={pct:.2f}%"
    )


@pytest.mark.parametrize("boss,ref", list(UWU_S0.items()))
def test_s0_encounter_healing(boss, ref):
    _, encs = _load_encounters()
    enc = _find_enc(encs, boss, session_idx=0, difficulty=ref["difficulty"])
    assert enc is not None, f"Encounter '{boss}' not found in session 0"
    pct = _pct(enc.total_healing, ref["healing"])
    assert pct <= DMG_TOL * 100, (
        f"S0 {boss} healing: UWU={ref['healing']:,} app={enc.total_healing:,.0f} delta={pct:.2f}%"
    )


# ── Standalone table runner ───────────────────────────────────────────────────

if __name__ == "__main__":
    if not LOG_PATH or not os.path.exists(LOG_PATH):
        print(f"ERROR: set PIZZA_LOG_PATH. Got: {LOG_PATH!r}")
        sys.exit(1)

    parser, encs = _load_encounters()
    all_session_dmg = sorted(parser.session_damage.values(), reverse=True)
    s1_dmg = all_session_dmg[0] if len(all_session_dmg) > 0 else 0

    rows = [
        ("S1 session damage", UWU_S1["session_damage"], s1_dmg, DMG_TOL),
    ]

    for boss, ref in [
        ("Lord Marrowgar",        UWU_S1["Lord Marrowgar"]),
        ("Lady Deathwhisper",     UWU_S1["Lady Deathwhisper"]),
        ("Deathbringer Saurfang", UWU_S1["Deathbringer Saurfang"]),
        ("Blood Prince Council",  UWU_S1["Blood Prince Council"]),
        ("Blood-Queen Lana'thel", UWU_S1["Blood-Queen Lana'thel"]),
    ]:
        enc = _find_enc(encs, boss, session_idx=1, difficulty=ref["difficulty"])
        if enc:
            app_dps = enc.total_damage / max(1.0, enc.duration_seconds)
            app_hps = enc.total_healing / max(1.0, enc.duration_seconds)
            rows += [
                (f"S1 {boss} damage",   ref["damage"],  enc.total_damage,  DMG_TOL),
                (f"S1 {boss} DPS",      ref["dps"],     app_dps,           DPS_TOL),
                (f"S1 {boss} healing",  ref["healing"], enc.total_healing, DMG_TOL),
                (f"S1 {boss} HPS",      ref["hps"],     app_hps,           DPS_TOL),
                (f"S1 {boss} duration", ref["duration"],enc.duration_seconds, 0.004),
            ]
        else:
            print(f"  [MISSING] {boss} (25H session 1)")

    for boss, ref in UWU_S0.items():
        enc = _find_enc(encs, boss, session_idx=0, difficulty=ref["difficulty"])
        if enc:
            app_dps = enc.total_damage / max(1.0, enc.duration_seconds)
            rows += [
                (f"S0 {boss} damage",  ref["damage"],  enc.total_damage, DMG_TOL),
                (f"S0 {boss} DPS",     ref["dps"],     app_dps,          DPS_TOL),
                (f"S0 {boss} healing", ref["healing"], enc.total_healing, DMG_TOL),
            ]
        else:
            print(f"  [MISSING] {boss} (10N session 0)")

    print_table(rows)
    failing = sum(1 for r in rows if r[1] and abs(r[2] - r[1]) / r[1] * 100 > r[3] * 100)
    print(f"\n{len(rows) - failing}/{len(rows)} checks passing")
    sys.exit(0 if failing == 0 else 1)
