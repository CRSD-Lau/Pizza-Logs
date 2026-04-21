"""
Parser correctness tests — TDD suite.

Run from the parser/ directory:
    pytest tests/ -v
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from parser_core import (
    CombatLogParser, ParsedEncounter, DMG_EVENTS,
    UNIT_DIED_EVENT, ENCOUNTER_START, ENCOUNTER_END,
    _decode_difficulty, _is_player,
)
from bosses import lookup_boss


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_encounter(boss_name: str, difficulty: str = "25N", session_index: int = 0,
                   outcome: str = "KILL") -> ParsedEncounter:
    return ParsedEncounter(
        boss_name=boss_name,
        boss_def=lookup_boss(boss_name),
        boss_id=None,
        difficulty=difficulty,
        group_size=25,
        outcome=outcome,
        duration_seconds=200,
        started_at="2026-04-19T13:00:00+00:00",
        ended_at="2026-04-19T13:03:20+00:00",
        total_damage=50_000_000.0,
        total_healing=10_000_000.0,
        total_damage_taken=5_000_000.0,
        fingerprint="test",
        participants=[],
        raw_event_count=1000,
        session_index=session_index,
    )


def _spell_damage_parts(src_guid: str, src_name: str,
                        dst_guid: str, dst_name: str,
                        amount: int, spell: str = "Fireball",
                        event: str = "SPELL_DAMAGE") -> list[str]:
    """Build a minimal SPELL_DAMAGE parts list (18 fields)."""
    return [
        event,
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        "133", f'"{spell}"', "4",
        str(amount), "0", "4", "0", "0", "0", "0", "0",
    ]


def _unit_died_parts(dead_name: str) -> list[str]:
    """Build a minimal UNIT_DIED parts list."""
    return [
        UNIT_DIED_EVENT,
        "0x0600000000000001", '"Phyre"', "0x512",
        "0xF130000000000001", f'"{dead_name}"', "0xa48",
        "0",
    ]


PLAYER_GUID = "0x0600000000000001"
NPC_GUID    = "0xF130000000000001"


def make_gunship_segment(
    crew_death: str = "Kor'kron Battle-Mage",
    encounter_end_success: int = 0,
    damage_event: str = "SPELL_DAMAGE",
    damage_amount: int = 50_000,
) -> list[tuple[str, list[str], float]]:
    """Build a minimal Gunship Battle segment.

    By default mirrors the Warmane pattern: ENCOUNTER_END success=0 even on kill,
    but crew member dies inside the window.
    """
    ts = 46800.0
    return [
        (
            "4/19 13:00:00.000",
            [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"],
            ts,
        ),
        (
            "4/19 13:01:00.000",
            _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, crew_death,
                                damage_amount, event=damage_event),
            ts + 60,
        ),
        (
            "4/19 13:02:00.000",
            _unit_died_parts(crew_death),
            ts + 120,
        ),
        (
            "4/19 13:03:21.000",
            [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25",
             str(encounter_end_success)],
            ts + 201,
        ),
    ]


# ── DMG_EVENTS exclusion regressions ──────────────────────────────────────────

def test_damage_shield_excluded_from_dmg_events():
    """DAMAGE_SHIELD is retribution-aura/thorns reflect — not player DPS."""
    assert "DAMAGE_SHIELD" not in DMG_EVENTS


def test_spell_building_damage_excluded_from_dmg_events():
    """SPELL_BUILDING_DAMAGE is vehicle/cannon fire — not player DPS."""
    assert "SPELL_BUILDING_DAMAGE" not in DMG_EVENTS


def test_core_dmg_events_present():
    """SPELL_DAMAGE, SWING_DAMAGE, RANGE_DAMAGE, SPELL_PERIODIC_DAMAGE must remain."""
    for ev in ("SPELL_DAMAGE", "SWING_DAMAGE", "RANGE_DAMAGE", "SPELL_PERIODIC_DAMAGE"):
        assert ev in DMG_EVENTS, f"{ev} missing from DMG_EVENTS"


# ── Difficulty decoding ────────────────────────────────────────────────────────

def test_decode_difficulty_25h():
    assert _decode_difficulty(6, 25) == "25H"

def test_decode_difficulty_25n():
    assert _decode_difficulty(4, 25) == "25N"

def test_decode_difficulty_10h():
    assert _decode_difficulty(5, 10) == "10H"

def test_decode_difficulty_10n():
    assert _decode_difficulty(3, 10) == "10N"

def test_decode_difficulty_fallback_25():
    assert _decode_difficulty(99, 25) == "25N"

def test_decode_difficulty_fallback_10():
    assert _decode_difficulty(99, 10) == "10N"


# ── _is_player ─────────────────────────────────────────────────────────────────

def test_is_player_warmane_guid():
    assert _is_player("0x0600000000B8F53B") is True

def test_is_player_retail_format():
    assert _is_player("Player-1234-AB123456") is True

def test_is_player_npc_guid():
    assert _is_player("0xF130000000000001") is False

def test_is_player_null_guid():
    assert _is_player("0x0000000000000000") is False

def test_is_player_empty():
    assert _is_player("") is False


# ── Gunship outcome: ENCOUNTER_END override ────────────────────────────────────

def test_gunship_kill_from_korkron_crew_death():
    """ENCOUNTER_END success=0, but Kor'kron Battle-Mage died → KILL (Alliance log)."""
    parser = CombatLogParser()
    seg = make_gunship_segment(crew_death="Kor'kron Battle-Mage", encounter_end_success=0)
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


def test_gunship_kill_from_korkron_primalist_death():
    """ENCOUNTER_END success=0, Kor'kron Primalist died → KILL."""
    parser = CombatLogParser()
    seg = make_gunship_segment(crew_death="Kor'kron Primalist", encounter_end_success=0)
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


def test_gunship_kill_from_skybreaker_crew_death():
    """ENCOUNTER_END success=0, Skybreaker Rifleman died → KILL (Horde log)."""
    parser = CombatLogParser()
    seg = make_gunship_segment(crew_death="Skybreaker Rifleman", encounter_end_success=0)
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


def test_gunship_wipe_when_no_crew_dies():
    """No crew UNIT_DIED + ENCOUNTER_END success=0 → WIPE."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Skybreaker Cannon", 5000),
         ts + 60),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "WIPE"


def test_gunship_kill_from_encounter_end_success():
    """ENCOUNTER_END success=1 → KILL regardless of crew deaths."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Target", 5000),
         ts + 60),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL"


# ── Gunship difficulty: session-level normalization ────────────────────────────
# These tests are RED — _normalize_session_difficulty does not exist yet.

def test_gunship_difficulty_upgraded_to_match_session_heroic():
    """Gunship has no heroic-specific spells; difficulty must be inferred
    from the session context when other encounters in the same session are HC."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert gunship.difficulty == "25H"


def test_gunship_difficulty_unchanged_when_already_heroic():
    """If Gunship is already 25H, normalization must not change it."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Gunship Battle", difficulty="25H", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert gunship.difficulty == "25H"


def test_gunship_difficulty_unchanged_in_all_normal_session():
    """If the whole session is normal, Gunship stays 25N."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert gunship.difficulty == "25N"


def test_non_gunship_difficulty_not_changed_by_normalization():
    """Lady Deathwhisper at 25N in a heroic session must NOT be changed —
    only Gunship gets the special session-inference treatment."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Lady Deathwhisper", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    dw = next(e for e in encounters if "deathwhisper" in e.boss_name.lower())
    assert dw.difficulty == "25N"


def test_gunship_difficulty_not_cross_contaminated_across_sessions():
    """A Gunship in a session-0 normal run must not be upgraded by session-1 heroics."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle",  difficulty="25N", session_index=0),
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=1),
        make_encounter("Gunship Battle",  difficulty="25N", session_index=1),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    session0_gunship = next(
        e for e in encounters if "gunship" in e.boss_name.lower() and e.session_index == 0
    )
    session1_gunship = next(
        e for e in encounters if "gunship" in e.boss_name.lower() and e.session_index == 1
    )
    assert session0_gunship.difficulty == "25N"
    assert session1_gunship.difficulty == "25H"


# ── Damage exclusion integration ───────────────────────────────────────────────

def test_spell_building_damage_not_counted_in_total():
    """SPELL_BUILDING_DAMAGE events from a player GUID must not
    contribute to total_damage — they're vehicle/cannon fire."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        # Legitimate player damage
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Kor'kron Battle-Mage",
                             100_000, "Fireball", "SPELL_DAMAGE"),
         ts + 60),
        # SPELL_BUILDING_DAMAGE — cannon fire — must NOT be counted
        ("4/19 13:01:30.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Orgrim's Hammer",
                             5_000_000, "Skybreaker Cannon", "SPELL_BUILDING_DAMAGE"),
         ts + 90),
        ("4/19 13:02:00.000",
         _unit_died_parts("Kor'kron Battle-Mage"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    # Only the 100k Fireball should count — not the 5M cannon shot
    assert enc.total_damage == pytest.approx(100_000, rel=0.01)


def test_damage_shield_not_counted_in_total():
    """DAMAGE_SHIELD events must not contribute to total_damage."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Real damage
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             200_000, "Holy Shock", "SPELL_DAMAGE"),
         ts + 60),
        # Retribution Aura reflect — must NOT be counted
        ("4/19 13:01:10.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             3_000_000, "Retribution Aura", "DAMAGE_SHIELD"),
         ts + 70),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(200_000, rel=0.01)
