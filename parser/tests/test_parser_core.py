"""
Parser correctness tests — TDD suite.

Run from the parser/ directory:
    pytest tests/ -v
"""
import sys
import os
import io
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from parser_core import (
    CombatLogParser, ParsedEncounter, DMG_EVENTS,
    UNIT_DIED_EVENT, ENCOUNTER_START, ENCOUNTER_END,
    GUNSHIP_CREW_NAMES,
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
                        event: str = "SPELL_DAMAGE",
                        overkill: int = 0) -> list[str]:
    """Build a minimal SPELL_DAMAGE parts list (18 fields)."""
    return [
        event,
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        "133", f'"{spell}"', "4",
        str(amount), str(overkill), "4", "0", "0", "0", "0", "0",
    ]


def _swing_damage_parts(src_guid: str, src_name: str,
                        dst_guid: str, dst_name: str,
                        amount: int, overkill: int = 0) -> list[str]:
    """Build a minimal SWING_DAMAGE parts list (14 fields)."""
    return [
        "SWING_DAMAGE",
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        str(amount), str(overkill), "1", "0", "0", "0", "0",
    ]


def _unit_died_parts(dead_name: str) -> list[str]:
    """Build a minimal UNIT_DIED parts list."""
    return [
        UNIT_DIED_EVENT,
        "0x0600000000000001", '"Phyre"', "0x512",
        "0xF130000000000001", f'"{dead_name}"', "0xa48",
        "0",
    ]


PLAYER_GUID      = "0x0600000000000001"
NPC_GUID         = "0xF130000000000001"
TRUE_PET_GUID    = "0xF140000000000001"  # 0xF140 = true WotLK pet GUID prefix
VEHICLE_GUID     = "0xF150000000000001"  # 0xF150 = vehicle GUID prefix

# dst_flags: 0x1114 = TYPE_PET | CONTROL_PLAYER | FRIENDLY | RAID (player-owned pet)
PET_DST_FLAGS     = "0x1114"
VEHICLE_DST_FLAGS = "0x1114"


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


def _log_line(ts: str, parts: list[str]) -> str:
    return f"{ts}  {','.join(parts)}\n"


# ── DMG_EVENTS membership — sourced from Skada Damage.lua RegisterForCL ───────
#
# Skada registers: SPELL_DAMAGE, SWING_DAMAGE, RANGE_DAMAGE, SPELL_PERIODIC_DAMAGE,
#                  DAMAGE_SHIELD, DAMAGE_SPLIT, SPELL_BUILDING_DAMAGE
# We track all of them so the website matches what players see in Skada in-game.

def test_damage_shield_in_dmg_events():
    """DAMAGE_SHIELD (Ret Aura / Thorns reflect) is in DMG_EVENTS — Skada tracks it."""
    assert "DAMAGE_SHIELD" in DMG_EVENTS


def test_spell_building_damage_in_dmg_events():
    """SPELL_BUILDING_DAMAGE (Gunship cannons) is in DMG_EVENTS — Skada tracks it."""
    assert "SPELL_BUILDING_DAMAGE" in DMG_EVENTS


def test_damage_split_in_dmg_events():
    """DAMAGE_SPLIT (shared-damage mechanics) is in DMG_EVENTS — Skada tracks it."""
    assert "DAMAGE_SPLIT" in DMG_EVENTS


def test_core_dmg_events_present():
    """All Skada-registered damage event types must be in DMG_EVENTS."""
    for ev in ("SPELL_DAMAGE", "SWING_DAMAGE", "RANGE_DAMAGE", "SPELL_PERIODIC_DAMAGE",
               "DAMAGE_SHIELD", "DAMAGE_SPLIT", "SPELL_BUILDING_DAMAGE"):
        assert ev in DMG_EVENTS, f"{ev} missing from DMG_EVENTS"


# ── Difficulty decoding ────────────────────────────────────────────────────────

def test_short_explicit_marker_encounter_is_parsed():
    """ENCOUNTER_START/END is authoritative even when a partial log has few events."""
    log = "".join([
        _log_line("4/19 13:00:00.000", [ENCOUNTER_START, "36612", '"Lord Marrowgar"', "4", "25"]),
        _log_line(
            "4/19 13:00:01.000",
            _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar", 1234),
        ),
        _log_line("4/19 13:00:02.000", _unit_died_parts("Lord Marrowgar")),
        _log_line("4/19 13:00:02.100", [ENCOUNTER_END, "36612", '"Lord Marrowgar"', "4", "25", "1"]),
    ])

    encounters = CombatLogParser().parse_file(io.StringIO(log))

    assert len(encounters) == 1
    assert encounters[0].boss_name == "Lord Marrowgar"
    assert encounters[0].outcome == "KILL"
    assert encounters[0].total_damage == 1234


def test_malformed_lines_are_counted_and_warned():
    """Bad input lines should be counted and reported without crashing parsing."""
    parser = CombatLogParser()
    encounters = parser.parse_file(io.StringIO("\n".join([
        "this is not a combat log line",
        "4/19 13:00:01.000  SPELL_DAMAGE",
        "",
    ])))

    assert encounters == []
    assert parser.skipped_line_count == 2
    assert parser.skipped_line_reasons["missing_timestamp_separator"] == 1
    assert parser.skipped_line_reasons["too_few_fields"] == 1
    assert "Skipped 2 malformed combat-log lines." in parser.warnings


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


# ── Gunship crew name coverage ───────────────────────────────────────────────

_ALL_GUNSHIP_CREW_NAMES = [
    # Horde log: Skybreaker (Alliance ship) crew
    "Muradin Bronzebeard",
    "High Captain Justin Bartlett",
    "Skybreaker Sorcerer",
    "Skybreaker Rifleman",
    "Skybreaker Sergeant",
    "Skybreaker Mortar Soldier",
    "Skybreaker Vindicator",
    "Skybreaker Marksman",
    # Alliance log: Kor'kron (Horde ship) crew
    "Kor'kron Battle-Mage",
    "Kor'kron Primalist",
    "Kor'kron Defender",
    "Kor'kron Invoker",
    "Kor'kron Reaver",
    "Kor'kron Sergeant",
]


@pytest.mark.parametrize("crew_name", _ALL_GUNSHIP_CREW_NAMES)
def test_gunship_kill_all_crew_names(crew_name):
    """Any crew member dying during Gunship produces KILL outcome."""
    seg = make_gunship_segment(crew_death=crew_name, encounter_end_success=0)
    p = CombatLogParser()
    enc = p._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "KILL", (
        f"Expected KILL when '{crew_name}' dies, got {enc.outcome}"
    )


def test_gunship_wipe_no_crew_deaths():
    """No crew deaths + ENCOUNTER_END success=0 → WIPE."""
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Gunship Battle", 50_000),
         ts + 60),
        ("4/19 13:02:30.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"],
         ts + 150),
    ]
    p = CombatLogParser()
    enc = p._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.outcome == "WIPE", f"Expected WIPE, got {enc.outcome}"


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


def test_25n_non_gunship_in_25h_session_is_not_promoted_without_evidence():
    """Normal-looking non-Gunship attempts must not inherit heroic session state."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0),
        make_encounter("Lady Deathwhisper", difficulty="25N", session_index=0),
        make_encounter("Gunship Battle", difficulty="25N", session_index=0),
    ]
    CombatLogParser._normalize_session_difficulty(encounters)
    dw = next(e for e in encounters if "deathwhisper" in e.boss_name.lower())
    gunship = next(e for e in encounters if "gunship" in e.boss_name.lower())
    assert dw.difficulty == "25N", (
        f"Lady Deathwhisper without direct heroic evidence must stay '25N', got '{dw.difficulty}'"
    )
    assert gunship.difficulty == "25H"


def test_heroic_wipe_then_normal_kill_keeps_normal_difficulty():
    """A later normal kill after heroic wipes must not inherit heroic session state."""
    encounters = [
        make_encounter("Lord Marrowgar", difficulty="25H", session_index=0, outcome="WIPE"),
        make_encounter("Lord Marrowgar", difficulty="25N", session_index=0, outcome="KILL"),
    ]

    CombatLogParser._normalize_session_difficulty(encounters)

    assert encounters[0].difficulty == "25H"
    assert encounters[1].difficulty == "25N"


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


# ── Damage event integration — Skada counts all registered event types ─────────

def test_spell_building_damage_counted_in_total():
    """SPELL_BUILDING_DAMAGE (Gunship cannon fire) counts toward total_damage.

    Source: Skada Damage.lua registers SPELL_BUILDING_DAMAGE via RegisterForCL.
    Skada shows cannon fire in a player's damage done, so we do too.
    """
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts),
        # Regular spell damage
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Kor'kron Battle-Mage",
                             100_000, "Fireball", "SPELL_DAMAGE"),
         ts + 60),
        # Cannon fire — Skada counts this
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
    # Both Fireball and cannon shot count — Skada tracks SPELL_BUILDING_DAMAGE
    assert enc.total_damage == pytest.approx(5_100_000, rel=0.01)


def test_damage_shield_counted_in_total():
    """DAMAGE_SHIELD (Ret Aura / Thorns) counts toward total_damage.

    Source: Skada Damage.lua registers DAMAGE_SHIELD via RegisterForCL.
    Skada shows reflected damage in a player's damage done, so we do too.
    """
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Regular damage
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             200_000, "Holy Shock", "SPELL_DAMAGE"),
         ts + 60),
        # Retribution Aura reflect — Skada counts this
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
    # Both spell damage and reflect count — Skada tracks DAMAGE_SHIELD
    assert enc.total_damage == pytest.approx(3_200_000, rel=0.01)


# ── Overkill subtraction ───────────────────────────────────────────────────────

def test_overkill_not_counted_in_spell_damage():
    """SPELL_DAMAGE overkill must be subtracted from total_damage.
    Root cause of BPC 7.8M over-count: three princes die simultaneously,
    every last hit overkills. Parser was using raw amount, not amount-overkill."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # 100k hit, 30k overkill → effective = 70k
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             100_000, "Fireball", "SPELL_DAMAGE", overkill=30_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(70_000, rel=0.01)


def test_overkill_not_counted_in_swing_damage():
    """SWING_DAMAGE overkill must also be subtracted."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # 200k swing, 50k overkill → effective = 150k
        ("4/19 13:01:00.000",
         _swing_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             200_000, overkill=50_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(150_000, rel=0.01)


def test_zero_overkill_unchanged():
    """When overkill=0 the effective damage equals raw amount."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             500_000, "Fireball", "SPELL_DAMAGE", overkill=0),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(500_000, rel=0.01)


# ── Player-to-player damage exclusion ─────────────────────────────────────────

def test_player_to_player_damage_not_counted():
    """Damage from a player to another player must not count as DPS.
    Root cause of Blood-Queen 3.8M over-count: bitten vampires attack
    other raid members (Pact of Darkfallen, Blood Mirror, Vampiric Bite)."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Blood-Queen Lana\'thel"', "6", "25"], ts),
        # Legitimate DPS to boss
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Blood-Queen Lana'thel",
                             200_000, "Fireball"),
         ts + 60),
        # Vampire bites fellow player — must NOT count
        ("4/19 13:01:30.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", PLAYER_GUID, "Notlich",
                             500_000, "Pact of the Darkfallen"),
         ts + 90),
        ("4/19 13:02:00.000",
         _unit_died_parts("Blood-Queen Lana'thel"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Blood-Queen Lana\'thel"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(200_000, rel=0.01)


def test_player_to_npc_damage_still_counted():
    """Player damage to NPCs must still be counted after P2P filter lands."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        ("4/19 13:01:00.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar",
                             300_000, "Holy Shock"),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(300_000, rel=0.01)


# ── Pet owner inference — interaction scan ────────────────────────────────────

def _aoe_buff_parts(caster_guid: str, caster_name: str,
                    target_guid: str, target_name: str,
                    target_flags: str = PET_DST_FLAGS) -> list[str]:
    """SPELL_AURA_APPLIED representing an AoE buff hitting a pet (e.g. BoM)."""
    return [
        "SPELL_AURA_APPLIED",
        caster_guid, f'"{caster_name}"', "0x512",
        target_guid, f'"{target_name}"', target_flags,
        "19506", '"Blessing of Might"', "2", "BUFF",
    ]


def _run_segment_encounters(events: list[tuple[str, list[str], float]]):
    """Run _segment_encounters on a pre-built event list."""
    parser = CombatLogParser()
    def gen():
        yield from events
    return parser._segment_encounters(gen())


def test_vehicle_not_mapped_as_pet_via_aoe_buff():
    """A vehicle GUID (0xF150) that receives an AoE buff from a player
    must NOT be added to pet_owner. Gunship Cannons were 4.46M of fake DPS."""
    ts = 46800.0
    events = [
        # Player buffs a vehicle-flagged target (like stepping into a cannon seat)
        ("4/19 13:00:00.000",
         _aoe_buff_parts(PLAYER_GUID, "Phyre", VEHICLE_GUID, "Skybreaker Cannon",
                         target_flags=VEHICLE_DST_FLAGS),
         ts),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Gunship Battle"', "4", "25"], ts + 60),
        ("4/19 13:02:00.000",
         [ENCOUNTER_END, "1234", '"Gunship Battle"', "4", "25", "0"], ts + 120),
    ]
    _, pet_owner = _run_segment_encounters(events)
    assert VEHICLE_GUID not in pet_owner, "Vehicle GUID must not be mapped as a player pet"


def test_npc_guid_not_mapped_via_non_heal_event():
    """A regular NPC GUID (0xF130) interacted with via a non-heal event
    must NOT enter pet_owner — only true 0xF140 pet GUIDs can be inferred."""
    ts = 46800.0
    events = [
        # Player casts a buff on something with pet flags but 0xF130 GUID
        ("4/19 13:00:00.000",
         _aoe_buff_parts(PLAYER_GUID, "Phyre", NPC_GUID, "SomeNPC"),
         ts),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts + 60),
        ("4/19 13:02:00.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 120),
    ]
    _, pet_owner = _run_segment_encounters(events)
    assert NPC_GUID not in pet_owner, "0xF130 NPC must not be mapped via non-heal event"


def test_hunter_pet_mapped_via_mend_pet():
    """A 0xF140 pet GUID with no SPELL_SUMMON must be attributed to its owner
    via SPELL_PERIODIC_HEAL (Mend Pet). This is the Phase-1 pre-summon fix."""
    ts = 46800.0
    events = [
        # Mend Pet fires before ENCOUNTER_START — owner inference
        ("4/19 13:00:30.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", TRUE_PET_GUID, "Fido"),
         ts + 30),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts + 60),
        ("4/19 13:02:00.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 120),
    ]
    _, pet_owner = _run_segment_encounters(events)
    assert TRUE_PET_GUID in pet_owner, "0xF140 pet must be mapped via Mend Pet"
    assert pet_owner[TRUE_PET_GUID][1] == "Phyre"


def test_pet_damage_attributed_to_owner_via_mend_pet():
    """Damage from a pre-summoned 0xF140 pet must be credited to its owner
    when the owner is inferred from a SPELL_PERIODIC_HEAL (Mend Pet)."""
    ts = 46800.0
    # Build 8 filler player hits so segment reaches MIN_ENCOUNTER_EVENTS (10)
    filler = [
        (f"4/19 13:01:{10+i:02d}.000",
         _spell_damage_parts(PLAYER_GUID, "Phyre", NPC_GUID, "Lord Marrowgar", 10_000),
         ts + 70 + i)
        for i in range(8)
    ]
    events = [
        ("4/19 13:00:30.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", TRUE_PET_GUID, "Fido"),
         ts + 30),
        ("4/19 13:01:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts + 60),
        *filler,
        # Pet attacks the boss during the encounter
        ("4/19 13:01:30.000",
         _spell_damage_parts(TRUE_PET_GUID, "Fido", NPC_GUID, "Lord Marrowgar", 80_000),
         ts + 90),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    segments, pet_owner = _run_segment_encounters(events)
    assert len(segments) == 1
    enc = CombatLogParser()._aggregate_segment(segments[0], pet_owner)
    assert enc is not None
    # total = 8×10k filler + 80k pet = 160k
    assert enc.total_damage == pytest.approx(160_000, rel=0.01)
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "Phyre must appear as participant via pet attribution"
    assert phyre["totalDamage"] == pytest.approx(160_000, rel=0.01)


# ── Pre-summoned pet attribution via interaction scan ──────────────────────────
#
# When a pet was alive before the log started there is no SPELL_SUMMON event.
# The parser must infer ownership from any player→pet event during the fight
# (Mend Pet, Feed Pet, any buff).  The dst_flags bitmask identifies a pet:
#   0x1000 = TYPE_PET   0x0100 = CONTROL_PLAYER  → both must be set.

PET_GUID  = "0xF1300007AC000042"   # realistic non-player NPC GUID for a pet
PET_FLAGS = "0x1114"               # TYPE_PET | CONTROL_PLAYER | FRIENDLY | RAID

PLAYER2_GUID  = "0x0600000000000002"
PLAYER2_FLAGS = "0x514"            # TYPE_PLAYER | CONTROL_PLAYER | FRIENDLY | RAID


def _mend_pet_parts(owner_guid: str, owner_name: str,
                    pet_guid: str, pet_name: str,
                    amount: int = 3000) -> list[str]:
    """SPELL_PERIODIC_HEAL — Mend Pet tick (player heals their pet)."""
    return [
        "SPELL_PERIODIC_HEAL",
        owner_guid, f'"{owner_name}"', PLAYER2_FLAGS,
        pet_guid,   f'"{pet_name}"',   PET_FLAGS,
        "13544", '"Mend Pet"', "8",
        str(amount), "0", "0", "0",
    ]


def _pet_spell_damage_parts(pet_guid: str, pet_name: str,
                             dst_guid: str, dst_name: str,
                             amount: int, spell: str = "Claw") -> list[str]:
    """SPELL_DAMAGE from a player-controlled pet (PET_FLAGS as src_flags)."""
    return [
        "SPELL_DAMAGE",
        pet_guid, f'"{pet_name}"', PET_FLAGS,
        dst_guid, f'"{dst_name}"', "0xa48",
        "16827", f'"{spell}"', "1",
        str(amount), "0", "1", "0", "0", "0", "0", "0",
    ]


def test_presummoned_pet_attributed_via_mend_pet():
    """Pet has no SPELL_SUMMON but owner fires Mend Pet during the fight.
    The pre-pass in _aggregate_segment must infer ownership and credit
    pet damage to the Hunter/owner."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Mend Pet tick fires → establishes owner
        ("4/19 13:00:10.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", PET_GUID, "Growl"),
         ts + 10),
        # Pet attacks boss → should be credited to Phyre
        ("4/19 13:01:00.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 100_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "pet damage not attributed to owner"
    assert phyre["totalDamage"] == pytest.approx(100_000, rel=0.01)


def test_presummoned_pet_attributed_when_damage_comes_before_mend_pet():
    """Even if the pet deals damage BEFORE Mend Pet fires, the pre-pass
    over the whole segment must still attribute the damage correctly."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Pet attacks first — before any owner interaction
        ("4/19 13:00:30.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 80_000),
         ts + 30),
        # Mend Pet fires later in the fight
        ("4/19 13:01:00.000",
         _mend_pet_parts(PLAYER_GUID, "Phyre", PET_GUID, "Growl"),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "pre-pass did not resolve ordering"
    assert phyre["totalDamage"] == pytest.approx(80_000, rel=0.01)


def test_presummoned_pet_without_interaction_remains_unattributed():
    """A pet with no SPELL_SUMMON and no owner interaction must NOT be
    credited to any player — better to under-count than misattribute."""
    parser = CombatLogParser()
    ts = 46800.0
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        ("4/19 13:01:00.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 100_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.total_damage == pytest.approx(0, abs=1)


def test_pet_already_in_pet_owner_not_overwritten_by_interaction():
    """If a pet is already in the pet_owner map (from SPELL_SUMMON), a
    player→pet interaction for a DIFFERENT player must not overwrite it."""
    parser = CombatLogParser()
    ts = 46800.0
    established_owner = {PET_GUID: (PLAYER_GUID, "Phyre")}  # Phyre owns the pet
    seg = [
        ("4/19 13:00:00.000",
         [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts),
        # Some other player heals the pet (e.g. paladin aura, not Mend Pet)
        ("4/19 13:00:10.000",
         _mend_pet_parts(PLAYER2_GUID, "Notlich", PET_GUID, "Growl"),
         ts + 10),
        ("4/19 13:01:00.000",
         _pet_spell_damage_parts(PET_GUID, "Growl", NPC_GUID, "Lord Marrowgar", 50_000),
         ts + 60),
        ("4/19 13:02:00.000",
         _unit_died_parts("Lord Marrowgar"),
         ts + 120),
        ("4/19 13:03:21.000",
         [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts + 201),
    ]
    enc = parser._aggregate_segment(seg, established_owner)
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None, "damage not credited to original owner"
    assert phyre["totalDamage"] == pytest.approx(50_000, rel=0.01)


# ── Full-session damage (parser.session_damage) ───────────────────────────────
#
# parser.session_damage[session_idx] must equal the sum of ALL player/pet damage
# across the entire session (boss pulls + trash), matching what UWU shows.

import io as _io


def _make_full_log(*lines: str) -> str:
    return "".join(lines)


def _pdmg(ts: str, src: str, dst: str, dst_name: str, amount: int,
          overkill: int = 0) -> str:
    """Format a SPELL_DAMAGE log line for parse_file."""
    return (f'{ts}  SPELL_DAMAGE,{src},"Phyre",0x512,'
            f'{dst},"{dst_name}",0xa48,133,"Frostbolt",4,'
            f'{amount},{overkill},4,0,0,0,0,0\n')


def _enc_start(ts: str, boss: str = "Lord Marrowgar",
               bid: int = 1234, diff: int = 6, size: int = 25) -> str:
    return f'{ts}  ENCOUNTER_START,{bid},"{boss}",{diff},{size}\n'


def _enc_end(ts: str, boss: str = "Lord Marrowgar",
             bid: int = 1234, diff: int = 6, size: int = 25,
             success: int = 1) -> str:
    return f'{ts}  ENCOUNTER_END,{bid},"{boss}",{diff},{size},{success}\n'


def _died(ts: str, guid: str, name: str) -> str:
    return (f'{ts}  UNIT_DIED,{PLAYER_GUID},"Phyre",0x512,'
            f'{guid},"{name}",0xa48,0\n')


def test_session_damage_starts_empty():
    """parser.session_damage is an empty dict before parse_file is called."""
    parser = CombatLogParser()
    assert hasattr(parser, "session_damage")
    assert parser.session_damage == {}


def test_session_damage_includes_pre_encounter_trash():
    """Damage that lands before ENCOUNTER_START must appear in session_damage."""
    PG = PLAYER_GUID
    NG = NPC_GUID
    BG = "0xF130000000000002"

    trash_amount = 77_777
    boss_amount  = 55_555

    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG, BG, "Lord Marrowgar", boss_amount)
        for i in range(10)
    )

    log = _make_full_log(
        _pdmg("4/19 13:00:00.000", PG, NG, "Trash Mob", trash_amount),
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = trash_amount + boss_amount * 10
    assert 0 in parser.session_damage, "session 0 must be populated"
    assert parser.session_damage[0] == pytest.approx(expected, rel=0.01)


def test_session_damage_excludes_player_to_player():
    """P2P damage (Blood-Queen vampires etc.) must not appear in session_damage."""
    PG1 = PLAYER_GUID
    PG2 = "0x0600000000000099"  # second player
    BG  = "0xF130000000000002"

    p2p_amount  = 99_999
    boss_amount =  50_000

    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG1, BG, "Lord Marrowgar", boss_amount)
        for i in range(10)
    )

    log = _make_full_log(
        _pdmg("4/19 13:00:00.000", PG1, PG2, "Player2", p2p_amount),
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = boss_amount * 10  # p2p excluded
    assert parser.session_damage.get(0, 0) == pytest.approx(expected, rel=0.01)


def test_session_damage_includes_damage_shield_from_player():
    """DAMAGE_SHIELD (Retribution Aura, thorns) from a player source must be
    included in session_damage. Source: Skada Damage.lua registers DAMAGE_SHIELD."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    shield_amount = 12_345   # e.g. Retribution Aura proc
    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG, BG, "Lord Marrowgar", 50_000)
        for i in range(10)
    )

    def dmg_shield(ts: str, src: str, dst: str, dst_name: str, amount: int) -> str:
        return (f'{ts}  DAMAGE_SHIELD,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,20066,"Retribution Aura",2,'
                f'{amount},0,2,0,0,0,0,0\n')

    log = _make_full_log(
        dmg_shield("4/19 13:00:30.000", PG, BG, "Boss", shield_amount),
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = shield_amount + 50_000 * 10
    assert 0 in parser.session_damage, "session 0 must be populated"
    assert parser.session_damage[0] == pytest.approx(expected, rel=0.01)


def test_session_damage_includes_guardian_from_player():
    """TYPE_GUARDIAN units (Mirror Images, Treants, Army-of-the-Dead ghouls) that
    are player-controlled must be counted in session_damage.

    Guardian flags: TYPE_GUARDIAN (0x2000) | CONTROL_PLAYER (0x0100) | FRIENDLY
    (0x0020) | RAID (0x0004) = 0x2124.  Current code checks (flags & 0x1100) ==
    0x1100 which misses 0x2000 guardians — this test asserts the fix is in place.
    """
    PG = PLAYER_GUID
    GUARDIAN_GUID  = "0xF140000000000002"
    GUARDIAN_FLAGS = "0x2124"   # TYPE_GUARDIAN | CONTROL_PLAYER | FRIENDLY | RAID
    BG = "0xF130000000000002"

    guardian_amount = 33_333
    boss_hits = "".join(
        _pdmg(f"4/19 13:01:{10+i:02d}.000", PG, BG, "Lord Marrowgar", 50_000)
        for i in range(10)
    )

    def guardian_dmg(ts: str, src: str, dst: str, dst_name: str, amount: int) -> str:
        return (
            f'{ts}  SPELL_DAMAGE,{src},"Mirror Image",{GUARDIAN_FLAGS},'
            f'{dst},"{dst_name}",0xa48,58833,"Frostbolt",4,'
            f'{amount},0,4,0,0,0,0,0\n'
        )

    log = _make_full_log(
        _enc_start("4/19 13:01:00.000"),
        boss_hits,
        guardian_dmg("4/19 13:01:30.000", GUARDIAN_GUID, BG, "Lord Marrowgar",
                     guardian_amount),
        _died("4/19 13:02:00.000", BG, "Lord Marrowgar"),
        _enc_end("4/19 13:03:21.000"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = 50_000 * 10 + guardian_amount   # player hits + guardian hits
    assert 0 in parser.session_damage, "session 0 must be populated"
    assert parser.session_damage[0] == pytest.approx(expected, rel=0.01), (
        "Guardian (TYPE_GUARDIAN | CONTROL_PLAYER) damage missing from session total"
    )


# ── Absorbed damage in session_damage ─────────────────────────────────────────
#
# WarcraftLogs and UWU both count "damage done" as amount + absorbed, not just
# the HP the target actually lost.  When a boss has a shield (Lady Deathwhisper
# mana barrier, Saurfang Blood Barrier), a hit may be partially or fully
# absorbed: the log shows amount=<hp_lost> absorbed=<shield_absorbed>.  Our
# session_damage accumulator must add both to match the reference totals.
#
# SPELL_DAMAGE field layout (18 fields):
#   [10]=amount  [11]=overkill  [15]=absorbed
# SWING_DAMAGE field layout (14 fields):
#   [7]=amount   [8]=overkill   [12]=absorbed


def test_session_damage_includes_absorbed_spell_damage():
    """When a spell hit is partially absorbed by a boss shield, session_damage
    must count amount + absorbed (total damage output, not just HP removed).

    This is the WCL / UWU convention.  Lady Deathwhisper mana barrier (phase 1)
    absorbs ALL physical damage; Saurfang Blood Barrier absorbs large hits.
    Without this fix our totals are ~0.88 – 3.29 % below UWU."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    unabsorbed = 15_000   # HP actually removed
    absorbed   =  5_000   # absorbed by boss shield

    def spell_dmg_absorbed(ts: str, src: str, dst: str, dst_name: str,
                            amount: int, absorb: int) -> str:
        # 18 fields: [10]=amount [11]=overkill=0 [12-14]=meta [15]=absorb [16-17]=0
        return (f'{ts}  SPELL_DAMAGE,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,133,"Frostbolt",4,'
                f'{amount},0,4,0,0,{absorb},0,0\n')

    log = _make_full_log(
        spell_dmg_absorbed("4/19 13:00:30.000", PG, BG, "Lady Deathwhisper",
                            unabsorbed, absorbed),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = unabsorbed + absorbed   # 20_000 total output
    assert parser.session_damage.get(0, 0) == pytest.approx(expected, rel=0.01), (
        "Absorbed spell damage must be counted in session total "
        f"(expected {expected}, absorbed={absorbed}, unabsorbed={unabsorbed})"
    )


def test_session_damage_includes_absorbed_swing_damage():
    """When a melee swing is partially absorbed by a boss shield, session_damage
    must count amount + absorbed.

    SWING_DAMAGE field layout (14 fields): [7]=amount [8]=overkill [12]=absorbed"""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    unabsorbed = 20_000
    absorbed   =  8_000

    def swing_dmg_absorbed(ts: str, src: str, dst: str, dst_name: str,
                            amount: int, absorb: int) -> str:
        # 14 fields: [7]=amount [8]=overkill=0 [9]=school [10-11]=meta
        # [12]=absorb [13]=crit
        return (f'{ts}  SWING_DAMAGE,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,'
                f'{amount},0,1,0,0,{absorb},0\n')

    log = _make_full_log(
        swing_dmg_absorbed("4/19 13:00:30.000", PG, BG, "Lord Marrowgar",
                            unabsorbed, absorbed),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    expected = unabsorbed + absorbed   # 28_000 total output
    assert parser.session_damage.get(0, 0) == pytest.approx(expected, rel=0.01), (
        "Absorbed swing damage must be counted in session total "
        f"(expected {expected}, absorbed={absorbed}, unabsorbed={unabsorbed})"
    )


# ── SPELL_MISSED / SWING_MISSED with missType=ABSORB ─────────────────────────
#
# On Warmane (and retail WotLK), a hit that is *fully* absorbed by a boss shield
# (Lady Deathwhisper Phase 1 mana barrier, Saurfang Blood Barrier) generates a
# SPELL_MISSED or SWING_MISSED event with missType=ABSORB instead of a DAMAGE
# event with absorbed>0.  WCL and UWU count the absorbed amount as "damage done"
# because the player's output was real — the boss shield ate it.
#
# SPELL_MISSED field layout:
#   [0]=event [1]=srcGUID [2]=srcName [3]=srcFlags [4]=dstGUID [5]=dstName
#   [6]=dstFlags [7]=spellID [8]=spellName [9]=spellSchool [10]=missType
#   [11]=amountMissed  (present only when missType is ABSORB, BLOCK, or RESIST)
#
# SWING_MISSED field layout:
#   [0]=event [1]=srcGUID [2]=srcName [3]=srcFlags [4]=dstGUID [5]=dstName
#   [6]=dstFlags [7]=missType [8]=amountMissed  (present for ABSORB)


def test_session_damage_includes_spell_missed_absorb():
    """SPELL_MISSED ABSORB must NOT contribute to session_damage.
    UWU does not count fully-absorbed misses separately — it gets the correct
    total via amount+absorbed without subtracting overkill on damage events."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"
    absorbed_amount = 12_345

    def spell_missed_absorb(ts: str, src: str, dst: str, dst_name: str,
                             amount: int) -> str:
        return (f'{ts}  SPELL_MISSED,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,'
                f'133,"Frostbolt",4,ABSORB,{amount}\n')

    log = _make_full_log(
        spell_missed_absorb("4/19 13:00:30.000", PG, BG, "Lady Deathwhisper",
                             absorbed_amount),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    assert parser.session_damage.get(0, 0) == pytest.approx(0, abs=1), (
        "SPELL_MISSED ABSORB must NOT be counted in session_damage"
    )


def test_session_damage_includes_swing_missed_absorb():
    """SWING_MISSED ABSORB must NOT contribute to session_damage.
    UWU does not count fully-absorbed misses separately — same reasoning as
    test_session_damage_includes_spell_missed_absorb above."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"
    absorbed_amount = 8_000

    def swing_missed_absorb(ts: str, src: str, dst: str, dst_name: str,
                             amount: int) -> str:
        return (f'{ts}  SWING_MISSED,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,'
                f'ABSORB,{amount}\n')

    log = _make_full_log(
        swing_missed_absorb("4/19 13:00:30.000", PG, BG, "Lady Deathwhisper",
                             absorbed_amount),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    assert parser.session_damage.get(0, 0) == pytest.approx(0, abs=1), (
        "SWING_MISSED ABSORB must NOT be counted in session_damage"
    )


def test_session_damage_excludes_spell_missed_non_absorb():
    """SPELL_MISSED events that are not ABSORB (DODGE, PARRY, MISS, RESIST, etc.)
    must NOT contribute to session_damage — the hit did zero damage."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    def spell_missed_dodge(ts: str, src: str, dst: str, dst_name: str) -> str:
        return (f'{ts}  SPELL_MISSED,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,'
                f'133,"Frostbolt",4,DODGE\n')

    log = _make_full_log(
        spell_missed_dodge("4/19 13:00:30.000", PG, BG, "Lord Marrowgar"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    assert parser.session_damage.get(0, 0) == pytest.approx(0, abs=1), (
        "Non-ABSORB SPELL_MISSED must not count as damage"
    )


def test_session_damage_excludes_swing_missed_non_absorb():
    """SWING_MISSED with DODGE/PARRY/MISS must not contribute to session_damage."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"

    def swing_missed_parry(ts: str, src: str, dst: str, dst_name: str) -> str:
        return (f'{ts}  SWING_MISSED,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,PARRY\n')

    log = _make_full_log(
        swing_missed_parry("4/19 13:00:30.000", PG, BG, "Lord Marrowgar"),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    assert parser.session_damage.get(0, 0) == pytest.approx(0, abs=1), (
        "Non-ABSORB SWING_MISSED must not count as damage"
    )


def test_session_damage_counts_full_amount_with_overkill():
    """session_damage must count amount+absorbed WITHOUT subtracting overkill.
    UWU Custom Slice uses amount+absorbed (not amount+absorbed-overkill).
    Blood Prince Council triple-death causes 6-8M overkill per session."""
    PG = PLAYER_GUID
    BG = "0xF130000000000002"
    amount   = 50_000
    overkill = 30_000

    def spell_dmg_overkill(ts: str, src: str, dst: str, dst_name: str,
                            amt: int, ovk: int) -> str:
        # 18 fields: [10]=amount [11]=overkill [12-14]=meta [15]=absorbed=0
        return (f'{ts}  SPELL_DAMAGE,{src},"Phyre",0x512,'
                f'{dst},"{dst_name}",0xa48,133,"Frostbolt",4,'
                f'{amt},{ovk},4,0,0,0,0,0\n')

    log = _make_full_log(
        spell_dmg_overkill("4/19 13:00:30.000", PG, BG, "Lord Marrowgar",
                            amount, overkill),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    assert parser.session_damage.get(0, 0) == pytest.approx(amount, rel=0.01), (
        f"session_damage must count full amount {amount}, not amount-overkill "
        f"{amount - overkill} (overkill={overkill})"
    )


def test_session_damage_excludes_vehicle_guid():
    """SPELL_DAMAGE from a vehicle GUID (0xF150* prefix) must not contribute to
    session_damage.  Alliance Gunship Cannons have TYPE_PET|CONTROL_PLAYER flags
    (0x1114) and pass the is_pet check, but UWU excludes vehicle damage."""
    VEHICLE_GUID = "0xF150000000000001"
    BG = "0xF130000000000002"
    amount = 100_000

    def vehicle_spell_dmg(ts: str, src: str, dst: str, dst_name: str,
                           amt: int) -> str:
        # flags 0x1114 = TYPE_PET (0x0100) | CONTROL_PLAYER (0x1000) | REACTION_FRIENDLY (0x0010) | ... vehicle
        return (f'{ts}  SPELL_DAMAGE,{src},"Alliance Cannon",0x1114,'
                f'{dst},"{dst_name}",0xa48,133,"Cannon Blast",4,'
                f'{amt},0,4,0,0,0,0,0\n')

    log = _make_full_log(
        vehicle_spell_dmg("4/19 13:00:30.000", VEHICLE_GUID, BG, "Muradin Bronzebeard",
                           amount),
    )

    parser = CombatLogParser()
    parser.parse_file(_io.StringIO(log))

    assert parser.session_damage.get(0, 0) == pytest.approx(0, abs=1), (
        "Vehicle GUID (0xF150*) must not contribute to session_damage"
    )


# ── Float duration (UWU parity) ────────────────────────────────────────────────

def test_duration_uses_float_precision():
    """duration_seconds must be a float preserving sub-second precision.

    A 234.758s fight truncated to 234s inflates DPS by 0.32%.
    UWU uses float duration — we must match it.

    For KILL outcome the duration is boss_died_ts - start_ts.
    We place the boss death at exactly 234.758s to verify float is kept.
    """
    boss_guid = "0xF130000000000001"
    ts_start = 46800.000  # 13:00:00.000

    def _ts(offset: float) -> str:
        total = ts_start + offset
        h = int(total // 3600)
        m = int((total % 3600) // 60)
        s = total % 60
        return f"4/19 {h:02d}:{m:02d}:{s:06.3f}"

    segment = [
        (_ts(0.0),     [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        (_ts(10.0),    _spell_damage_parts(PLAYER_GUID, "Phyre", boss_guid, "Lord Marrowgar", 100_000), ts_start + 10.0),
        # Boss dies at 234.758s — this is the float precision under test
        (_ts(234.758), _unit_died_parts("Lord Marrowgar"), ts_start + 234.758),
        (_ts(240.0),   [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 240.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    assert isinstance(enc.duration_seconds, float), \
        f"duration_seconds must be float, got {type(enc.duration_seconds).__name__}"
    assert abs(enc.duration_seconds - 234.758) < 0.001, \
        f"Expected 234.758s, got {enc.duration_seconds}"


# ── Heal over-count bug fixes ─────────────────────────────────────────────────
#
# Two bugs caused per-encounter healing totals to be 2-5x higher than UWU:
#
#   1. SPELL_HEAL_ABSORBED in HEAL_EVENTS: this event has a different field
#      structure from SPELL_HEAL. parts[10] is the absorb amount (not a heal
#      amount), causing massive inflation when read as a heal value.
#
#   2. No destination filter for heals: heals landing on pets/totems/non-player
#      units were counted. UWU only counts heals where dst_guid is a player.

def _heal_parts(src_guid: str, src_name: str, dst_guid: str, dst_name: str,
                total: int, spell: str = "Flash Heal",
                effective: int | None = None) -> list[str]:
    """Build minimal SPELL_HEAL parts (14 fields after stripping timestamp).

    WotLK log format:
      parts[10] = gross heal (total cast amount, before overheal)
      parts[11] = overheal  (wasted portion — target near/at full HP)
      parts[12] = absorbed  (absorbed by shields)
      parts[13] = critical  ("1" or "nil")

    Effective heal (HP actually restored) = parts[10] - parts[11].

    Args:
        total:     gross heal amount (parts[10])
        effective: HP actually restored. If provided, overheal = total - effective.
                   If None, assumes zero overheal (effective == total).
    """
    overheal = 0 if effective is None else (total - effective)
    return [
        "SPELL_HEAL",
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        "19750", f'"{spell}"', "2",
        str(total), str(overheal), "0", "0",
    ]


# ── Overheal subtraction ─────────────────────────────────────────────────────
#
# SPELL_HEAL parts[10] = gross heal (total cast amount),
#            parts[11] = overheal  (wasted portion — target was near/at full HP).
# Effective heal = max(0, parts[10] - parts[11]). UWU only counts effective healing.

def test_heal_uses_effective_field():
    """Parser computes effective heal as parts[10] - parts[11] (gross minus overheal).

    WotLK log: parts[10]=gross heal, parts[11]=overheal.
    Example: gross=100k, overheal=60k → effective=40k (what actually restored HP).
    """
    ts_start = 46800.0
    total_heal = 100_000
    effective  = 40_000   # 60k was overheal, 40k actually restored HP

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Healer", PLAYER_GUID, "Target",
                                          total_heal, effective=effective), ts_start + 5.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    healer = next((p for p in enc.participants if p["name"] == "Healer"), None)
    assert healer is not None
    assert healer["totalHealing"] == pytest.approx(effective, abs=1), (
        f"Parser must use parts[11] (effective). total={total_heal:,} effective={effective:,} "
        f"got={healer['totalHealing']:,.0f}"
    )


def test_heal_pure_overheal_counts_zero():
    """A heal where effective=0 (100% overheal) contributes 0 to healing totals.

    Log line: total=50000, effective=0 → target was at full HP, nothing landed.
    """
    ts_start = 46800.0
    total_heal = 50_000

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Healer", PLAYER_GUID, "Target",
                                          total_heal, effective=0), ts_start + 5.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    healer = next((p for p in enc.participants if p["name"] == "Healer"), None)
    actual = healer["totalHealing"] if healer else 0.0
    assert actual == pytest.approx(0, abs=1), (
        f"100% overhealed event (effective=0) should contribute 0. Got {actual:,.0f}"
    )


def test_heal_no_overheal_unchanged():
    """A heal with zero overheal (effective=total) is counted fully."""
    ts_start = 46800.0
    total_heal = 80_000

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Healer", PLAYER_GUID, "Target",
                                          total_heal), ts_start + 5.0),  # defaults effective=total
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    healer = next((p for p in enc.participants if p["name"] == "Healer"), None)
    assert healer is not None
    assert healer["totalHealing"] == pytest.approx(total_heal, abs=1), (
        f"Zero overheal: full amount should count. Got {healer['totalHealing']:,.0f}, expected {total_heal:,}"
    )


NON_PLAYER_GUID = "0xF130000000000999"   # pet/totem — not a player GUID


def test_heal_to_non_player_not_counted():
    """Heals landing on pets/totems must not appear in healer's total_healing.

    UWU only counts heals where dst_guid is a player.
    """
    ts_start = 46800.0

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        # Healer heals a player (should count)
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Healer", PLAYER_GUID, "Healer", 50_000), ts_start + 5.0),
        # Healer heals a non-player (pet) — must NOT count
        ("4/19 13:00:06.000", _heal_parts(PLAYER_GUID, "Healer", NON_PLAYER_GUID, "HunterPet", 200_000), ts_start + 6.0),
        # Boss dies
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    healer = next((p for p in enc.participants if p["name"] == "Healer"), None)
    assert healer is not None
    assert healer["totalHealing"] == pytest.approx(50_000, abs=1), (
        f"Only player-destined heal should count. Got {healer['totalHealing']:,.0f}, expected 50,000"
    )


def test_spell_heal_absorbed_not_counted_as_heal():
    """SPELL_HEAL_ABSORBED must not be processed as a regular heal.

    SPELL_HEAL_ABSORBED has a different field structure from SPELL_HEAL.
    Including it in HEAL_EVENTS causes massive inflation (2-5x over UWU).
    """
    ts_start = 46800.0

    # SPELL_HEAL_ABSORBED event — different field structure
    # parts[10] happens to be the absorb amount (not a heal amount)
    heal_absorbed_parts = [
        "SPELL_HEAL_ABSORBED",
        PLAYER_GUID, '"Healer"', "0x512",    # src (absorber)
        PLAYER_GUID, '"Healer"', "0xa48",    # dst
        "17747", '"Weakened Soul"', "2",     # absorb spell
        "999999",                             # absorb amount (should NOT be counted as heal)
        "19750", '"Flash Heal"', "2",        # absorbed spell info
    ]

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        # Normal heal (should count)
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Healer", PLAYER_GUID, "Healer", 50_000), ts_start + 5.0),
        # SPELL_HEAL_ABSORBED (must NOT count as extra healing)
        ("4/19 13:00:06.000", heal_absorbed_parts, ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    healer = next((p for p in enc.participants if p["name"] == "Healer"), None)
    assert healer is not None
    assert healer["totalHealing"] == pytest.approx(50_000, abs=1), (
        f"SPELL_HEAL_ABSORBED must not inflate healing. Got {healer['totalHealing']:,.0f}, expected 50,000"
    )


def test_dps_uses_float_duration():
    """DPS must be computed with float duration to match UWU precision."""
    boss_guid = "0xF130000000000001"
    ts_start = 46800.0
    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lord Marrowgar"', "6", "25"], ts_start),
        ("4/19 13:00:01.000", _spell_damage_parts(PLAYER_GUID, "Phyre", boss_guid, "Lord Marrowgar", 51_485_997), ts_start + 1.0),
        ("4/19 13:03:54.758", [ENCOUNTER_END, "1234", '"Lord Marrowgar"', "6", "25", "1"], ts_start + 234.758),
    ]
    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    phyre = next(p for p in enc.participants if p["name"] == "Phyre")
    # With float duration 234.758: DPS = 219,310.5
    # With int duration 234: DPS = 220,025.6 (wrong)
    assert phyre["dps"] == pytest.approx(51_485_997 / 234.758, rel=0.001), \
        f"DPS should use float duration. Got {phyre['dps']:.1f}, expected {51_485_997/234.758:.1f}"


# ── Absorbed damage exclusion from per-encounter totals ───────────────────────
#
# Lady Deathwhisper Phase 1 has a mana barrier that absorbs all player damage.
# The combat log records these as SPELL_DAMAGE with absorbed == amount (no HP
# damage lands). UWU's per-encounter "Useful Damage" excludes absorbed hits
# (they don't reduce boss HP). Our parser was using amount - overkill only,
# causing ~35% over-count on Lady DW.
#
# Fix: eff_amount = max(0, amount - overkill - absorbed) for per-encounter damage.
# Note: session_damage still uses amount + absorbed (no overkill) to match UWU
# Custom Slice totals — those are intentionally different per-level counters.

def _spell_damage_with_absorbed(src_guid: str, src_name: str,
                                dst_guid: str, dst_name: str,
                                amount: int, absorbed: int,
                                spell: str = "Frostbolt") -> list[str]:
    """SPELL_DAMAGE parts with a non-zero absorbed field (index 15)."""
    return [
        "SPELL_DAMAGE",
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        "133", f'"{spell}"', "4",
        str(amount), "0", "4", "0", "0", str(absorbed), "0", "0",
        #             overkill   school resist block  absorbed crit
    ]


def _swing_damage_with_absorbed(src_guid: str, src_name: str,
                                dst_guid: str, dst_name: str,
                                amount: int, absorbed: int) -> list[str]:
    """SWING_DAMAGE parts with a non-zero absorbed field (index 12)."""
    return [
        "SWING_DAMAGE",
        src_guid, f'"{src_name}"', "0x512",
        dst_guid, f'"{dst_name}"', "0xa48",
        str(amount), "0", "1", "0", "0", str(absorbed), "0",
        #             overkill  school resist block  absorbed crit
    ]


def test_encounter_damage_excludes_absorbed_spell_damage():
    """SPELL_DAMAGE absorbed by a boss shield must not count as encounter damage.

    Lady Deathwhisper Phase 1: mana barrier absorbs all player damage.
    parts[15] = absorbed amount. eff_amount = amount - overkill - absorbed.
    """
    boss_guid = "0xF130000000000001"
    ts_start = 46800.0

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lady Deathwhisper"', "4", "25"], ts_start),
        # Normal hit (absorbed=0) → should count
        ("4/19 13:00:05.000", _spell_damage_with_absorbed(PLAYER_GUID, "Phyre", boss_guid, "Lady Deathwhisper", 100_000, 0), ts_start + 5.0),
        # Mana barrier hit (absorbed=amount) → must NOT count
        ("4/19 13:00:06.000", _spell_damage_with_absorbed(PLAYER_GUID, "Phyre", boss_guid, "Lady Deathwhisper", 200_000, 200_000), ts_start + 6.0),
        # Partial absorb → only unabsorbed portion counts
        ("4/19 13:00:07.000", _spell_damage_with_absorbed(PLAYER_GUID, "Phyre", boss_guid, "Lady Deathwhisper", 300_000, 50_000), ts_start + 7.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lady Deathwhisper"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lady Deathwhisper"', "4", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None
    # 100_000 + 0 (fully absorbed) + 250_000 (partial: 300k - 50k absorbed) = 350_000
    assert phyre["totalDamage"] == pytest.approx(350_000, abs=1), (
        f"Absorbed damage must be excluded. Got {phyre['totalDamage']:,.0f}, expected 350,000"
    )


def test_encounter_damage_excludes_absorbed_swing_damage():
    """SWING_DAMAGE absorbed by a boss shield must not count as encounter damage.

    absorbed is at parts[12] for SWING_DAMAGE.
    """
    boss_guid = "0xF130000000000001"
    ts_start = 46800.0

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lady Deathwhisper"', "4", "25"], ts_start),
        # Full absorb → 0 damage
        ("4/19 13:00:05.000", _swing_damage_with_absorbed(PLAYER_GUID, "Phyre", boss_guid, "Lady Deathwhisper", 80_000, 80_000), ts_start + 5.0),
        # Normal melee (absorbed=0) → should count
        ("4/19 13:00:06.000", _swing_damage_with_absorbed(PLAYER_GUID, "Phyre", boss_guid, "Lady Deathwhisper", 40_000, 0), ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lady Deathwhisper"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lady Deathwhisper"', "4", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None
    # 0 (fully absorbed) + 40_000 (normal) = 40_000
    assert phyre["totalDamage"] == pytest.approx(40_000, abs=1), (
        f"Absorbed swing damage must be excluded. Got {phyre['totalDamage']:,.0f}, expected 40,000"
    )


# ── Boss-mechanic heals (non-player source → player destination) ──────────────
#
# Blood-Queen Lana'thel's "Essence of the Blood Queen" buff periodically heals
# bitten players, logged with Blood-Queen herself as the source GUID (0xF1...
# non-player). Our _is_player(src_guid) filter drops them, causing BQ healing
# to be ~36% under UWU.
#
# Fix: when is_heal=True and src is non-player but dst is player, include the
# effective heal in the encounter total_healing (without attributing to any actor
# so individual HPS is not inflated).

def test_boss_mechanic_heal_counted_in_encounter():
    """Heals from non-player sources (boss mechanics) landing on players must
    be included in the encounter total_healing.

    Example: Blood-Queen 'Essence of the Blood Queen' periodic heal where
    src=Blood-Queen GUID (non-player), dst=bitten player (player GUID).
    """
    BOSS_SRC_GUID = "0xF130009443000132"   # Blood-Queen — non-player
    ts_start = 46800.0

    # Boss-mechanic heal: src=Blood-Queen, dst=Phyre (player), effective=11550
    boss_mechanic_heal = [
        "SPELL_HEAL",
        BOSS_SRC_GUID, '"Blood-Queen Lana\'thel"', "0x10a48",
        PLAYER_GUID, '"Phyre"', "0x512",
        "70872", '"Essence of the Blood Queen"', "0x20",
        "18981", "7431", "0", "nil",   # gross=18981, overheal=7431, effective=11550
    ]

    segment = [
        ("4/19 14:01:00.000", [ENCOUNTER_START, "1234", '"Blood-Queen Lana\'thel"', "6", "25"], ts_start),
        # Regular player cast (should count)
        ("4/19 14:01:05.000", _heal_parts(PLAYER_GUID, "Sininho", PLAYER_GUID, "Tank", 50_000), ts_start + 5.0),
        # Boss mechanic heal (must also count in encounter total_healing)
        ("4/19 14:01:06.000", boss_mechanic_heal, ts_start + 6.0),
        ("4/19 14:02:00.000", _unit_died_parts("Blood-Queen Lana'thel"), ts_start + 60.0),
        ("4/19 14:02:10.000", [ENCOUNTER_END, "1234", '"Blood-Queen Lana\'thel"', "6", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    expected = 50_000 + 11_550
    assert enc.total_healing == pytest.approx(expected, abs=1), (
        f"Boss mechanic heals must be included in encounter total_healing. "
        f"Got {enc.total_healing:,.0f}, expected {expected:,}"
    )


# ── Add damage exclusion from per-encounter totals ────────────────────────────
#
# Lady Deathwhisper Phase 1: Adherents and Fanatics spawn alongside the boss.
# Our encounter damage was counting ALL targets hit during the fight window,
# inflating DPS by ~35% vs UWU which counts only damage to the boss unit(s).
#
# Fix: pre-pass discovers boss GUID(s) by matching dst_name to boss_name /
# aliases; main loop only accumulates eff_amount when dst_guid is in boss_guids.

def test_encounter_damage_excludes_add_damage():
    """Damage to add units (Adherents, Fanatics, etc.) must NOT count toward
    the encounter's total_damage — only boss-directed damage counts.

    This fixes Lady Deathwhisper being ~35% over UWU.
    Lady Deathwhisper has filter_add_damage=True so the boss_guids filter applies.
    """
    boss_guid = "0xF130000000000001"
    add_guid  = "0xF130000000000002"
    ts_start  = 46800.0

    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "1234", '"Lady Deathwhisper"', "4", "25"], ts_start),
        # Hit boss: should count
        ("4/19 13:00:05.000", _spell_damage_parts(PLAYER_GUID, "Phyre", boss_guid, "Lady Deathwhisper", 100_000), ts_start + 5.0),
        # Hit add: must NOT count toward encounter total_damage
        ("4/19 13:00:06.000", _spell_damage_parts(PLAYER_GUID, "Phyre", add_guid, "Deathwhisper Adherent", 50_000), ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lady Deathwhisper"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "1234", '"Lady Deathwhisper"', "4", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None
    assert phyre["totalDamage"] == pytest.approx(100_000, abs=1), (
        f"Only boss damage counts per-encounter. Got {phyre['totalDamage']:,.0f}, expected 100,000"
    )
    assert enc.total_damage == pytest.approx(100_000, abs=1), (
        f"Encounter total must exclude add damage. Got {enc.total_damage:,.0f}, expected 100,000"
    )


# ── Boss mechanic unit damage (filter_add_damage=False) ──────────────────────
#
# Marrowgar spawns Bone Spikes that players must DPS/click to free raid members.
# Saurfang spawns Blood Beasts that players kill to prevent them from healing boss.
# These are boss-mechanic units, NOT independent add waves — UWU counts damage to
# them.  The boss_guids filter must NOT apply when filter_add_damage=False.

def test_encounter_damage_includes_mechanic_unit_damage():
    """Damage to boss mechanic units (Bone Spikes, Blood Beasts) MUST count
    toward the encounter total.  Lord Marrowgar has filter_add_damage=False so
    all damage — to the boss AND mechanic units — is accumulated.
    """
    marrowgar_guid  = "0xF130000000000010"
    bone_spike_guid = "0xF130000000000011"
    ts_start        = 46800.0

    segment = [
        # boss_id 36612 = Lord Marrowgar (real ID); name lookup gives BossDef
        ("4/19 13:00:00.000", [ENCOUNTER_START, "36612", '"Lord Marrowgar"', "4", "25"], ts_start),
        # 100k to Marrowgar himself
        ("4/19 13:00:05.000", _spell_damage_parts(PLAYER_GUID, "Phyre", marrowgar_guid, "Lord Marrowgar", 100_000), ts_start + 5.0),
        # 50k to a Bone Spike (mechanic unit) — should also count
        ("4/19 13:00:06.000", _spell_damage_parts(PLAYER_GUID, "Phyre", bone_spike_guid, "Bone Spike", 50_000), ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "36612", '"Lord Marrowgar"', "4", "25", "1"], ts_start + 70.0),
    ]

    parser = CombatLogParser(file_year=2026)
    enc = parser._aggregate_segment(segment, {})
    assert enc is not None
    phyre = next((p for p in enc.participants if p["name"] == "Phyre"), None)
    assert phyre is not None
    assert phyre["totalDamage"] == pytest.approx(150_000, abs=1), (
        f"Mechanic-unit damage must be counted (filter_add_damage=False). "
        f"Got {phyre['totalDamage']:,.0f}, expected 150,000"
    )
    assert enc.total_damage == pytest.approx(150_000, abs=1), (
        f"Encounter total must include mechanic-unit damage. "
        f"Got {enc.total_damage:,.0f}, expected 150,000"
    )


# ── Passive proc heals — all included in player totals ───────────────────────
#
# Source: Skada-WoTLK Skada/Core/Tables.lua
# Tables.lua has NO ignored_spells.heal table — Skada does not exclude any
# specific spells from healing-done totals. Every SPELL_HEAL and
# SPELL_PERIODIC_HEAL event is counted regardless of spell name.
#
# Previously thought to be excluded (all confirmed INCLUDED per Skada):
#   - Vampiric Embrace (Shadow Priest passive AoE heal)
#   - Judgement of Light (Paladin passive proc — commented-out in Tables.lua)
#   - Improved Leader of the Pack (Druid passive talent proc)

def test_vampiric_embrace_included_in_healing():
    """Vampiric Embrace heals count toward total_healing (not excluded).

    Skada-WotLK counts VE as healing done. With the correct effective-heal
    formula (gross - overheal) the exclusion is not needed and not applied.
    """
    ts_start = 46800.0
    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "36612", '"Lord Marrowgar"', "4", "25"], ts_start),
        # Active healer heal
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Phyre", "0x0600000000000002", "Tank", 50_000), ts_start + 5.0),
        # Vampiric Embrace — also counted
        ("4/19 13:00:06.000", _heal_parts(PLAYER_GUID, "Shadow", "0x0600000000000002", "Tank", 10_000,
                                           spell="Vampiric Embrace"), ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "36612", '"Lord Marrowgar"', "4", "25", "1"], ts_start + 70.0),
    ]
    enc = CombatLogParser(file_year=2026)._aggregate_segment(segment, {})
    assert enc is not None
    assert enc.total_healing == pytest.approx(60_000, abs=1), (
        f"VE is included in healing totals. Got {enc.total_healing:,.0f}, expected 60,000"
    )
    shadow = next((p for p in enc.participants if p["name"] == "Shadow"), None)
    assert shadow is not None and shadow["totalHealing"] == pytest.approx(10_000, abs=1), (
        "Shadow's VE heal counts toward their totalHealing"
    )


def test_judgement_of_light_included_in_healing():
    """Judgement of Light heals count toward total_healing (not excluded).

    Source: Skada-WoTLK Skada/Core/Tables.lua — there is no ignored_spells.heal
    table. The JoL line ([20267]) is commented out, meaning Skada includes it.
    All SPELL_HEAL / SPELL_PERIODIC_HEAL events count toward healing done.
    """
    ts_start = 46800.0
    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "36612", '"Lord Marrowgar"', "4", "25"], ts_start),
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Phyre", "0x0600000000000002", "Tank", 30_000), ts_start + 5.0),
        ("4/19 13:00:06.000", _heal_parts(PLAYER_GUID, "Retadin", "0x0600000000000003", "DPS", 5_000,
                                           spell="Judgement of Light"), ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "36612", '"Lord Marrowgar"', "4", "25", "1"], ts_start + 70.0),
    ]
    enc = CombatLogParser(file_year=2026)._aggregate_segment(segment, {})
    assert enc is not None
    assert enc.total_healing == pytest.approx(35_000, abs=1), (
        f"JoL is included in healing totals (Skada: no ignored_spells.heal). "
        f"Got {enc.total_healing:,.0f}, expected 35,000"
    )


def test_improved_leader_of_the_pack_included_in_healing():
    """Improved Leader of the Pack heals count toward total_healing (not excluded).

    Skada-WotLK counts ILotP as healing done.
    """
    ts_start = 46800.0
    segment = [
        ("4/19 13:00:00.000", [ENCOUNTER_START, "36612", '"Lord Marrowgar"', "4", "25"], ts_start),
        ("4/19 13:00:05.000", _heal_parts(PLAYER_GUID, "Phyre", "0x0600000000000002", "Tank", 20_000), ts_start + 5.0),
        ("4/19 13:00:06.000", _heal_parts(PLAYER_GUID, "Kitty", "0x0600000000000004", "Tank2", 3_000,
                                           spell="Improved Leader of the Pack"), ts_start + 6.0),
        ("4/19 13:01:00.000", _unit_died_parts("Lord Marrowgar"), ts_start + 60.0),
        ("4/19 13:01:10.000", [ENCOUNTER_END, "36612", '"Lord Marrowgar"', "4", "25", "1"], ts_start + 70.0),
    ]
    enc = CombatLogParser(file_year=2026)._aggregate_segment(segment, {})
    assert enc is not None
    assert enc.total_healing == pytest.approx(23_000, abs=1), (
        f"ILotP is included in healing totals. Got {enc.total_healing:,.0f}, expected 23,000"
    )


# ── S0 difficulty detection: Warmane 10N bosses with heroic-looking spells ─────

def _heuristic_segment_10n(boss_name: str, heroic_spell: str,
                            extra_player_guids: int = 0) -> list[tuple[str, list[str], float]]:
    """
    Build a heuristic segment (no ENCOUNTER_START) for a boss fight with a
    given heroic_spell in it and ≤10 unique player GUIDs — simulating a Warmane
    10N pull where certain spells appear despite not being heroic-exclusive.

    extra_player_guids: additional players beyond the default 1, up to 9 more.
    """
    ts = 46800.0
    boss_npc_guid = "0xF130000000000099"
    # One player hits the boss
    seg: list[tuple[str, list[str], float]] = [
        (
            "4/19 13:00:00.000",
            _spell_damage_parts(PLAYER_GUID, "PlayerA", boss_npc_guid, boss_name, 100_000),
            ts,
        ),
    ]
    # Extra players (still ≤10 total)
    for i in range(min(extra_player_guids, 9)):
        pg = f"0x060000000000{i + 2:04d}"
        seg.append((
            "4/19 13:00:01.000",
            _spell_damage_parts(pg, f"Player{i+2}", boss_npc_guid, boss_name, 50_000),
            ts + 1.0 + i,
        ))
    # Heroic-looking spell fires — should NOT upgrade to heroic for 10N
    seg.append((
        "4/19 13:00:10.000",
        _spell_damage_parts(boss_npc_guid, boss_name, PLAYER_GUID, "PlayerA",
                            5_000, spell=heroic_spell),
        ts + 10.0,
    ))
    # Boss dies → outcome = KILL
    seg.append((
        "4/19 13:01:10.000",
        _unit_died_parts(boss_name),
        ts + 70.0,
    ))
    return seg


def test_sindragosa_10n_backlash_does_not_upgrade_to_heroic():
    """
    On Warmane, Sindragosa 10N also logs 'Backlash' (Unchained Magic self-damage).
    A Sindragosa segment with ≤10 player GUIDs must stay '10N', not be upgraded
    to '10H' by the heroic-spell-marker detection.
    """
    seg = _heuristic_segment_10n("Sindragosa", "Backlash", extra_player_guids=4)
    enc = CombatLogParser(file_year=2026)._aggregate_segment(seg, {})
    assert enc is not None, "Should produce an encounter"
    assert enc.difficulty == "10N", (
        f"Sindragosa 10N with Backlash must stay '10N', got '{enc.difficulty}'"
    )


def test_bpc_10n_empowered_shock_vortex_does_not_upgrade_to_heroic():
    """
    On Warmane, Blood Prince Council 10N logs 'Empowered Shock Vortex'.
    A BPC segment with ≤10 player GUIDs must stay '10N', not be upgraded to '10H'.
    """
    seg = _heuristic_segment_10n("Prince Valanar", "Empowered Shock Vortex",
                                  extra_player_guids=4)
    enc = CombatLogParser(file_year=2026)._aggregate_segment(seg, {})
    assert enc is not None, "Should produce an encounter"
    assert enc.difficulty == "10N", (
        f"BPC 10N with Empowered Shock Vortex must stay '10N', got '{enc.difficulty}'"
    )


def test_normalize_session_difficulty_keeps_25n_sindragosa_without_direct_evidence():
    """
    Sindragosa has Warmane marker ambiguity, so absent direct proof is reported
    as normal instead of guessing heroic from another encounter in the session.
    """
    marrowgar_25h = make_encounter("Lord Marrowgar", difficulty="25H", session_index=0)
    sindragosa_25n = make_encounter("Sindragosa", difficulty="25N", session_index=0)
    encounters = [marrowgar_25h, sindragosa_25n]
    CombatLogParser._normalize_session_difficulty(encounters)
    assert sindragosa_25n.difficulty == "25N", (
        f"Sindragosa without direct heroic evidence must stay '25N', "
        f"got '{sindragosa_25n.difficulty}'"
    )


# ── Heroic detection with ENCOUNTER_START present ────────────────────────────

def _make_encounter_start_segment(
    boss_name: str,
    diff_id: int,
    group_size: int,
    heroic_spell: str | None = None,
    extra_player_count: int = 0,
) -> list[tuple[str, list[str], float]]:
    """Build a minimal segment with ENCOUNTER_START/END and optional heroic spell."""
    ts_base = 46800.0
    seg = [
        (
            "4/19 13:00:00.000",
            [ENCOUNTER_START, "1234", f'"{boss_name}"', str(diff_id), str(group_size)],
            ts_base,
        ),
    ]
    if heroic_spell:
        seg.append((
            "4/19 13:00:01.000",
            _spell_damage_parts(
                PLAYER_GUID, "Phyre",
                NPC_GUID, boss_name,
                50_000, spell=heroic_spell,
            ),
            ts_base + 1,
        ))
    for i in range(extra_player_count):
        guid = f"0x0600000000{i:08x}"
        seg.append((
            "4/19 13:00:02.000",
            _spell_damage_parts(guid, f"Player{i}", NPC_GUID, boss_name, 1000),
            ts_base + 2,
        ))
    seg.append((
        "4/19 13:00:30.000",
        _unit_died_parts(boss_name),
        ts_base + 30,
    ))
    seg.append((
        "4/19 13:00:30.100",
        [ENCOUNTER_END, "1234", f'"{boss_name}"', str(diff_id), str(group_size), "1"],
        ts_base + 30.1,
    ))
    return seg


def test_heroic_detected_with_encounter_start_25h():
    """ENCOUNTER_START difficultyID=4 (25N) + Bone Slice → difficulty must be 25H."""
    seg = _make_encounter_start_segment(
        "Lord Marrowgar", diff_id=4, group_size=25,
        heroic_spell="Bone Slice", extra_player_count=20,
    )
    p = CombatLogParser()
    enc = p._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.difficulty == "25H", f"Expected 25H, got {enc.difficulty}"


def test_heroic_detected_with_encounter_start_10h():
    """ENCOUNTER_START difficultyID=4 (25N) + Bone Slice + ≤12 players → 10H."""
    seg = _make_encounter_start_segment(
        "Lord Marrowgar", diff_id=3, group_size=10,
        heroic_spell="Bone Slice", extra_player_count=8,
    )
    p = CombatLogParser()
    enc = p._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.difficulty == "10H", f"Expected 10H, got {enc.difficulty}"


def test_no_heroic_upgrade_without_markers():
    """ENCOUNTER_START difficultyID=4 with no heroic spells → stays 25N."""
    seg = _make_encounter_start_segment(
        "Lord Marrowgar", diff_id=4, group_size=25,
        heroic_spell=None, extra_player_count=20,
    )
    p = CombatLogParser()
    enc = p._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.difficulty == "25N", f"Expected 25N, got {enc.difficulty}"


def test_heroic_correct_diff_id_unchanged():
    """ENCOUNTER_START difficultyID=6 (25H) already → stays 25H without needing markers."""
    seg = _make_encounter_start_segment(
        "Lord Marrowgar", diff_id=6, group_size=25,
        heroic_spell=None, extra_player_count=20,
    )
    p = CombatLogParser()
    enc = p._aggregate_segment(seg, {})
    assert enc is not None
    assert enc.difficulty == "25H", f"Expected 25H, got {enc.difficulty}"


# ── Debug mode ───────────────────────────────────────────────────────────────

def test_debug_info_returned_when_requested():
    """_aggregate_segment returns (enc, DebugInfo) when debug=True."""
    from parser_core import DebugInfo
    seg = _make_encounter_start_segment(
        "Lord Marrowgar", diff_id=4, group_size=25,
        heroic_spell=None, extra_player_count=20,
    )
    p = CombatLogParser()
    result = p._aggregate_segment(seg, {}, debug=True)
    assert isinstance(result, tuple), f"Expected tuple, got {type(result)}"
    enc, dbg = result
    assert enc is not None
    assert isinstance(dbg, DebugInfo)
    assert dbg.boss_name == "Lord Marrowgar"
    assert dbg.difficulty_method in ("encounter_start", "heuristic")
    assert isinstance(dbg.heroic_markers_found, list)
    assert isinstance(dbg.outcome_evidence, str)
    assert isinstance(dbg.skipped_event_count, int)


def test_debug_info_none_when_not_requested():
    """_aggregate_segment returns ParsedEncounter (not tuple) when debug=False."""
    seg = _make_encounter_start_segment(
        "Lord Marrowgar", diff_id=4, group_size=25,
    )
    p = CombatLogParser()
    result = p._aggregate_segment(seg, {})
    # Normal call: should return a ParsedEncounter, not a tuple
    assert not isinstance(result, tuple), (
        f"Expected ParsedEncounter, got tuple: {result}"
    )
